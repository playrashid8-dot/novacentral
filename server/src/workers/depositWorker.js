import { Worker } from "bullmq";
import dotenv from "dotenv";
import { Interface } from "ethers";

dotenv.config();

import connectDB from "../config/db.js";
import HybridDeposit from "../hybrid/models/HybridDeposit.js";
import User from "../models/User.js";
import { processDepositLog } from "../hybrid/services/depositListener.js";
import { BSC_USDT_ABI } from "../hybrid/utils/constants.js";
import { redis } from "../config/redis.js";

const iface = new Interface(BSC_USDT_ABI);

const decodeTopicAddress = (topic = "") =>
  `0x${String(topic).slice(-40).toLowerCase()}`;

async function handleDeposit(serializedLog) {
  const normalized = String(serializedLog?.transactionHash || "").toLowerCase();

  if (await HybridDeposit.exists({ txHash: normalized })) {
    console.log("⚠️ Duplicate skipped");
    return;
  }

  const log = {
    transactionHash: serializedLog.transactionHash,
    blockNumber:
      serializedLog.blockNumber != null &&
      Number.isFinite(Number(serializedLog.blockNumber))
        ? Number(serializedLog.blockNumber)
        : undefined,
    topics: [...(serializedLog.topics || [])],
    data: serializedLog.data,
  };

  const toAddr = decodeTopicAddress(log.topics?.[2]).toLowerCase();
  const user = await User.findOne({
    $expr: {
      $eq: [{ $toLower: { $ifNull: ["$walletAddress", ""] } }, toAddr],
    },
  }).select("_id walletAddress");

  if (!user) {
    return;
  }

  const usersByWallet = new Map([
    [(user.walletAddress || "").toLowerCase(), user],
  ]);

  console.log("📥 Processing deposit:", normalized);

  const r = await processDepositLog(log, iface, usersByWallet);

  if (r.creditFailure) {
    throw new Error("Hybrid deposit credit failed");
  }
}

await connectDB();

console.log("💚 Worker alive:", process.pid);

setInterval(() => {
  console.log("💚 Queue system running");
}, 60000);

const worker = new Worker(
  "depositQueue",
  async (job) => {
    console.log("⚙️ Worker processing:", job.id);
    const { log } = job.data;
    await handleDeposit(log);
  },
  {
    connection: redis,
    concurrency: 5,
  },
);

worker.on("completed", () => {
  console.log("✅ Deposit processed");
});

worker.on("failed", (job, err) => {
  console.log("❌ Job failed:", err?.message || String(err));
});
