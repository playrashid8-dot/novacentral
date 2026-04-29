import { Queue } from "bullmq";
import { redis } from "../config/redis.js";

/** Shared BullMQ worker / queue tuning: max jobs started per duration (global per queue in Redis). */
export const DEPOSIT_QUEUE_LIMITER = {
  max: 50,
  duration: 1000,
};

export const depositQueue = redis
  ? new Queue("depositQueue", {
      connection: redis,
    })
  : null;

/** Shared BullMQ options for deposit jobs (retries / backoff / idempotent jobId = txHash). */
export const DEPOSIT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000,
  },
  /** Frees custom jobId after success so the same txHash can be re-queued only if needed. */
  removeOnComplete: true,
  removeOnFail: { count: 2000 },
};

/** JSON-serializable copy of an ethers Transfer log for Redis / BullMQ */
export function toSerializableTransferLog(log) {
  if (!log?.transactionHash) return null;
  const bn = log.blockNumber;
  const blockNumber =
    bn != null && Number.isFinite(Number(bn))
      ? Number(bn)
      : undefined;

  return {
    transactionHash: log.transactionHash,
    topics: [...(log.topics || [])],
    data: log.data,
    blockNumber,
    ...(log.address != null && String(log.address).trim() !== ""
      ? { address: String(log.address).trim() }
      : {}),
  };
}

/**
 * @param {{ log: object, blockNumber?: number }} payload
 */
export async function enqueueDepositJob({ log, blockNumber }) {
  if (!redis || !depositQueue) {
    return null;
  }

  const merged = {
    ...log,
    blockNumber: blockNumber !== undefined ? blockNumber : log?.blockNumber,
  };

  const txHash = String(merged.transactionHash || "").trim().toLowerCase();
  if (!txHash) {
    console.error("❌ Queue failure: missing transactionHash on deposit job payload");
    throw new Error("enqueueDepositJob: transactionHash required");
  }

  const addOpts = {
    ...DEPOSIT_JOB_OPTIONS,
    jobId: txHash,
  };

  try {
    const job = await depositQueue.add(
      "deposit",
      { log: merged, blockNumber: merged.blockNumber },
      addOpts,
    );
    if (process.env.NODE_ENV !== "production") {
      console.log("📦 Job queued:", txHash);
    }
    return job;
  } catch (err) {
    const msg = err?.message || String(err);
    if (/already exists|duplicate|JobId/i.test(msg)) {
      if (process.env.NODE_ENV !== "production") {
        console.log("📦 Duplicate job skipped (queue):", txHash);
      }
      return null;
    }
    console.error("❌ Queue failure:", msg);
    throw err;
  }
}
