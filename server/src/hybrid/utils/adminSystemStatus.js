import mongoose from "mongoose";
import { checkRpcHealth } from "./provider.js";
import {
  isHybridRealtimeListenerStarted,
  isHybridWebSocketRealtimeActive,
} from "../listeners/realtimeListener.js";
import { userMap } from "../services/userMap.js";
import { depositQueue } from "../../queues/depositQueue.js";
import { getRedis } from "../../config/redis.js";

const WORKER_HEARTBEAT_KEY = "depositQueue:worker:heartbeat";
const WORKER_HEARTBEAT_MAX_AGE_MS = 120000;

/**
 * Live hybrid health for admin dashboards (no schema / ROI changes).
 * `workerActive` reflects the dedicated BullMQ worker heartbeat written through Redis.
 */
export async function getHybridAdminSystemStatus() {
  const mongodb = mongoose.connection.readyState === 1;

  let redisOk = false;
  const redis = getRedis();
  if (redis) {
    try {
      const pong = await redis.ping();
      redisOk = pong === "PONG";
    } catch (_) {
      redisOk = false;
    }
  }

  let rpc = false;
  try {
    rpc = await checkRpcHealth();
  } catch (_) {
    rpc = false;
  }

  const listener = isHybridRealtimeListenerStarted();
  const websocket = isHybridWebSocketRealtimeActive();
  const usersLoaded = userMap.size;

  let queueWorking = false;
  let workerActive = false;
  if (depositQueue) {
    try {
      await depositQueue.getJobCounts();
      queueWorking = true;
    } catch (_) {
      queueWorking = false;
    }
  }

  if (redisOk && redis) {
    try {
      const heartbeat = Number(await redis.get(WORKER_HEARTBEAT_KEY));
      workerActive =
        Number.isFinite(heartbeat) &&
        heartbeat > 0 &&
        Date.now() - heartbeat <= WORKER_HEARTBEAT_MAX_AGE_MS;
    } catch (_) {
      workerActive = false;
    }
  }

  return {
    mongodb,
    redis: redisOk,
    rpc,
    listener,
    websocket,
    usersLoaded,
    queueWorking,
    workerActive,
  };
}
