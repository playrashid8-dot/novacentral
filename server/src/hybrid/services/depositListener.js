import { Interface, formatUnits } from "ethers";
import User from "../../models/User.js";
import HybridSetting from "../models/HybridSetting.js";
import { creditHybridDeposit } from "./depositService.js";
import { BSC_USDT_ABI, HYBRID_TOKEN } from "../utils/constants.js";
import { getProvider, getRpcUrls, withProviderRetry } from "../utils/provider.js";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55aeb1d5b1d";

const isEnabled = (value) => String(value).toLowerCase() === "true";

const decodeTopicAddress = (topic = "") =>
  `0x${String(topic).slice(-40).toLowerCase()}`;

const getLastProcessedBlock = async () => {
  const setting = await HybridSetting.findOne({ key: "hybridLastProcessedBlock" });

  if (setting?.value) {
    return Number(setting.value);
  }

  const currentBlock = await withProviderRetry((provider) => provider.getBlockNumber());
  const startBlock = Math.max(currentBlock - 50, 0);

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

export const scanHybridDeposits = async () => {
  if (
    !isEnabled(process.env.HYBRID_EARN_ENABLED) ||
    getRpcUrls().length === 0 ||
    !process.env.HYBRID_USDT_CONTRACT
  ) {
    return { skipped: true };
  }

  getProvider();
  const iface = new Interface(BSC_USDT_ABI);
  const latestBlock = await withProviderRetry((provider) => provider.getBlockNumber());
  const storedBlock = await getLastProcessedBlock();

  if (latestBlock <= storedBlock) {
    return { skipped: false, processed: 0 };
  }

  let processed = 0;
  const chunkSize = 1000;

  for (let fromBlock = storedBlock + 1; fromBlock <= latestBlock; fromBlock += chunkSize) {
    const toBlock = Math.min(fromBlock + chunkSize - 1, latestBlock);
    const logs = await withProviderRetry((provider) =>
      provider.getLogs({
        address: process.env.HYBRID_USDT_CONTRACT,
        fromBlock,
        toBlock,
        topics: [TRANSFER_TOPIC],
      })
    );

    const toAddresses = [...new Set(logs.map((log) => decodeTopicAddress(log.topics?.[2])))];

    if (toAddresses.length > 0) {
      const users = await User.find({
        walletAddress: { $in: toAddresses },
      }).select("_id walletAddress");

      const usersByWallet = new Map(
        users.map((user) => [String(user.walletAddress || "").toLowerCase(), user])
      );

      for (const log of logs) {
        const walletAddress = decodeTopicAddress(log.topics?.[2]);
        const matchedUser = usersByWallet.get(walletAddress);

        if (!matchedUser) {
          continue;
        }

        const parsed = iface.parseLog(log);
        const amount = Number(formatUnits(parsed.args.value, HYBRID_TOKEN.decimals));

        if (!Number.isFinite(amount) || amount <= 0) {
          continue;
        }

        await creditHybridDeposit({
          userId: matchedUser._id,
          walletAddress,
          txHash: log.transactionHash,
          amount,
          blockNumber: log.blockNumber,
          fromAddress: decodeTopicAddress(log.topics?.[1]),
          tokenAddress: process.env.HYBRID_USDT_CONTRACT,
        });
        processed += 1;
      }
    }

    await saveLastProcessedBlock(toBlock);
  }

  return { skipped: false, processed };
};
