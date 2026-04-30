import { Interface, formatUnits, id } from "ethers";
import User from "../../models/User.js";
import HybridDeposit from "../models/HybridDeposit.js";
import HybridSetting from "../models/HybridSetting.js";
import { creditHybridDeposit } from "./depositService.js";
import {
  enqueueDepositJob,
  toSerializableTransferLog,
} from "../../queues/depositQueue.js";
import { BSC_USDT_ABI, HYBRID_TOKEN, MIN_HYBRID_DEPOSIT } from "../utils/constants.js";
import { getProvider, getRpcUrls, withProviderRetry } from "../utils/provider.js";
import {
  markPendingDepositCredited,
  recordPendingDepositFailure,
} from "./pendingDepositService.js";
import {
  describeHybridEarnDisabledReason,
  isHybridEarnEnabled,
  warnIfHybridEarnEnvInvalid,
} from "../utils/hybridEarnEnv.js";

/** Canonical Transfer event topic — avoids mismatched hard-coded hashes */
const TRANSFER_TOPIC = id("Transfer(address,address,uint256)");
const transferIface = new Interface(BSC_USDT_ABI);
const MIN_DEPOSIT_AMOUNT = MIN_HYBRID_DEPOSIT;
/** Initial lookback capped to reduce pruned-RPC / oversized range failures */
const SAFE_LOOKBACK_BLOCKS = 3000;
/** BSC RPCs often reject eth_getLogs over large spans — keep chunks bounded */
const CHUNK_SIZE = 200;
/** Deduplicate scan-path enqueue across chunks / retries (in-memory only) */
const seenTx = new Set();
/** Reorg / fake-log safety: always ≥ 2 (see business rules) */
export const CONFIRMATIONS = 3;

const devLog = (...args) => {
  if (process.env.NODE_ENV === "development") {
    console.log(...args);
  }
};

const maybeSampleLog = (...args) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
};

/** Canonical BSC mainnet USDT — mismatch suggests misconfigured HYBRID_USDT_CONTRACT */
const BSC_MAINNET_USDT = "0x55d398326f99059ff775485246999027b3197955";

let isScanning = false;

const decodeTopicAddress = (topic = "") =>
  `0x${String(topic).slice(-40).toLowerCase()}`;

const shortAddr = (addr) => {
  const s = String(addr || "");
  if (s.length < 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
};

const shortTx = (hash) => {
  const s = String(hash || "");
  if (s.length < 14) return s;
  return `${s.slice(0, 10)}…`;
};

export async function getLastProcessedBlock() {
  const setting = await HybridSetting.findOne({ key: "hybridLastProcessedBlock" });

  if (setting?.value !== undefined && setting?.value !== null && setting?.value !== "") {
    const storedBlock = Number(setting.value);

    if (Number.isFinite(storedBlock)) {
      return storedBlock;
    }
  }

  const currentBlock = await withProviderRetry((provider) => provider.getBlockNumber());
  const SAFE_START_BLOCK = Math.max(0, currentBlock - SAFE_LOOKBACK_BLOCKS);
  /** Last persisted block — one below first block we will scan */
  const startBlock = Math.max(SAFE_START_BLOCK - 1, 0);

  await HybridSetting.findOneAndUpdate(
    { key: "hybridLastProcessedBlock" },
    { $set: { value: startBlock } },
    { upsert: true, new: true }
  );

  return startBlock;
}

export async function saveLastProcessedBlock(blockNumber) {
  await HybridSetting.findOneAndUpdate(
    { key: "hybridLastProcessedBlock" },
    { $set: { value: Number(blockNumber) } },
    { upsert: true, new: true }
  );
}

/**
 * Single-log processing (sequential await per log — no in-memory batch accumulation).
 * Queue-first: only credits in-process when skipQueue or enqueue returns kind "direct".
 * @returns {{ creditFailure: boolean, processedDelta: number, holdCheckpoint?: boolean, queued?: boolean }}
 * @param {{ skipQueue?: boolean, fullRecovery?: boolean }} [options] — fullRecovery: enqueue without worker heartbeat gate (checkpoint scan only).
 */
export async function processDepositLog(log, iface, usersByWallet, options = {}) {
  const txHash = String(log.transactionHash || "").toLowerCase();

  if (!txHash) {
    devLog("Deposit skipped: missing tx hash", { blockNumber: log.blockNumber });
    return { creditFailure: false, processedDelta: 0 };
  }

  const usdtExpected = String(process.env.HYBRID_USDT_CONTRACT || "").trim().toLowerCase();
  const logContract = String(log.address ?? "").trim().toLowerCase();
  if (!usdtExpected || logContract !== usdtExpected) {
    return { creditFailure: false, processedDelta: 0 };
  }

  let parsed;
  try {
    parsed = iface.parseLog(log);
  } catch (parseErr) {
    console.error(
      "❌ Invalid log skipped:",
      shortTx(txHash),
      parseErr?.message || String(parseErr)
    );
    return { creditFailure: false, processedDelta: 0 };
  }

  if (parsed.name !== "Transfer") {
    return { creditFailure: false, processedDelta: 0 };
  }

  const fromAddress = String(parsed.args.from).toLowerCase();
  const toAddress = String(parsed.args.to).toLowerCase();

  if (!toAddress || !fromAddress) {
    devLog("Deposit skipped: invalid transfer addresses", { blockNumber: log.blockNumber });
    return { creditFailure: false, processedDelta: 0 };
  }

  const matchedUser = usersByWallet.get(toAddress);

  if (!matchedUser) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("No user found:", shortAddr(toAddress));
    }
    return { creditFailure: false, processedDelta: 0 };
  }

  const userWalletLower = String(matchedUser.walletAddress || "").trim().toLowerCase();
  if (toAddress === userWalletLower) {
    devLog("🎯 Target wallet matched");
  }

  const existing = await HybridDeposit.findOne({ txHash })
    .select("_id status")
    .lean();

  if (["credited", "swept"].includes(existing?.status)) {
    devLog("Duplicate tx skipped:", shortTx(txHash));
    return { creditFailure: false, processedDelta: 0 };
  }

  const amount = Number(formatUnits(parsed.args.value, HYBRID_TOKEN.decimals));

  if (!Number.isFinite(amount) || amount <= 0) {
    devLog("Deposit skipped: invalid amount", { wallet: shortAddr(toAddress) });
    return { creditFailure: false, processedDelta: 0 };
  }

  if (amount < MIN_DEPOSIT_AMOUNT) {
    devLog("Deposit skipped: below minimum", {
      wallet: shortAddr(toAddress),
      minimum: MIN_DEPOSIT_AMOUNT,
    });
    return { creditFailure: false, processedDelta: 0 };
  }

  try {
    await HybridSetting.findOneAndUpdate(
      { key: "hybridLastDetectedTxAt" },
      { $set: { value: Date.now() } },
      { upsert: true, new: true }
    );
  } catch (_) {
    /* non-fatal */
  }

  if (!options.fullRecovery) {
    console.log("📥 Deposit detected", {
      txHash,
      from: fromAddress,
      to: toAddress,
      amount,
      blockNumber: log.blockNumber,
    });
  }
  devLog("📥 Checking deposits for:", userWalletLower);
  devLog("📥 Deposit detail:", {
    txHash: shortTx(txHash),
    amount,
    to: shortAddr(toAddress),
    block: log.blockNumber,
  });

  const serializedLog = toSerializableTransferLog(log);
  const creditDirectly = async () => {
    await creditHybridDeposit({
      userId: matchedUser._id,
      walletAddress: toAddress,
      txHash,
      amount,
      blockNumber: log.blockNumber,
      fromAddress,
      tokenAddress: String(process.env.HYBRID_USDT_CONTRACT || "").trim(),
    });
    await markPendingDepositCredited(txHash);
  };

  const pendingFailurePayload = {
    txHash,
    userId: matchedUser._id,
    walletAddress: toAddress,
    amount,
    blockNumber: log.blockNumber,
    fromAddress,
    tokenAddress: String(process.env.HYBRID_USDT_CONTRACT || "").trim(),
    serializedLog,
  };

  if (options?.skipQueue !== true) {
    /** @type {{ kind: string; job?: unknown } | null} */
    let enqueueOutcome = null;
    try {
      enqueueOutcome = serializedLog
        ? await enqueueDepositJob({
            log: serializedLog,
            blockNumber: serializedLog.blockNumber,
            skipWorkerHeartbeatCheck: options.fullRecovery === true,
          })
        : null;
    } catch (err) {
      console.error("❌ Deposit enqueue failed:", err?.message || String(err));
      await recordPendingDepositFailure({
        ...pendingFailurePayload,
        error: err,
      });
      return { creditFailure: true, holdCheckpoint: true, processedDelta: 0 };
    }

    if (!serializedLog || !enqueueOutcome) {
      console.error("❌ Deposit enqueue skipped: missing serialized log", shortTx(txHash));
      await recordPendingDepositFailure({
        ...pendingFailurePayload,
        error: new Error("enqueueDepositJob: missing serialized transfer log"),
      });
      return { creditFailure: true, holdCheckpoint: true, processedDelta: 0 };
    }

    if (enqueueOutcome.kind === "queued") {
      return { creditFailure: false, holdCheckpoint: true, processedDelta: 0, queued: true };
    }

    if (enqueueOutcome.kind === "defer") {
      console.log("⏸️ Deposit deferred — queue/worker not ready, will retry on next scan", {
        txHash,
        userId: String(matchedUser._id),
      });
      return { creditFailure: false, holdCheckpoint: true, processedDelta: 0 };
    }

    if (enqueueOutcome.kind === "direct") {
      console.warn("⚠️ Redis/queue unavailable — direct credit (only allowed path without queue)", {
        txHash,
        userId: String(matchedUser._id),
        amount,
        blockNumber: log.blockNumber,
      });
      try {
        await creditDirectly();
        return { creditFailure: false, holdCheckpoint: true, processedDelta: 1 };
      } catch (err) {
        console.error("❌ Direct deposit credit failed:", err?.message || String(err));
        await recordPendingDepositFailure({
          ...pendingFailurePayload,
          error: err,
        });
        return { creditFailure: true, processedDelta: 0 };
      }
    }

    console.error("❌ Unknown deposit enqueue outcome — not crediting", {
      txHash,
      outcome: enqueueOutcome,
    });
    await recordPendingDepositFailure({
      ...pendingFailurePayload,
      error: new Error("Unknown enqueue outcome"),
    });
    return { creditFailure: true, holdCheckpoint: true, processedDelta: 0 };
  }

  try {
    await creditDirectly();
  } catch (err) {
    console.error("❌ ERROR:", err?.message || String(err));
    await recordPendingDepositFailure({
      txHash,
      userId: matchedUser._id,
      walletAddress: toAddress,
      amount,
      blockNumber: log.blockNumber,
      fromAddress,
      tokenAddress: String(process.env.HYBRID_USDT_CONTRACT || "").trim(),
      serializedLog,
      error: err,
    });
    return { creditFailure: true, processedDelta: 0 };
  }

  return { creditFailure: false, processedDelta: 1 };
}

async function executeDepositScan(
  fromBlockOverride,
  toBlockOverride,
  scanOptions = {}
) {
  const quiet = scanOptions.quiet === true;
  const skipProbe = scanOptions.skipProbe === true;
  const isManualRescan = scanOptions.isManualRescan === true;
  const logEmptyOnZero = scanOptions.logEmptyOnZero === true;
  if (scanOptions.backupScanTriggered === true) {
    devLog("🛟 Backup scan running...");
  }
  getProvider();
  const usdtContractNorm = String(process.env.HYBRID_USDT_CONTRACT || "")
    .trim()
    .toLowerCase();
  if (!usdtContractNorm || usdtContractNorm !== BSC_MAINNET_USDT) {
    console.warn("⚠️ HYBRID_USDT_CONTRACT should be BSC USDT:", BSC_MAINNET_USDT, "got:", usdtContractNorm || "(empty)");
  }
  let chainTip;
  let latestBlock;
  if (toBlockOverride !== null) {
    chainTip = Number(toBlockOverride);
    latestBlock = chainTip;
  } else {
    chainTip = await withProviderRetry((p) => p.getBlockNumber());
    latestBlock = Math.max(0, chainTip - CONFIRMATIONS);
  }

  if (!skipProbe) {
    try {
      const USDT_CONTRACT = String(process.env.HYBRID_USDT_CONTRACT || "").trim();
      if (USDT_CONTRACT) {
        const diagFrom = Math.max(0, chainTip - 50);
        const probeLogs = await withProviderRetry((provider) =>
          provider.getLogs({
            address: USDT_CONTRACT,
            fromBlock: diagFrom,
            toBlock: chainTip,
            topics: [TRANSFER_TOPIC],
          })
        );
        if (!quiet) {
          devLog("📊 Logs count:", probeLogs.length);
        }
      }
    } catch (probeErr) {
      console.error("❌ ERROR:", probeErr?.message || String(probeErr));
    }
  }

  const SAFE_START_BLOCK = Math.max(0, chainTip - SAFE_LOOKBACK_BLOCKS);
  const storedBlock =
    fromBlockOverride !== null ? Number(fromBlockOverride) - 1 : await getLastProcessedBlock();

  if (!Number.isFinite(latestBlock) || !Number.isFinite(storedBlock)) {
    throw new Error("Invalid block range for deposit scan");
  }

  /** Admin/manual rescans must honor explicit [from,to]; SAFE_START clamp would skip older blocks inside range */
  const manualExplicitRange =
    isManualRescan &&
    fromBlockOverride !== null &&
    toBlockOverride !== null &&
    Number.isFinite(Number(fromBlockOverride)) &&
    Number.isFinite(Number(toBlockOverride));

  let fromBlock = manualExplicitRange
    ? Math.max(Number(fromBlockOverride), 0)
    : Math.max(storedBlock + 1, SAFE_START_BLOCK);

  const REORG_BUFFER = 5;
  if (fromBlock !== null) {
    fromBlock = Math.max(0, fromBlock - REORG_BUFFER);
  }

  if (fromBlock > latestBlock) {
    if (!quiet) {
      devLog("Deposit listener up to date");
    }
    return { skipped: false, processed: 0 };
  }

  if (!quiet && latestBlock - fromBlock > 5000) {
    maybeSampleLog("⚠️ Large block range, splitting...");
  }

  let processed = 0;

  for (; fromBlock <= latestBlock; ) {
    const toBlock = Math.min(latestBlock, fromBlock + CHUNK_SIZE - 1);
    let chunkHadCreditFailure = false;

    if (!quiet) {
      devLog("Hybrid deposit scan");
    }

    let logs = [];

    const fetchChunkLogs = () =>
      withProviderRetry((provider) =>
        provider.getLogs({
          address: String(process.env.HYBRID_USDT_CONTRACT || "").trim(),
          fromBlock,
          toBlock,
          topics: [TRANSFER_TOPIC],
        })
      );

    const processedBeforeChunk = processed;

    try {
      logs = await fetchChunkLogs();
    } catch (err) {
      maybeSampleLog("❌ RPC failed — retrying...");
      await new Promise((r) => setTimeout(r, 2000));
      try {
        logs = await fetchChunkLogs();
      } catch (err2) {
        console.error("❌ ERROR:", err2?.message || String(err2));
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
    }

    if (logs.length === 0) {
      maybeSampleLog("⚠️ Empty scan result — retrying...");
      try {
        await new Promise((r) => setTimeout(r, 1500));
        logs = await fetchChunkLogs();
      } catch (retryErr) {
        console.error("❌ ERROR:", retryErr?.message || String(retryErr));
      }
    }

    if (!quiet) {
      devLog("📊 Logs count:", logs.length);
    }
    if (!quiet && logs.length === 0) {
      devLog(
        "Deposit listener: no Transfer logs in this chunk (may still advance checkpoint)"
      );
    }

    const toAddresses = [
      ...new Set(
        logs
          .map((log) => decodeTopicAddress(log.topics?.[2]).toLowerCase())
          .filter((address) => address && address !== "0x")
      ),
    ];

    if (toAddresses.length > 0) {
      const users = await User.find({
        walletAddress: { $in: toAddresses },
      })
        .select("_id walletAddress")
        .lean();

      if (!quiet) {
        devLog("👤 Users loaded:", users.length);
      }

      const usersByWallet = new Map(
        users.map((user) => [
          String(user.walletAddress || "")
            .trim()
            .toLowerCase(),
          user,
        ])
      );

      if (!quiet) {
        devLog("Deposit listener wallet match summary:", {
          depositWallets: toAddresses.length,
          matchedUsers: users.length,
        });
      }

      for (const log of logs) {
        const toAddress = decodeTopicAddress(log.topics?.[2]).toLowerCase();
        const matchedUser = usersByWallet.get(toAddress);

        if (!matchedUser) {
          continue;
        }

        const txHash = String(log.transactionHash || "").trim().toLowerCase();
        if (!txHash) continue;
        if (seenTx.has(txHash)) {
          continue;
        }
        seenTx.add(txHash);
        if (seenTx.size > 20000) {
          seenTx.clear();
        }

        const result = await processDepositLog(log, transferIface, usersByWallet);
        processed += Number(result.processedDelta) || 0;
        const deferOrFail =
          result.creditFailure ||
          (result.holdCheckpoint &&
            result.processedDelta === 0 &&
            result.queued !== true);
        if (deferOrFail) {
          seenTx.delete(txHash);
          chunkHadCreditFailure = true;
          break;
        }
      }
    } else if (!quiet) {
      devLog("Deposit listener found no recipient addresses");
    }

    if (logs.length > 0 && processed === processedBeforeChunk) {
      maybeSampleLog("🚨 Logs found but no deposits processed");
    }

    logs = null;
    if (global.gc) {
      global.gc();
    }
    if (!quiet) {
      devLog("🧠 Memory:", process.memoryUsage().heapUsed / 1024 / 1024, "MB");
    }
    await new Promise((r) => setTimeout(r, 150));

    if (chunkHadCreditFailure) {
      console.error("Deposit listener checkpoint not saved due to credit failure:", {
        fromBlock,
        toBlock,
      });
      break;
    }

    if (!isManualRescan) {
      const checkpointHasConfirmationDepth = chainTip >= toBlock + CONFIRMATIONS;
      if (toBlock > latestBlock || !checkpointHasConfirmationDepth) {
        if (!quiet) {
          devLog("Skipping invalid block range (checkpoint)");
        }
        break;
      }
      try {
        await saveLastProcessedBlock(toBlock);
        if (!quiet) {
          devLog("Checkpoint saved:", toBlock);
        }
      } catch (err) {
        console.error("❌ ERROR:", err?.message || String(err));
      }
    }

    fromBlock = toBlock + 1;
  }

  if (processed === 0 && (!quiet || logEmptyOnZero)) {
    maybeSampleLog("🚨 No deposits found — possible miss or already processed");
  }

  return { skipped: false, processed };
}

export const scanHybridDeposits = async (
  fromBlockOverride = null,
  toBlockOverride = null,
  options = null
) => {
  let from = fromBlockOverride;
  let to = toBlockOverride;
  let optIn = options;
  /** Reject accidental scanHybridDeposits({ blocks: N }) — normalize to (null, null, opts). */
  if (
    from != null &&
    typeof from === "object" &&
    !Array.isArray(from) &&
    toBlockOverride == null &&
    (options === null || options === undefined)
  ) {
    optIn = /** @type {Record<string, unknown>} */ (from);
    from = null;
    to = null;
  }

  warnIfHybridEarnEnvInvalid();

  if (!isHybridEarnEnabled()) {
    console.error("❌ Listener disabled:", describeHybridEarnDisabledReason());
    return { skipped: true };
  }

  const rpcUrls = getRpcUrls();
  if (rpcUrls.length === 0) {
    console.error(
      "❌ Listener skipped:",
      "No RPC URLs loaded — set HYBRID_BSC_RPC_URL or BSC_RPC_URL (optional: HYBRID_BSC_RPC_FALLBACK, HYBRID_BSC_RPC_BACKUP)"
    );
    return { skipped: true };
  }

  const contractTrimmed = String(process.env.HYBRID_USDT_CONTRACT ?? "").trim();
  if (!contractTrimmed) {
    console.error("❌ Listener skipped:", "HYBRID_USDT_CONTRACT is missing");
    return { skipped: true };
  }

  const opts = optIn && typeof optIn === "object" ? optIn : {};
  const backupSpanRaw = opts.backupBlocks ?? opts.blocks;
  let resolvedFrom = from;
  let resolvedTo = to;
  const { backupBlocks: _bb, blocks: _b, ...restScanOpts } = opts;
  let scanOpts = { ...restScanOpts };

  if (
    resolvedFrom == null &&
    resolvedTo == null &&
    backupSpanRaw != null &&
    Number.isFinite(Number(backupSpanRaw))
  ) {
    const chainTip = await withProviderRetry((p) => p.getBlockNumber());
    const latestBlock = Math.max(0, chainTip - CONFIRMATIONS);
    const span = Math.max(1, Number(backupSpanRaw) || 50);
    resolvedFrom = Math.max(0, latestBlock - (span - 1));
    resolvedTo = latestBlock;
    scanOpts = {
      ...scanOpts,
      quiet: true,
      skipProbe: true,
      backupScanTriggered: true,
    };
  }

  if (isScanning) {
    devLog("⏳ Skipping — scan already running");
    return { skipped: true };
  }

  isScanning = true;

  try {
    return await executeDepositScan(resolvedFrom, resolvedTo, scanOpts);
  } catch (err) {
    console.error("❌ ERROR:", err?.message || String(err));
    await new Promise((r) => setTimeout(r, 3000));
    throw err;
  } finally {
    isScanning = false;
  }
};

export const rescanDeposits = async (fromBlock, toBlock) => {
  if (process.env.NODE_ENV !== "production") {
    console.log("Manual rescan started");
  }
  return await scanHybridDeposits(fromBlock, toBlock, { isManualRescan: true });
};
