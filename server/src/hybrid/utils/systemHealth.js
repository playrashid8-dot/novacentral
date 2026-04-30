import mongoose from "mongoose";
import { getReadyRedis } from "../../config/redis.js";
import { depositQueue } from "../../queues/depositQueue.js";
import { checkRpcHealth } from "./provider.js";
import PendingDeposit from "../models/PendingDeposit.js";
import HybridWithdrawal from "../models/HybridWithdrawal.js";
import HybridSetting from "../models/HybridSetting.js";
import { getHybridWithdrawExecutorStatus } from "../engine/index.js";

const WORKER_HEARTBEAT_KEY = "depositQueue:worker:heartbeat";
const WORKER_HEARTBEAT_MAX_AGE_MS = 120000;
/** Stricter “worker responding” signal for ops (nested `worker.alive`). */
const WORKER_ALIVE_MAX_AGE_MS = 60000;
/** Warn when `hybridLastDetectedTxAt` is olderMs than this (deposit silence). */
const DEPOSIT_DETECTION_STALE_MS = Number(
  process.env.DEPOSIT_DETECTION_STALE_MS || 48 * 60 * 60 * 1000
);

export async function getSystemHealth() {
  const mongo = mongoose.connection.readyState === 1;
  const redis = getReadyRedis();

  let redisOk = false;
  let workerHeartbeat = null;
  let workerOk = false;
  let queueLag = null;
  let queueOk = false;
  /** @type {{ active: number; waiting: number; failed: number } | null} */
  let depositQueueStats = null;

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
      const waitingJobs =
        Number(counts.waiting || 0) + Number(counts.delayed || 0);
      const activeJobs = Number(counts.active || 0);
      const failedJobs = Number(counts.failed || 0);
      depositQueueStats = {
        active: activeJobs,
        waiting: waitingJobs,
        failed: failedJobs,
      };
      queueLag = waitingJobs + activeJobs;
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

  let lastProcessedBlock = null;
  let lastDetectedTxTime = null;
  /** @type {string | null} */
  let depositDetectionWarning = null;

  if (mongo) {
    try {
      const [blockDoc, detectedDoc] = await Promise.all([
        HybridSetting.findOne({ key: "hybridLastProcessedBlock" }).lean(),
        HybridSetting.findOne({ key: "hybridLastDetectedTxAt" }).lean(),
      ]);
      const bVal = blockDoc?.value;
      if (bVal !== undefined && bVal !== null && bVal !== "") {
        const n = Number(bVal);
        if (Number.isFinite(n)) lastProcessedBlock = n;
      }
      const dVal = detectedDoc?.value;
      if (dVal !== undefined && dVal !== null && dVal !== "") {
        const ts = Number(dVal);
        if (Number.isFinite(ts) && ts > 0) {
          lastDetectedTxTime = ts;
          const age = Date.now() - ts;
          if (age > DEPOSIT_DETECTION_STALE_MS) {
            depositDetectionWarning =
              "No qualifying deposit events recorded recently — verify RPC, listener, and queue worker";
          }
        }
      }
    } catch (_) {
      lastProcessedBlock = null;
      lastDetectedTxTime = null;
    }
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
  const heartbeatAgeMs =
    Number.isFinite(workerHeartbeat) && workerHeartbeat > 0
      ? Date.now() - workerHeartbeat
      : null;
  const workerNested = {
    heartbeatAgeMs,
    alive:
      heartbeatAgeMs != null && heartbeatAgeMs < WORKER_ALIVE_MAX_AGE_MS,
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
    redis: {
      ok: redisOk,
      required: requireRedis,
      connected: Boolean(redis),
    },
    rpc: {
      ok: rpcOk,
    },
    checks: {
      mongo,
      redis: redisOk,
      workerHeartbeat: workerOk,
      rpc: rpcOk,
      queue: queueOk,
      withdrawPayout: payoutConfigured,
    },
    queueLag,
    depositQueue: depositQueueStats
      ? {
          active: depositQueueStats.active,
          waiting: depositQueueStats.waiting,
          failed: depositQueueStats.failed,
        }
      : {
          active: 0,
          waiting: 0,
          failed: 0,
        },
    worker: workerNested,
    pendingDeposits,
    failedPayouts,
    executor,
    workerHeartbeatAgeMs: heartbeatAgeMs,
    lastProcessedBlock,
    lastDetectedTxTime,
    depositDetectionWarning,
  };
}
