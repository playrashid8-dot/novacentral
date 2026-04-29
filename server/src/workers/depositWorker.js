import "dotenv/config";
import { Worker } from "bullmq";
import { Interface, formatUnits } from "ethers";

import connectDB from "../config/db.js";
import HybridDeposit from "../hybrid/models/HybridDeposit.js";
import User from "../models/User.js";
import { processDepositLog } from "../hybrid/services/depositListener.js";
import { BSC_USDT_ABI, HYBRID_TOKEN } from "../hybrid/utils/constants.js";
import { redis } from "../config/redis.js";

const iface = new Interface(BSC_USDT_ABI);

const decodeTopicAddress = (topic = "") =>
  `0x${String(topic).slice(-40).toLowerCase()}`;

async function handleDeposit(serializedLog) {
  const normalized = String(serializedLog?.transactionHash || "").toLowerCase();

  if (!normalized) {
    console.error("❌ Worker error: missing transaction hash on job");
    return { outcome: "skip", reason: "missing_tx", processedDelta: 0 };
  }

  console.log(`⚙️ Processing job: ${normalized}`);

  if (await HybridDeposit.exists({ txHash: normalized })) {
    return { outcome: "duplicate", txHash: normalized, processedDelta: 0 };
  }

  const log = {
    transactionHash: serializedLog.transactionHash,
    address:
      serializedLog.address != null
        ? String(serializedLog.address).trim()
        : undefined,
    blockNumber:
      serializedLog.blockNumber != null &&
      Number.isFinite(Number(serializedLog.blockNumber))
        ? Number(serializedLog.blockNumber)
        : undefined,
    topics: [...(serializedLog.topics || [])],
    data: serializedLog.data,
  };

  const expectedContract = String(process.env.HYBRID_USDT_CONTRACT || "").trim().toLowerCase();
  const logAddr = log.address != null ? String(log.address).trim().toLowerCase() : "";
  if (expectedContract && logAddr && logAddr !== expectedContract) {
    console.warn("❌ Invalid contract event ignored", {
      expected: expectedContract,
      received: logAddr,
    });
    return { outcome: "skip", reason: "contract", txHash: normalized, processedDelta: 0 };
  }

  const toAddr = decodeTopicAddress(log.topics?.[2]).toLowerCase();
  if (!toAddr || toAddr === "0x") {
    console.error("❌ Safety check: invalid recipient wallet on log", normalized);
    return { outcome: "skip", reason: "wallet", txHash: normalized, processedDelta: 0 };
  }

  let parsedAmount;
  try {
    const parsed = iface.parseLog({
      address: logAddr || expectedContract,
      topics: log.topics,
      data: log.data,
    });
    parsedAmount = Number(formatUnits(parsed.args.value, HYBRID_TOKEN.decimals));
  } catch (err) {
    console.error("❌ Deposit parsing error:", normalized, err?.message || String(err));
    throw err;
  }

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    console.error("❌ Safety check: amount must be > 0", { txHash: normalized, parsedAmount });
    return { outcome: "skip", reason: "amount", txHash: normalized, processedDelta: 0 };
  }

  console.log(`💰 Amount parsed: ${parsedAmount} USDT`);

  const user = await User.findOne({
    $expr: {
      $eq: [
        {
          $toLower: {
            $trim: { input: { $ifNull: ["$walletAddress", ""] } },
          },
        },
        toAddr,
      ],
    },
  }).select("_id walletAddress");

  if (!user) {
    console.log("❌ No user found for wallet:", toAddr);
    return { outcome: "skip", reason: "no_user", txHash: normalized, processedDelta: 0 };
  }

  const usersByWallet = new Map([
    [
      String(user.walletAddress || "")
        .trim()
        .toLowerCase(),
      user,
    ],
  ]);

  const r = await processDepositLog(log, iface, usersByWallet);

  if (r.creditFailure) {
    console.error("❌ Worker error: credit failed", normalized);
    throw new Error("Hybrid deposit credit failed");
  }

  const processedDelta = Number(r.processedDelta) || 0;
  if (processedDelta > 0) {
    return { outcome: "credited", txHash: normalized, processedDelta };
  }

  return { outcome: "skip", reason: "no_credit", txHash: normalized, processedDelta: 0 };
}

await connectDB();

setInterval(() => {
  console.log("💚 Hybrid system alive");
}, 60000);

const worker = new Worker(
  "depositQueue",
  async (job) => {
    const { log } = job.data;
    return handleDeposit(log);
  },
  {
    connection: redis,
    concurrency: 5,
  },
);

worker.on("completed", (job, result) => {
  const tx = String(job?.data?.log?.transactionHash || "").trim();
  if (!tx) return;
  const processedDelta = Number(result?.processedDelta);
  if (Number.isFinite(processedDelta) && processedDelta > 0) {
    console.log("✅ Deposit processed:", tx);
  } else {
    console.log("⚠️ Skipped (duplicate or invalid):", tx);
  }
});

worker.on("failed", (job, err) => {
  const tx = job?.data?.log?.transactionHash || job?.id;
  console.error("❌ Worker error (job failed):", tx, err?.message || String(err));
});
