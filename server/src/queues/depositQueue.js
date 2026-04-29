import { Queue } from "bullmq";
import { redis } from "../config/redis.js";

export const depositQueue = new Queue("depositQueue", {
  connection: redis,
});

/** Shared BullMQ options for deposit jobs (retries / backoff). */
export const DEPOSIT_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 5000,
  },
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
  };
}

/**
 * @param {{ log: object, blockNumber?: number }} payload
 */
export async function enqueueDepositJob({ log, blockNumber }) {
  const merged = {
    ...log,
    blockNumber: blockNumber !== undefined ? blockNumber : log?.blockNumber,
  };

  const job = await depositQueue.add(
    "processDeposit",
    { log: merged, blockNumber: merged.blockNumber },
    DEPOSIT_JOB_OPTIONS,
  );

  console.log("📦 Job queued:", merged.transactionHash);
  return job;
}
