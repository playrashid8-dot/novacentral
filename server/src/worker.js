import "dotenv/config";

import connectDB from "./config/db.js";
import { Worker } from "bullmq";
import { getRedis } from "./config/redis.js";

await connectDB();

const connection = getRedis();

if (!connection) {
  console.warn("⚠️ Redis missing — worker idle");
} else {
  const worker = new Worker(
    "depositQueue",
    async (job) => {
      const { processDepositJob } = await import("./hybrid/services/depositService.js");
      return processDepositJob(job.data);
    },
    {
      connection,
      concurrency: 20,
    }
  );

  worker.on("completed", (job, result) => {
    const tx = String(job?.data?.log?.transactionHash || "").trim();
    if (!tx) return;
    const processedDelta = Number(result?.processedDelta);
    if (process.env.NODE_ENV !== "production") {
      if (Number.isFinite(processedDelta) && processedDelta > 0) {
        console.log("✅ Deposit processed:", tx);
      } else {
        console.log("⚠️ Skipped (duplicate or invalid):", tx);
      }
    }
  });

  worker.on("failed", (job, err) => {
    const tx = job?.data?.log?.transactionHash || job?.id;
    console.error("❌ Worker error (job failed):", tx, err?.message || String(err));
  });

  console.log("👷 Worker running");
}

setInterval(() => {
  if (process.env.NODE_ENV !== "production") {
    console.log("💚 Hybrid system alive");
  }
}, 60000);
