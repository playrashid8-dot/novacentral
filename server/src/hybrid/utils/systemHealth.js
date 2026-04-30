import mongoose from "mongoose";
import { getReadyRedis } from "../../config/redis.js";
import { depositQueue } from "../../queues/depositQueue.js";
import { checkRpcHealth } from "./provider.js";
import PendingDeposit from "../models/PendingDeposit.js";
import HybridWithdrawal from "../models/HybridWithdrawal.js";
import { getHybridWithdrawExecutorStatus } from "../engine/index.js";

const WORKER_HEARTBEAT_KEY = "depositQueue:worker:heartbeat";
const WORKER_HEARTBEAT_MAX_AGE_MS = 120000;

export async function getSystemHealth() {
  const mongo = mongoose.connection.readyState === 1;
  const redis = getReadyRedis();

  let redisOk = false;
  let workerHeartbeat = null;
  let workerOk = false;
  let queueLag = null;
  let queueOk = false;

  if (redis) {
    try {
      redisOk = (await redis.ping()) === "PONG";
      workerHeartbeat = Number(await redis.get(WORKER_HEARTBEAT_KEY));
      workerOk =
        Number.isFinite(workerHeartbeat) &&
        workerHeartbeat > 0 &&
        Date.now() - workerHeartbeat <= WORKER_HEARTBEAT_MAX_AGE_MS;
    } catch (_) {
      redisOk = false;
    }
  }

  if (redis && depositQueue) {
    try {
      const counts = await depositQueue.getJobCounts(
        "waiting",
        "delayed",
        "active",
        "failed"
      );
      queueLag =
        Number(counts.waiting || 0) +
        Number(counts.delayed || 0) +
        Number(counts.active || 0);
      queueOk = true;
    } catch (_) {
      queueOk = false;
    }
  }

  let rpcOk = false;
  try {
    rpcOk = await checkRpcHealth();
  } catch (_) {
    rpcOk = false;
  }

  let pendingDeposits = null;
  let failedPayouts = null;
  let approvedPayouts = null;
  if (mongo) {
    try {
      [pendingDeposits, failedPayouts, approvedPayouts] = await Promise.all([
        PendingDeposit.countDocuments({ status: "pending" }),
        HybridWithdrawal.countDocuments({
          status: "approved",
          payoutStatus: "failed",
        }),
        HybridWithdrawal.countDocuments({
          status: "approved",
          paidAt: null,
        }),
      ]);
    } catch (_) {
      pendingDeposits = null;
      failedPayouts = null;
      approvedPayouts = null;
    }
  }

  const requireRedis = String(process.env.REQUIRE_REDIS || "").toLowerCase() === "true";
  const requireWorker =
    String(process.env.REQUIRE_DEPOSIT_WORKER || "").toLowerCase() === "true";
  const payoutConfigured = Boolean(
    String(process.env.HYBRID_PAYOUT_PRIVATE_KEY || "").trim() &&
      String(process.env.HYBRID_USDT_CONTRACT || "").trim()
  );
  const executor = {
    enabled: payoutConfigured,
    ...getHybridWithdrawExecutorStatus(),
    approvedQueue: approvedPayouts,
  };
  const criticalFailures = [
    !mongo ? "mongo" : null,
    !rpcOk ? "rpc" : null,
    !payoutConfigured ? "withdraw_payout" : null,
    requireRedis && !redisOk ? "redis" : null,
    requireWorker && !workerOk ? "worker" : null,
  ].filter(Boolean);

  return {
    status: criticalFailures.length > 0 ? "degraded" : "ok",
    criticalFailures,
    checks: {
      mongo,
      redis: redisOk,
      workerHeartbeat: workerOk,
      rpc: rpcOk,
      queue: queueOk,
      withdrawPayout: payoutConfigured,
    },
    queueLag,
    pendingDeposits,
    failedPayouts,
    executor,
    workerHeartbeatAgeMs:
      Number.isFinite(workerHeartbeat) && workerHeartbeat > 0
        ? Date.now() - workerHeartbeat
        : null,
  };
}
