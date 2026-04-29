import mongoose from "mongoose";
import { checkRpcHealth } from "./provider.js";
import {
  isHybridRealtimeListenerStarted,
  isHybridWebSocketRealtimeActive,
} from "../listeners/realtimeListener.js";
import { userMap } from "../services/userMap.js";
import { depositQueue } from "../../queues/depositQueue.js";
import { redis } from "../../config/redis.js";

/**
 * Live hybrid health for admin dashboards (no schema / ROI changes).
 * `workerActive` reflects Redis/Bull queue reachability from this process; a separate worker
 * process must still be running to drain jobs.
 */
export async function getHybridAdminSystemStatus() {
  const mongodb = mongoose.connection.readyState === 1;

  let redisOk = false;
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
  if (depositQueue) {
    try {
      await depositQueue.getJobCounts();
      queueWorking = true;
    } catch (_) {
      queueWorking = false;
    }
  }

  const workerActive = queueWorking;

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
