import { Interface, formatUnits, id } from "ethers";
import User from "../../models/User.js";
import HybridDeposit from "../models/HybridDeposit.js";
import HybridSetting from "../models/HybridSetting.js";
import { creditHybridDeposit } from "./depositService.js";
import { BSC_USDT_ABI, HYBRID_TOKEN, MIN_HYBRID_DEPOSIT } from "../utils/constants.js";
import { getProvider, getRpcUrls, withProviderRetry } from "../utils/provider.js";

/** Canonical Transfer event topic — avoids mismatched hard-coded hashes */
const TRANSFER_TOPIC = id("Transfer(address,address,uint256)");
const MIN_DEPOSIT_AMOUNT = MIN_HYBRID_DEPOSIT;
/** Initial lookback capped to reduce pruned-RPC / oversized range failures */
const SAFE_LOOKBACK_BLOCKS = 3000;
/** BSC RPCs often reject eth_getLogs over large spans — keep chunks bounded */
const MAX_BLOCK_RANGE = 1000;
/** Reorg / fake-log safety: always ≥ 2 (see business rules) */
const CONFIRMATIONS = 3;

/** Canonical BSC mainnet USDT — mismatch suggests misconfigured HYBRID_USDT_CONTRACT */
const BSC_MAINNET_USDT = "0x55d398326f99059ff775485246999027b3197955";

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

export const scanHybridDeposits = async (fromBlockOverride = null, toBlockOverride = null) => {
  try {
    if (
      !isEnabled(process.env.HYBRID_EARN_ENABLED) ||
      getRpcUrls().length === 0 ||
      !process.env.HYBRID_USDT_CONTRACT
    ) {
      console.log("Deposit listener skipped: missing config or disabled");
      return { skipped: true };
    }

    getProvider();
    const usdtContractNorm = String(process.env.HYBRID_USDT_CONTRACT || "")
      .trim()
      .toLowerCase();
    if (!usdtContractNorm || usdtContractNorm !== BSC_MAINNET_USDT) {
      console.warn("⚠️ HYBRID_USDT_CONTRACT should be BSC USDT:", BSC_MAINNET_USDT, "got:", usdtContractNorm || "(empty)");
    }
    const iface = new Interface(BSC_USDT_ABI);
    const isManualRescan = fromBlockOverride !== null || toBlockOverride !== null;
    let chainTip;
    let latestBlock;
    if (toBlockOverride !== null) {
      chainTip = Number(toBlockOverride);
      latestBlock = chainTip;
    } else {
      chainTip = await withProviderRetry((p) => p.getBlockNumber());
      latestBlock = Math.max(0, chainTip - CONFIRMATIONS);
    }

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
        console.log("📊 Logs count:", probeLogs.length);
      }
    } catch (probeErr) {
      console.error("📊 getLogs probe failed:", probeErr?.message || String(probeErr));
    }

    const SAFE_START_BLOCK = Math.max(0, chainTip - SAFE_LOOKBACK_BLOCKS);
    const storedBlock =
      fromBlockOverride !== null ? Number(fromBlockOverride) - 1 : await getLastProcessedBlock();

    if (!Number.isFinite(latestBlock) || !Number.isFinite(storedBlock)) {
      throw new Error("Invalid block range for deposit scan");
    }

    let fromBlock = Math.max(storedBlock + 1, SAFE_START_BLOCK);
    if (fromBlock > latestBlock) {
      console.log("Deposit listener up to date");
      return { skipped: false, processed: 0 };
    }

    let processed = 0;

    for (; fromBlock <= latestBlock; ) {
      const toBlock = Math.min(latestBlock, fromBlock + MAX_BLOCK_RANGE - 1);
      let chunkHadCreditFailure = false;

      console.log("Hybrid deposit scan");

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
        console.error("❌ ERROR:", err?.message || String(err));
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      console.log("Deposit listener logs fetched:", { count: logs.length });
      if (logs.length === 0) {
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

        console.log("👤 Users loaded:", users.length);

        const usersByWallet = new Map(
          users.map((user) => [(user.walletAddress || "").toLowerCase(), user])
        );

        console.log("Deposit listener wallet match summary:", {
          depositWallets: toAddresses.length,
          matchedUsers: users.length,
        });

        for (const log of logs) {
          const txHash = String(log.transactionHash || "").toLowerCase();
          const toAddress = decodeTopicAddress(log.topics?.[2]).toLowerCase();
          const fromAddress = decodeTopicAddress(log.topics?.[1]).toLowerCase();

          if (!txHash || !toAddress || toAddress === "0x") {
            console.log("Deposit skipped: invalid transfer log", { blockNumber: log.blockNumber });
            continue;
          }

          const matchedUser = usersByWallet.get(toAddress);

          if (!matchedUser) {
            continue;
          }

          console.log("🎯 Target wallet:", matchedUser.walletAddress);

          const existing = await HybridDeposit.findOne({ txHash })
            .select("_id status")
            .lean();

          if (existing) {
            console.log("Duplicate tx skipped:", shortTx(txHash));
            continue;
          }

          const parsed = iface.parseLog(log);
          const amount = Number(formatUnits(parsed.args.value, HYBRID_TOKEN.decimals));

          if (!Number.isFinite(amount) || amount <= 0) {
            console.log("Deposit skipped: invalid amount", { wallet: shortAddr(toAddress) });
            continue;
          }

          if (amount < MIN_DEPOSIT_AMOUNT) {
            console.log("Deposit skipped: below minimum", {
              wallet: shortAddr(toAddress),
              minimum: MIN_DEPOSIT_AMOUNT,
            });
            continue;
          }

          console.log("📥 Checking deposits for:", String(matchedUser.walletAddress || "").toLowerCase());
          console.log("📥 Deposit detected:", {
            txHash: shortTx(txHash),
            amount,
            to: shortAddr(toAddress),
            block: log.blockNumber,
          });

          let deposit = null;

          try {
            deposit = await creditHybridDeposit({
              userId: matchedUser._id,
              walletAddress: toAddress,
              txHash,
              amount,
              blockNumber: log.blockNumber,
              fromAddress,
              tokenAddress: String(process.env.HYBRID_USDT_CONTRACT || "").trim(),
            });
          } catch (err) {
            chunkHadCreditFailure = true;
            console.error("❌ ERROR:", err?.message || String(err));
            continue;
          }

          processed += 1;
        }
      } else {
        console.log("Deposit listener found no recipient addresses");
      }

      if (chunkHadCreditFailure) {
        console.error("Deposit listener checkpoint not saved due to credit failure:", {
          fromBlock,
          toBlock,
        });
        break;
      }

      if (!isManualRescan) {
        if (toBlock > latestBlock) {
          console.log("Skipping invalid block range (checkpoint)");
          break;
        }
        try {
          await saveLastProcessedBlock(toBlock);
          console.log("Checkpoint saved:", toBlock);
        } catch (err) {
          console.error("Checkpoint save failed:", err);
        }
      }

      fromBlock = toBlock + 1;
    }

    return { skipped: false, processed };
  } catch (err) {
    console.error("❌ ERROR:", err?.message || String(err));
    await new Promise((r) => setTimeout(r, 3000));
    throw err;
  }
};

export const rescanDeposits = async (fromBlock, toBlock) => {
  console.log("Manual rescan started");
  return await scanHybridDeposits(fromBlock, toBlock);
};
