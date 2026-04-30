import { Queue } from "bullmq";
import { getRedis, isRedisReady } from "../config/redis.js";

const connection = getRedis();
const WORKER_HEARTBEAT_KEY = "depositQueue:worker:heartbeat";

/** Shared BullMQ worker / queue tuning: max jobs started per duration (global per queue in Redis). */
export const DEPOSIT_QUEUE_LIMITER = {
  max: 50,
  duration: 1000,
};

function createDepositQueue() {
  if (!connection) {
    return null;
  }

  try {
    return new Queue("depositQueue", {
      connection,
      limiter: DEPOSIT_QUEUE_LIMITER,
    });
  } catch (err) {
    console.error("❌ Deposit queue init failed:", err?.message || String(err));
    return null;
  }
}

export const depositQueue = createDepositQueue();

let depositQueueErrorLogged = false;

depositQueue?.on("error", (err) => {
  if (!isRedisReady(connection)) {
    return;
  }

  if (!depositQueueErrorLogged) {
    depositQueueErrorLogged = true;
    console.error("❌ Deposit queue unavailable:", err?.message || String(err));
  }
});

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
 * @param {{ log: object, blockNumber?: number, skipWorkerHeartbeatCheck?: boolean }} payload
 * @returns {Promise<
 *   | { kind: "queued"; job: import("bullmq").Job | null }
 *   | { kind: "defer" }
 *   | { kind: "direct" }
 * >}
 */
/**
 * Enqueue-first deposit pipeline.
 * - kind "queued": job added (or duplicate job id — still safe).
 * - kind "defer": worker heartbeat missing / Redis read error — DO NOT credit from listener; retry later.
 * - kind "direct": Redis or BullMQ queue unavailable — ONLY then may the listener credit in-process.
 * When skipWorkerHeartbeatCheck is true (full checkpoint recovery), jobs are enqueued so backlog drains when the worker starts — never defer solely on heartbeat.
 */
export async function enqueueDepositJob({
  log,
  blockNumber,
  skipWorkerHeartbeatCheck = false,
}) {
  const redis = getRedis();
  if (!redis || redis.status !== "ready" || !depositQueue) {
    return { kind: "direct" };
  }

  const redisAvailable = await redis.ping().catch(() => null);

  if (!redisAvailable) {
    console.warn("⚠️ Redis DOWN → using direct deposit mode");
    return { kind: "direct" };
  }

  if (!skipWorkerHeartbeatCheck) {
    try {
      const heartbeat = await redis.get(WORKER_HEARTBEAT_KEY);
      if (!heartbeat) {
        console.warn("⏳ Queue warming up, skipping processing...");
        return { kind: "defer" };
      }
    } catch (err) {
      console.warn("⚠️ Deposit queue heartbeat check failed:", err?.message || String(err));
      return { kind: "defer" };
    }
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
    console.log("📦 Deposit queued", { txHash });
    return { kind: "queued", job };
  } catch (err) {
    if (!redis || redis.status !== "ready") {
      return { kind: "direct" };
    }

    const msg = err?.message || String(err);
    if (/already exists|duplicate|JobId/i.test(msg)) {
      console.log("📦 Deposit queued", { txHash, duplicate: true });
      return { kind: "queued", job: null };
    }
    console.error("❌ Queue error:", msg);
    throw err;
  }
}
