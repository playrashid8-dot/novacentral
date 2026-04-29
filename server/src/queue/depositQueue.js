import { Queue } from "bullmq";
import { redis } from "./redis.js";

export const depositQueue = new Queue("depositQueue", {
  connection: redis,
});

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000,
  },
};

export async function enqueueDepositJob(data) {
  const job = await depositQueue.add("newDeposit", data, defaultJobOptions);
  console.log("📦 Added to queue");
  return job;
}
