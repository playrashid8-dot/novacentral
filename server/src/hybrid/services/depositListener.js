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

/** Canonical Transfer event topic — avoids mismatched hard-coded hashes */
const TRANSFER_TOPIC = id("Transfer(address,address,uint256)");
const MIN_DEPOSIT_AMOUNT = MIN_HYBRID_DEPOSIT;
/** Initial lookback capped to reduce pruned-RPC / oversized range failures */
const SAFE_LOOKBACK_BLOCKS = 3000;
/** BSC RPCs often reject eth_getLogs over large spans — keep chunks bounded */
const CHUNK_SIZE = 200;
/** Reorg / fake-log safety: always ≥ 2 (see business rules) */
export const CONFIRMATIONS = 3;

/** Canonical BSC mainnet USDT — mismatch suggests misconfigured HYBRID_USDT_CONTRACT */
const BSC_MAINNET_USDT = "0x55d398326f99059ff775485246999027b3197955";

let isScanning = false;

const isEnabled = (value) => String(value).toLowerCase() === "true";

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

const getLastProcessedBlock = async () => {
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
};

const saveLastProcessedBlock = async (blockNumber) => {
  await HybridSetting.findOneAndUpdate(
    { key: "hybridLastProcessedBlock" },
    { $set: { value: Number(blockNumber) } },
    { upsert: true, new: true }
  );
};

/**
 * Single-log processing (sequential await per log — no in-memory batch accumulation).
 * @returns {{ creditFailure: boolean, processedDelta: number }}
 */
export async function processDepositLog(log, iface, usersByWallet) {
  const txHash = String(log.transactionHash || "").toLowerCase();
  const toAddress = decodeTopicAddress(log.topics?.[2]).toLowerCase();
  const fromAddress = decodeTopicAddress(log.topics?.[1]).toLowerCase();

  if (!txHash || !toAddress || toAddress === "0x") {
    console.log("Deposit skipped: invalid transfer log", { blockNumber: log.blockNumber });
    return { creditFailure: false, processedDelta: 0 };
  }

  const matchedUser = usersByWallet.get(toAddress);

  if (!matchedUser) {
    return { creditFailure: false, processedDelta: 0 };
  }

  const userWalletLower = String(matchedUser.walletAddress || "").trim().toLowerCase();
  if (toAddress === userWalletLower) {
    console.log("🎯 Target wallet matched");
  }

  const existing = await HybridDeposit.findOne({ txHash })
    .select("_id status")
    .lean();

  if (existing) {
    console.log("Duplicate tx skipped:", shortTx(txHash));
    return { creditFailure: false, processedDelta: 0 };
  }

  const parsed = iface.parseLog(log);
  const amount = Number(formatUnits(parsed.args.value, HYBRID_TOKEN.decimals));

  if (!Number.isFinite(amount) || amount <= 0) {
    console.log("Deposit skipped: invalid amount", { wallet: shortAddr(toAddress) });
    return { creditFailure: false, processedDelta: 0 };
  }

  if (amount < MIN_DEPOSIT_AMOUNT) {
    console.log("Deposit skipped: below minimum", {
      wallet: shortAddr(toAddress),
      minimum: MIN_DEPOSIT_AMOUNT,
    });
    return { creditFailure: false, processedDelta: 0 };
  }

  console.log("📥 Deposit detected");
  console.log("📥 Checking deposits for:", userWalletLower);
  console.log("📥 Deposit detail:", {
    txHash: shortTx(txHash),
    amount,
    to: shortAddr(toAddress),
    block: log.blockNumber,
  });

  try {
    await creditHybridDeposit({
      userId: matchedUser._id,
      walletAddress: toAddress,
      txHash,
      amount,
      blockNumber: log.blockNumber,
      fromAddress,
      tokenAddress: String(process.env.HYBRID_USDT_CONTRACT || "").trim(),
    });
  } catch (err) {
    console.error("❌ ERROR:", err?.message || String(err));
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
          console.log("📊 Logs count:", probeLogs.length);
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

  let fromBlock = Math.max(storedBlock + 1, SAFE_START_BLOCK);
  if (fromBlock > latestBlock) {
    if (!quiet) {
      console.log("Deposit listener up to date");
    }
    return { skipped: false, processed: 0 };
  }

  if (!quiet && latestBlock - fromBlock > 5000) {
    console.log("⚠️ Large block range, splitting...");
  }

  let processed = 0;

  for (; fromBlock <= latestBlock; ) {
    const toBlock = Math.min(latestBlock, fromBlock + CHUNK_SIZE - 1);
    let chunkHadCreditFailure = false;

    if (!quiet) {
      console.log("Hybrid deposit scan");
    }

    let logs = [];

    try {
      logs = await withProviderRetry((provider) =>
        provider.getLogs({
          address: String(process.env.HYBRID_USDT_CONTRACT || "").trim(),
          fromBlock,
          toBlock,
          topics: [TRANSFER_TOPIC],
        })
      );
    } catch (err) {
      console.log("❌ ERROR:", err?.message || String(err));
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    if (!quiet) {
      console.log("📊 Logs count:", logs.length);
    }
    if (!quiet && logs.length === 0) {
      console.log("Deposit listener: no Transfer logs in this chunk (may still advance checkpoint)");
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
        $expr: {
          $in: [{ $toLower: { $ifNull: ["$walletAddress", ""] } }, toAddresses],
        },
      }).select("_id walletAddress");

      if (!quiet) {
        console.log("👤 Users loaded:", users.length);
      }

      const usersByWallet = new Map(
        users.map((user) => [(user.walletAddress || "").toLowerCase(), user])
      );

      if (!quiet) {
        console.log("Deposit listener wallet match summary:", {
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

        try {
          const sLog = toSerializableTransferLog(log);
          if (!sLog) {
            continue;
          }
          await enqueueDepositJob({
            log: sLog,
            blockNumber: sLog.blockNumber,
          });
          processed += 1;
        } catch (err) {
          console.error("❌ ERROR:", err?.message || String(err));
          chunkHadCreditFailure = true;
        }
      }
    } else if (!quiet) {
      console.log("Deposit listener found no recipient addresses");
    }

    logs = null;
    if (global.gc) {
      global.gc();
    }
    if (!quiet) {
      console.log("🧠 Memory:", process.memoryUsage().heapUsed / 1024 / 1024, "MB");
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
      if (toBlock > latestBlock) {
        if (!quiet) {
          console.log("Skipping invalid block range (checkpoint)");
        }
        break;
      }
      try {
        await saveLastProcessedBlock(toBlock);
        if (!quiet) {
          console.log("Checkpoint saved:", toBlock);
        }
      } catch (err) {
        console.error("❌ ERROR:", err?.message || String(err));
      }
    }

    fromBlock = toBlock + 1;
  }

  return { skipped: false, processed };
}

export const scanHybridDeposits = async (
  fromBlockOverride = null,
  toBlockOverride = null,
  options = null
) => {
  if (
    !isEnabled(process.env.HYBRID_EARN_ENABLED) ||
    getRpcUrls().length === 0 ||
    !process.env.HYBRID_USDT_CONTRACT
  ) {
    console.log("Deposit listener skipped: missing config or disabled");
    return { skipped: true };
  }

  const opts = options && typeof options === "object" ? options : {};
  const backupSpanRaw = opts.backupBlocks ?? opts.blocks;
  let resolvedFrom = fromBlockOverride;
  let resolvedTo = toBlockOverride;
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
    scanOpts = { ...scanOpts, quiet: true, skipProbe: true };
  }

  if (isScanning) {
    console.log("⏳ Skipping — scan already running");
    return { skipped: true };
  }

  isScanning = true;

  try {
    return await executeDepositScan(resolvedFrom, resolvedTo, scanOpts);
  } catch (err) {
    console.log("❌ ERROR:", err?.message || String(err));
    await new Promise((r) => setTimeout(r, 3000));
    throw err;
  } finally {
    isScanning = false;
  }
};

export const rescanDeposits = async (fromBlock, toBlock) => {
  console.log("Manual rescan started");
  return await scanHybridDeposits(fromBlock, toBlock, { isManualRescan: true });
};
