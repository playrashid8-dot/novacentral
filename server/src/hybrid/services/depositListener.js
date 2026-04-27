import { Interface, formatUnits } from "ethers";
import User from "../../models/User.js";
import HybridDeposit from "../models/HybridDeposit.js";
import HybridSetting from "../models/HybridSetting.js";
import { creditHybridDeposit } from "./depositService.js";
import { BSC_USDT_ABI, HYBRID_TOKEN } from "../utils/constants.js";
import { getProvider, getRpcUrls, withProviderRetry } from "../utils/provider.js";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55aeb1d5b1d";
const MIN_DEPOSIT_AMOUNT = 1;
const FIRST_RUN_SCAN_BLOCKS = 5000;

const isEnabled = (value) => String(value).toLowerCase() === "true";

const decodeTopicAddress = (topic = "") =>
  `0x${String(topic).slice(-40).toLowerCase()}`;

const getLastProcessedBlock = async () => {
  const setting = await HybridSetting.findOne({ key: "hybridLastProcessedBlock" });

  if (setting?.value !== undefined && setting?.value !== null && setting?.value !== "") {
    const storedBlock = Number(setting.value);

    if (Number.isFinite(storedBlock)) {
      return storedBlock;
    }
  }

  const currentBlock = await withProviderRetry((provider) => provider.getBlockNumber());
  const startBlock = Math.max(currentBlock - FIRST_RUN_SCAN_BLOCKS, 0);

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
    const iface = new Interface(BSC_USDT_ABI);
    const isManualRescan = fromBlockOverride !== null || toBlockOverride !== null;
    const latestBlock =
      toBlockOverride !== null
        ? Number(toBlockOverride)
        : await withProviderRetry((provider) => provider.getBlockNumber());
    const storedBlock =
      fromBlockOverride !== null ? Number(fromBlockOverride) - 1 : await getLastProcessedBlock();

    if (!Number.isFinite(latestBlock) || !Number.isFinite(storedBlock)) {
      throw new Error("Invalid block range for deposit scan");
    }

    if (latestBlock <= storedBlock) {
      console.log("Deposit listener up to date:", { latestBlock, storedBlock });
      return { skipped: false, processed: 0 };
    }

    let processed = 0;
    const chunkSize = 1000;

    for (let fromBlock = storedBlock + 1; fromBlock <= latestBlock; fromBlock += chunkSize) {
      const toBlock = Math.min(fromBlock + chunkSize - 1, latestBlock);
      let chunkHadCreditFailure = false;

      console.log("📦 Block scan:", { fromBlock, toBlock });

      const logs = await withProviderRetry((provider) =>
        provider.getLogs({
          address: process.env.HYBRID_USDT_CONTRACT,
          fromBlock,
          toBlock,
          topics: [TRANSFER_TOPIC],
        })
      );

      console.log("Deposit listener logs fetched:", {
        fromBlock,
        toBlock,
        count: logs.length,
      });

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

        const usersByWallet = new Map(
          users.map((user) => [user.walletAddress.toLowerCase(), user])
        );

        console.log("Deposit listener wallet match summary:", {
          depositWallets: toAddresses.length,
          matchedUsers: users.length,
        });

        for (const log of logs) {
          const txHash = String(log.transactionHash || "").toLowerCase();
          const toAddress = decodeTopicAddress(log.topics?.[2]).toLowerCase();
          const fromAddress = decodeTopicAddress(log.topics?.[1]).toLowerCase();

          console.log("🔍 Wallet match:", toAddress);
          console.log("Deposit incoming:", {
            wallet: toAddress,
            txHash,
            blockNumber: log.blockNumber,
          });

          if (!txHash || !toAddress || toAddress === "0x") {
            console.log("Deposit skipped: invalid transfer log", {
              txHash,
              blockNumber: log.blockNumber,
            });
            continue;
          }

          const matchedUser = usersByWallet.get(toAddress);

          if (!matchedUser) {
            console.log("Deposit skipped: wallet not registered", {
              wallet: toAddress,
              txHash,
            });
            continue;
          }

          const existing = await HybridDeposit.findOne({
            txHash,
            userId: matchedUser._id,
          })
            .select("_id status")
            .lean();

          if (existing) {
            console.log("Duplicate tx skipped:", {
              txHash,
              depositId: existing._id,
              status: existing.status,
            });
            continue;
          }

          const parsed = iface.parseLog(log);
          const amount = Number(formatUnits(parsed.args.value, HYBRID_TOKEN.decimals));

          console.log("💰 Deposit detected:", { txHash, amount });

          if (!Number.isFinite(amount) || amount <= 0) {
            console.log("Deposit skipped: invalid amount", {
              wallet: toAddress,
              amount,
              txHash,
            });
            continue;
          }

          if (amount < MIN_DEPOSIT_AMOUNT) {
            console.log("Deposit skipped: below minimum", {
              wallet: toAddress,
              amount,
              minimum: MIN_DEPOSIT_AMOUNT,
              txHash,
            });
            continue;
          }

          let deposit = null;

          try {
            deposit = await creditHybridDeposit({
              userId: matchedUser._id,
              walletAddress: toAddress,
              txHash,
              amount,
              blockNumber: log.blockNumber,
              fromAddress,
              tokenAddress: process.env.HYBRID_USDT_CONTRACT,
            });
          } catch (err) {
            chunkHadCreditFailure = true;
            console.error("Deposit credit failed:", err);
            continue;
          }

          console.log("✅ Deposit credited:", {
            user: matchedUser._id,
            wallet: toAddress,
            amount,
            txHash,
            deposit: deposit?._id,
          });

          processed += 1;
        }
      } else {
        console.log("Deposit listener found no recipient addresses:", { fromBlock, toBlock });
      }

      if (chunkHadCreditFailure) {
        console.error("Deposit listener checkpoint not saved due to credit failure:", {
          fromBlock,
          toBlock,
        });
        break;
      }

      if (!isManualRescan && logs.length > 0) {
        await saveLastProcessedBlock(toBlock);
        console.log("Deposit listener checkpoint saved:", { blockNumber: toBlock });
      }
    }

    return { skipped: false, processed };
  } catch (err) {
    console.error("❌ Deposit listener error:", err);
    throw err;
  }
};

export const rescanDeposits = async (fromBlock, toBlock) => {
  console.log("🔁 Manual rescan started...", { fromBlock, toBlock });
  return await scanHybridDeposits(fromBlock, toBlock);
};
