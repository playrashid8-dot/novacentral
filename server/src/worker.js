import "dotenv/config";

import connectDB from "./config/db.js";
import { Worker } from "bullmq";
import {
  connectRedisInBackground,
  getRedis,
  isRedisReady,
} from "./config/redis.js";

process.on("uncaughtException", (err) => {
  console.error("WORKER FATAL:", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("WORKER FATAL:", err);
  process.exit(1);
});

await connectDB();

try {
  await connectRedisInBackground();
} catch (err) {
  console.error("Worker Redis connect:", err?.message || String(err));
}

const workerRecoveryExplicitOff =
  String(process.env.HYBRID_WORKER_FULL_RECOVERY_ON_START || "")
    .trim()
    .toLowerCase() === "false";
const skipWorkerFullRecovery =
  String(process.env.HYBRID_WORKER_SKIP_FULL_RECOVERY_ON_START || "")
    .trim()
    .toLowerCase() === "true" || workerRecoveryExplicitOff;

if (!skipWorkerFullRecovery) {
  console.log("🔁 Worker: full checkpoint recovery (all blocks from checkpoint → tip)…");
  try {
    const { runFullRecoveryScan } = await import(
      "./hybrid/services/depositBackfill.js"
    );
    await runFullRecoveryScan();
  } catch (err) {
    console.error(
      "Worker startup full recovery failed:",
      err?.message || String(err)
    );
  }
}

const connection = getRedis();
const WORKER_HEARTBEAT_KEY = "depositQueue:worker:heartbeat";
const WORKER_HEARTBEAT_TTL_SECONDS = 90;

if (!isRedisReady(connection)) {
  console.warn("⚠️ Redis missing — worker idle");
} else {
  const writeWorkerHeartbeat = async () => {
    if (!isRedisReady(connection)) {
      return;
    }

    try {
      await connection.set(
        WORKER_HEARTBEAT_KEY,
        String(Date.now()),
        "EX",
        WORKER_HEARTBEAT_TTL_SECONDS,
      );
    } catch (err) {
      console.error("❌ Worker heartbeat failed:", err?.message || String(err));
    }
  };

  const worker = new Worker(
    "depositQueue",
    async (job) => {
      const { processDepositJob } = await import("./hybrid/services/depositService.js");
      return processDepositJob(job.data);
    },
    {
      connection,
      concurrency: 5,
    }
  );

  await writeWorkerHeartbeat();
  setInterval(() => {
    void writeWorkerHeartbeat();
  }, 30000);

  worker.on("completed", (job, result) => {
    const txHash = String(
      job?.data?.log?.transactionHash || job?.id || result?.txHash || ""
    )
      .trim()
      .toLowerCase();
    if (!txHash) return;
    const processedDelta = Number(result?.processedDelta);
    if (Number.isFinite(processedDelta) && processedDelta > 0) {
      console.log("✅ Deposit processed", {
        txHash,
        userId: result?.userId,
        amount: result?.amount,
      });
    } else {
      console.log("⚠️ Duplicate/skipped deposit", { txHash });
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
