import { id, Interface } from "ethers";

import User from "../../models/User.js";
import {
  processDepositLog,
  CONFIRMATIONS,
  getLastProcessedBlock,
  saveLastProcessedBlock,
} from "./depositListener.js";
import { BSC_USDT_ABI } from "../utils/constants.js";
import {
  getRpcUrls,
  withProviderRetry,
} from "../utils/provider.js";
import {
  describeHybridEarnDisabledReason,
  isHybridEarnEnabled,
} from "../utils/hybridEarnEnv.js";
import {
  connectRedisInBackground,
  getRedis,
  isRedisReady,
} from "../../config/redis.js";

const TRANSFER_TOPIC = id("Transfer(address,address,uint256)");
const transferIface = new Interface(BSC_USDT_ABI);

const decodeTopicAddress = (topic = "") =>
  `0x${String(topic).slice(-40).toLowerCase()}`;

const REORG_BUFFER = 5;

const shouldAbortRecoveryChunk = (result) =>
  Boolean(
    result?.creditFailure ||
      (result?.holdCheckpoint &&
        result?.processedDelta === 0 &&
        result?.queued !== true)
  );

/** Distributed recovery lock + ops telemetry (read by `/system/health`). */
export const DEPOSIT_RECOVERY_LOCK_KEY = "deposit:recovery:lock";
export const DEPOSIT_RECOVERY_LAST_RUN_AT_KEY = "deposit:recovery:lastRunAt";
export const DEPOSIT_RECOVERY_LAST_CHECKPOINT_KEY =
  "deposit:recovery:lastCheckpoint";
export const DEPOSIT_RECOVERY_HEARTBEAT_KEY = "deposit:recovery:heartbeat";

const RECOVERY_LOCK_TTL_SEC = 300;
const RECOVERY_HEARTBEAT_TTL_SEC = 600;
const RECOVERY_STALL_MS = 60000;
/** Health warns when lock is held but heartbeat is older than this (ms). */
const RECOVERY_HEARTBEAT_STALE_MS = 90000;

/**
 * Snapshot for health checks (Redis optional — falls back to DB checkpoint).
 */
export async function getDepositRecoveryHealth(dbLastProcessedBlock) {
  const redis = getRedis();
  const prepared =
    redis && !isRedisReady(redis)
      ? await connectRedisInBackground().catch(() => null)
      : redis;

  const resolvedRedis = prepared && isRedisReady(prepared) ? prepared : null;

  const base = {
    running: false,
    lastRunAt: null,
    lastProcessedBlock:
      dbLastProcessedBlock != null && Number.isFinite(Number(dbLastProcessedBlock))
        ? Number(dbLastProcessedBlock)
        : null,
    warning: null,
  };

  if (!resolvedRedis) {
    return base;
  }

  try {
    const [lockHeld, lastRunStr, cpStr, hbStr] = await Promise.all([
      resolvedRedis.exists(DEPOSIT_RECOVERY_LOCK_KEY),
      resolvedRedis.get(DEPOSIT_RECOVERY_LAST_RUN_AT_KEY),
      resolvedRedis.get(DEPOSIT_RECOVERY_LAST_CHECKPOINT_KEY),
      resolvedRedis.get(DEPOSIT_RECOVERY_HEARTBEAT_KEY),
    ]);

    const lastRunAt =
      lastRunStr != null && lastRunStr !== ""
        ? Number(lastRunStr)
        : null;
    const redisCp =
      cpStr != null && cpStr !== "" && Number.isFinite(Number(cpStr))
        ? Number(cpStr)
        : null;

    let warning = null;
    if (lockHeld && hbStr != null && hbStr !== "") {
      const hb = Number(hbStr);
      if (Number.isFinite(hb) && Date.now() - hb > RECOVERY_HEARTBEAT_STALE_MS) {
        warning =
          "Deposit recovery holds lock but heartbeat is stale — recovery may be stalled or RPC hung";
      }
    }

    return {
      running: Boolean(lockHeld),
      lastRunAt: Number.isFinite(lastRunAt) ? lastRunAt : null,
      lastProcessedBlock: redisCp ?? base.lastProcessedBlock,
      warning,
    };
  } catch (_) {
    return base;
  }
}

async function touchRecoveryLockAndHeartbeat(redis) {
  const now = String(Date.now());
  await redis.set(
    DEPOSIT_RECOVERY_HEARTBEAT_KEY,
    now,
    "EX",
    RECOVERY_HEARTBEAT_TTL_SEC
  );
  await redis.expire(DEPOSIT_RECOVERY_LOCK_KEY, RECOVERY_LOCK_TTL_SEC);
}

/**
 * Full checkpoint recovery: every confirmed block from stored checkpoint → chain tip.
 * Batched getLogs, advances checkpoint only after each chunk succeeds (resumable after crash).
 */
export async function runFullRecoveryScan() {
  if (!isHybridEarnEnabled()) {
    console.warn(
      "🔁 Full recovery skipped:",
      describeHybridEarnDisabledReason()
    );
    return;
  }
  if (getRpcUrls().length === 0) {
    console.warn("🔁 Full recovery skipped: no RPC URLs");
    return;
  }
  const usdt = String(process.env.HYBRID_USDT_CONTRACT || "").trim();
  if (!usdt) {
    console.warn("🔁 Full recovery skipped: HYBRID_USDT_CONTRACT missing");
    return;
  }

  await connectRedisInBackground().catch(() => null);
  const redis = getRedis();
  if (!redis || !isRedisReady(redis)) {
    console.error(
      "❌ Full recovery skipped: Redis unavailable — distributed lock required"
    );
    return;
  }

  const lockAcquired = await redis.set(
    DEPOSIT_RECOVERY_LOCK_KEY,
    "1",
    "NX",
    "EX",
    RECOVERY_LOCK_TTL_SEC
  );
  if (lockAcquired !== "OK") {
    console.log("⏭️ Recovery already running — skipping");
    return;
  }

  let lockHeld = true;

  try {
    const BATCH_SIZE = Math.max(
      50,
      Math.min(
        2000,
        Number(process.env.HYBRID_FULL_RECOVERY_BATCH_SIZE || 500) || 500
      )
    );

    const stored = await getLastProcessedBlock();
    let from = Math.max(0, stored + 1 - REORG_BUFFER);
    const startBlock = from;
    let lastProgressTime = Date.now();

    console.log("🔁 FULL RECOVERY START", {
      checkpointStored: stored,
      firstBlock: from,
      batchSize: BATCH_SIZE,
    });

    while (true) {
      const now = Date.now();
      if (now - lastProgressTime > RECOVERY_STALL_MS) {
        console.error(
          "❌ Recovery stalled — exiting loop (no checkpoint progress)"
        );
        break;
      }

      await touchRecoveryLockAndHeartbeat(redis);

      const chainTip = await withProviderRetry((p) => p.getBlockNumber());
      const latest = Math.max(0, chainTip - CONFIRMATIONS);

      if (from > latest) {
        console.log("🎯 FULL RECOVERY COMPLETE", {
          throughBlock: latest,
          chainTip,
        });
        lastProgressTime = Date.now();
        break;
      }

      const to = Math.min(from + BATCH_SIZE, latest);

      let logs;
      try {
        logs = await withProviderRetry((provider) =>
          provider.getLogs({
            address: usdt,
            fromBlock: from,
            toBlock: to,
            topics: [TRANSFER_TOPIC],
          })
        );
      } catch (err) {
        console.error(
          "❌ Full recovery chunk RPC error:",
          err?.message || String(err),
          { from, to }
        );
        await new Promise((r) => setTimeout(r, 2500));
        continue;
      }

      // RPC advanced — avoids false stall while chunk processing is slow (large logs).
      lastProgressTime = Date.now();

      const toAddresses = [
        ...new Set(
          logs
            .map((log) => decodeTopicAddress(log.topics?.[2]).toLowerCase())
            .filter((a) => a && a !== "0x")
        ),
      ];

      let usersByWallet = new Map();
      if (toAddresses.length > 0) {
        const users = await User.find({
          walletAddress: { $in: toAddresses },
        })
          .select("_id walletAddress")
          .lean();

        usersByWallet = new Map(
          users.map((u) => [
            String(u.walletAddress || "").trim().toLowerCase(),
            u,
          ])
        );
      }

      let chunkAborted = false;
      for (const log of logs) {
        const result = await processDepositLog(log, transferIface, usersByWallet, {
          skipQueue: false,
          fullRecovery: true,
        });
        if (shouldAbortRecoveryChunk(result)) {
          chunkAborted = true;
          console.error(
            "⏸️ Full recovery paused (defer/fail) — will resume on next start",
            {
              fromBlock: from,
              toBlock: to,
              txHash: String(log.transactionHash || "").toLowerCase(),
            }
          );
          break;
        }
      }

      if (chunkAborted) {
        break;
      }

      const checkpointHasConfirmationDepth = chainTip >= to + CONFIRMATIONS;
      if (!checkpointHasConfirmationDepth) {
        console.warn("⏸️ Full recovery: tip not deep enough to seal chunk", {
          to,
          chainTip,
        });
        break;
      }

      try {
        await saveLastProcessedBlock(to);
      } catch (err) {
        console.error(
          "❌ Full recovery checkpoint save failed:",
          err?.message || String(err)
        );
        break;
      }

      await redis.set(DEPOSIT_RECOVERY_LAST_CHECKPOINT_KEY, String(to));

      const span = Math.max(1, latest - startBlock);
      const done = Math.min(Math.max(0, to - startBlock), span);
      const progress = ((done / span) * 100).toFixed(2);
      console.log(`📊 Recovery progress: ${progress}%`);
      console.log("✅ Recovery chunk processed", {
        from,
        to,
        logCount: logs.length,
      });

      lastProgressTime = Date.now();
      from = to + 1;
    }
  } catch (err) {
    console.error("❌ Recovery crashed:", err?.message || String(err));
  } finally {
    try {
      await redis.set(
        DEPOSIT_RECOVERY_LAST_RUN_AT_KEY,
        String(Date.now())
      );
    } catch (e) {
      console.error(
        "❌ Recovery telemetry (lastRunAt) failed:",
        e?.message || String(e)
      );
    }
    if (lockHeld) {
      try {
        await redis.del(DEPOSIT_RECOVERY_LOCK_KEY);
      } catch (e) {
        console.error(
          "❌ Recovery lock release failed:",
          e?.message || String(e)
        );
      }
    }
  }
}

async function fetchUsdtTransferLogs(fromBlock, toBlock) {
  const address = String(process.env.HYBRID_USDT_CONTRACT || "").trim();
  if (!address) return [];
  return withProviderRetry((provider) =>
    provider.getLogs({
      address,
      fromBlock,
      toBlock,
      topics: [TRANSFER_TOPIC],
    })
  );
}

async function processLogsThroughPipeline(logs) {
  const toAddresses = [
    ...new Set(
      logs
        .map((log) => decodeTopicAddress(log.topics?.[2]).toLowerCase())
        .filter((a) => a && a !== "0x")
    ),
  ];

  if (toAddresses.length === 0) {
    return;
  }

  const users = await User.find({
    walletAddress: { $in: toAddresses },
  })
    .select("_id walletAddress")
    .lean();

  const usersByWallet = new Map(
    users.map((u) => [
      String(u.walletAddress || "").trim().toLowerCase(),
      u,
    ])
  );

  for (const log of logs) {
    await processDepositLog(log, transferIface, usersByWallet, {
      skipQueue: false,
    });
  }
}

/**
 * Startup: full checkpoint → tip recovery (no block cap).
 */
export async function runDepositBackfillOnStartup() {
  await runFullRecoveryScan();
}

/**
 * Periodic catch-up: last 20 confirmed blocks (websocket / downtime gaps).
 */
export async function runDepositTailRescan20Blocks() {
  if (!isHybridEarnEnabled()) {
    return;
  }
  if (getRpcUrls().length === 0) {
    return;
  }
  if (!String(process.env.HYBRID_USDT_CONTRACT || "").trim()) {
    return;
  }

  try {
    const chainTip = await withProviderRetry((p) => p.getBlockNumber());
    const latestBlock = Math.max(0, chainTip - CONFIRMATIONS);
    const fromBlock = Math.max(0, latestBlock - 19);

    const logs = await fetchUsdtTransferLogs(fromBlock, latestBlock);
    if (logs.length > 0) {
      console.log(`🔁 Tail rescan (${logs.length} logs, blocks ${fromBlock}–${latestBlock})`);
    }
    await processLogsThroughPipeline(logs);
  } catch (err) {
    console.error(
      "❌ Tail rescan failed:",
      err?.message || String(err)
    );
  }
}

let safetyRescanIntervalId = null;

/** Every 60s: re-scan last 20 blocks (complements WebSocket listener). */
export function startDepositSafetyRescanInterval() {
  if (safetyRescanIntervalId != null) {
    return;
  }
  if (!isHybridEarnEnabled()) {
    return;
  }

  safetyRescanIntervalId = setInterval(() => {
    void runDepositTailRescan20Blocks();
  }, 60_000);
}
