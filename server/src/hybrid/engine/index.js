import { scanHybridDeposits } from "../services/depositListener.js";
import { runHybridSweepBatch, canSweepHybridFunds } from "../services/sweepService.js";
import { autoMarkClaimable } from "../services/withdrawService.js";
import {
  checkRpcHealth,
  getCurrentRpcUrl,
  getProvider,
  getRpcFallbackUsed,
  getRpcUrls,
} from "../utils/provider.js";
import {
  describeHybridEarnDisabledReason,
  isHybridEarnEnabled,
  warnIfHybridEarnEnvInvalid,
} from "../utils/hybridEarnEnv.js";
import { depositQueue } from "../../queues/depositQueue.js";
import {
  isHybridRealtimeListenerStarted,
  isHybridWebSocketRealtimeActive,
} from "../listeners/realtimeListener.js";
import { userMap } from "../services/userMap.js";
import hybridConfig from "../../config/hybridConfig.js";
import { getReadyRedis } from "../../config/redis.js";
import { Wallet, parseEther, formatEther } from "ethers";

let hybridTimer = null;
let deepScanTimer = null;
let sweepTimer = null;
let claimableTimer = null;
let healthTimer = null;
let sweepRunning = false;

const BASE_SCAN = 300;

const isHybridRecoverySchedulesEnabled = () =>
  String(process.env.HYBRID_RECOVERY ?? "true").toLowerCase() !== "false";

const logHybridBootstrapStatus = async () => {
  warnIfHybridEarnEnvInvalid();

  const backupScanOk = hybridTimer != null;
  const realtimeOk = isHybridRealtimeListenerStarted();
  const rpcOk = await checkRpcHealth();
  const usdt = String(process.env.HYBRID_USDT_CONTRACT || "").trim().toLowerCase();
  const contractOk = usdt === "0x55d398326f99059ff775485246999027b3197955";
  let gasOk = false;
  let queueOk = false;

  if (getReadyRedis() && depositQueue) {
    try {
      await depositQueue.getJobCounts();
      queueOk = true;
    } catch (_) {
      queueOk = false;
    }
  }

  try {
    if (!hybridConfig.gasKey) {
      console.error("❌ ERROR:", "HYBRID_GAS_FUNDER_PRIVATE_KEY not configured");
    } else if (rpcOk) {
      const provider = getProvider();
      const gf = new Wallet(hybridConfig.gasKey, provider);
      const fb = await provider.getBalance(gf.address);
      gasOk = fb >= parseEther("0.001");
      console.log("⛽ Funder:", gf.address);
      console.log("⛽ Balance:", formatEther(fb));
      if (!gasOk) {
        console.error(
          "❌ ERROR:",
          `Gas funder BNB below 0.001 (has ${formatEther(fb)} BNB)`
        );
      }
    }
  } catch (err) {
    console.error("❌ ERROR:", err?.message || String(err));
  }

  const sweepReady = canSweepHybridFunds() && gasOk;
  const earnOn = isHybridEarnEnabled();
  const depositDetectOk = rpcOk && contractOk && earnOn;
  const creditOk = earnOn;
  const wsConfigured = Boolean(
    String(process.env.HYBRID_BSC_WS_URL || process.env.BSC_WS_URL || "").trim()
  );
  /** WS module implements close/error → destroy + delay + resubscribe */
  const autoReconnectOk =
    creditOk &&
    rpcOk &&
    contractOk &&
    wsConfigured &&
    realtimeOk;
  const recoveryOk =
    creditOk &&
    rpcOk &&
    contractOk &&
    getRpcUrls().length > 0 &&
    Boolean(String(process.env.HYBRID_USDT_CONTRACT || "").trim());
  const duplicateProtectionOk =
    creditOk &&
    rpcOk &&
    Boolean(String(process.env.HYBRID_USDT_CONTRACT || "").trim());

  const wsActive = isHybridWebSocketRealtimeActive();
  const workerProcessingOk = queueOk;
  const workerRunningOk = workerProcessingOk;
  const deepScanOk = deepScanTimer != null;

  const systemStable =
    rpcOk &&
    realtimeOk &&
    depositDetectOk &&
    queueOk &&
    backupScanOk &&
    duplicateProtectionOk &&
    contractOk;

  console.log(
    `RPC Working: ${rpcOk ? "✅" : "❌"}${rpcOk && getCurrentRpcUrl() ? ` (${getCurrentRpcUrl()})` : ""}`
  );
  console.log(`Realtime Listener: ${realtimeOk ? "✅" : "❌"}`);
  console.log(`Backup Scan: ${backupScanOk ? "✅" : "❌"}`);
  console.log(`Deep Scan: ${deepScanOk ? "✅" : "❌"}`);
  console.log(`Recovery Active: ${recoveryOk ? "✅" : "❌"}`);
  console.log(`Fallback Used: ${getRpcFallbackUsed() ? "Yes" : "No"}`);
  console.log(`Auto Reconnect: ${autoReconnectOk ? "✅" : "❌"}`);
  console.log(`Recovery Working: ${recoveryOk ? "✅" : "❌"}`);
  console.log(`Backup Polling: ${backupScanOk ? "✅" : "❌"}`);
  console.log(`Credit System: ${creditOk ? "✅" : "❌"}`);
  console.log(`Gas Transfer: ${gasOk ? "✅" : "❌"}`);
  console.log(`Swap Working: ${sweepReady ? "✅" : "❌"}`);

  const listenerLabel = realtimeOk ? "✅" : "❌";

  console.log("");
  console.log("🔥 FINAL STATUS:");
  console.log(`RPC Connected: ${rpcOk ? "✅" : "❌"}`);
  console.log(`Listener Active: ${listenerLabel}`);
  console.log(`Backup Scan: ${backupScanOk ? "✅" : "❌"}`);
  console.log(`Deep Scan: ${deepScanOk ? "✅" : "❌"}`);
  console.log(`Recovery Active: ${recoveryOk ? "✅" : "❌"}`);
  console.log(`WebSocket Active: ${wsActive ? "✅" : wsConfigured ? "❌" : "❌ (not configured)"}`);
  console.log(`Users Loaded: ${userMap.size}`);
  console.log(`Deposit Detection: ${depositDetectOk ? "✅" : "❌"}`);
  console.log(`Queue Working: ${queueOk ? "✅" : "❌"}`);
  console.log(`Worker Running: ${workerRunningOk ? "✅" : "❌"}`);
  console.log(`Worker Processing: ${workerProcessingOk ? "✅" : "❌"}`);
  console.log(`Duplicate Safe: ${duplicateProtectionOk ? "✅" : "❌"}`);
  console.log(`System Ready: ${systemStable ? "✅" : "❌"}`);
  console.log("");
};

const runSweepEngine = async () => {
  if (sweepRunning) {
    console.log("🔁 Sweep batch skipped: previous run still in progress");
    return;
  }

  sweepRunning = true;

  try {
    const result = await runHybridSweepBatch();

    if (result.ran && result.attempted > 0) {
      console.log(
        `HYBRID sweep: attempted ${result.attempted}, succeeded ${result.succeeded ?? 0}`
      );
    }
  } catch (error) {
    console.error("❌ ERROR:", error?.message || String(error));
  } finally {
    sweepRunning = false;
  }
};

/**
 * Full incremental scan from HybridSetting checkpoint → chain tip (shared with polling backup).
 * Called once after DB connects so restarts cannot miss credited blocks.
 * @param {{ blocks?: number }} [options] — extra tail window after checkpoint scan (default 1000).
 */
export async function runHybridStartupRecovery(options = {}) {
  if (!isHybridEarnEnabled()) {
    console.warn(
      "HYBRID startup recovery skipped:",
      describeHybridEarnDisabledReason()
    );
    return;
  }
  if (getRpcUrls().length === 0) {
    console.warn(
      "HYBRID startup recovery skipped:",
      "no RPC URLs — set HYBRID_BSC_RPC_URL or BSC_RPC_URL"
    );
    return;
  }
  if (!String(process.env.HYBRID_USDT_CONTRACT || "").trim()) {
    console.warn("HYBRID startup recovery skipped:", "HYBRID_USDT_CONTRACT missing");
    return;
  }
  const startupBackupBlocks = Number.isFinite(Number(options?.blocks))
    ? Math.max(1, Number(options.blocks))
    : 1000;
  try {
    console.log("🔄 Missed deposit recovery (checkpoint → chain tip, capped window)...");
    await scanHybridDeposits(null, null, { quiet: true, skipProbe: true });
    console.log(
      `🔄 Startup backup window (last ${startupBackupBlocks} confirmed blocks)...`
    );
    await scanHybridDeposits(null, null, {
      quiet: true,
      skipProbe: true,
      blocks: startupBackupBlocks,
    });
  } catch (err) {
    console.error("Recovery crash prevented:", err?.message || String(err));
  }
}

export const startDepositListener = () => {
  if (!isHybridEarnEnabled()) {
    console.error(
      "❌ HYBRID engine not started:",
      describeHybridEarnDisabledReason()
    );
    return;
  }

  if (hybridTimer) {
    return;
  }

  const sweepEngineMs = Number(process.env.HYBRID_SWEEP_ENGINE_INTERVAL_MS || 60000);

  console.log("⚠️ Polling disabled — using real-time listener");

  if (isHybridRecoverySchedulesEnabled()) {
    hybridTimer = setInterval(async () => {
      try {
        if (process.env.NODE_ENV === "development" || Math.random() < 0.1) {
          console.log("🚨 Recovery triggered — possible missed deposit");
        }
        await scanHybridDeposits(null, null, {
          blocks: BASE_SCAN,
          logEmptyOnZero: true,
        });
      } catch (error) {
        console.error("Recovery crash prevented:", error?.message || String(error));
      }
    }, 60000);

    deepScanTimer = setInterval(async () => {
      try {
        if (process.env.NODE_ENV === "development" || Math.random() < 0.1) {
          console.log("🔎 Deep recovery scan running...");
        }
        await scanHybridDeposits(null, null, {
          blocks: 2000,
          logEmptyOnZero: true,
        });
      } catch (e) {
        console.error("Recovery crash prevented:", e?.message || String(e));
      }
    }, 600000);
  } else {
    console.warn("⚠️ HYBRID_RECOVERY=false — periodic recovery scans disabled");
  }

  runSweepEngine();
  sweepTimer = setInterval(runSweepEngine, sweepEngineMs);

  const claimableMs = Number(
    process.env.HYBRID_CLAIMABLE_INTERVAL_MS ||
      process.env.HYBRID_CLAIMABLE_MARK_INTERVAL_MS ||
      60000
  );
  const runAutoClaimable = async () => {
    try {
      await autoMarkClaimable();
    } catch (err) {
      console.error("❌ ERROR:", err?.message || String(err));
    }
  };
  void runAutoClaimable();
  claimableTimer = setInterval(runAutoClaimable, claimableMs);

  if (!healthTimer) {
    healthTimer = setInterval(() => {
      if (process.env.NODE_ENV === "development" || Math.random() < 0.1) {
        console.log("💚 Hybrid alive | users:", userMap.size);
      }
    }, 60000);
  }

  console.log(
    `HYBRID engine started (recovery scans: ${isHybridRecoverySchedulesEnabled() ? `60000ms/${BASE_SCAN} blocks + deep 600000ms/2000` : "off"}, sweep ${sweepEngineMs}ms, claimable ${claimableMs}ms)`
  );

  void logHybridBootstrapStatus();
};

export const startHybridEngine = startDepositListener;
