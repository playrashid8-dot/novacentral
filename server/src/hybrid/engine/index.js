import { scanHybridDeposits } from "../services/depositListener.js";
import { runHybridSweepBatch } from "../services/sweepService.js";
import { autoMarkClaimable } from "../services/withdrawService.js";

let hybridTimer = null;
let sweepTimer = null;
let claimableTimer = null;
let isRunning = false;
let sweepRunning = false;

const isEnabled = (value) => String(value).toLowerCase() === "true";

const runListener = async () => {
  console.log("🔁 Listener tick...");

  if (isRunning) {
    console.log("🔁 Polling active: previous deposit scan still running");
    return;
  }

  isRunning = true;

  try {
    console.log("🔁 Polling active...");
    const result = await scanHybridDeposits();

    if (!result?.skipped) {
      console.log(`HYBRID listener processed ${result.processed || 0} deposits`);
    }
  } catch (error) {
    console.error("❌ ERROR:", error?.message || String(error));
  } finally {
    isRunning = false;
  }
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

export const startDepositListener = () => {
  if (!isEnabled(process.env.HYBRID_EARN_ENABLED)) {
    console.log("HYBRID engine disabled");
    return;
  }

  if (hybridTimer) {
    return;
  }

  const depositScanMs = Number(
    process.env.HYBRID_DEPOSIT_SCAN_INTERVAL_MS ||
      process.env.HYBRID_SWEEP_INTERVAL_MS ||
      30000
  );
  const sweepEngineMs = Number(process.env.HYBRID_SWEEP_ENGINE_INTERVAL_MS || 60000);

  console.log("🚀 Deposit listener started");

  runListener();
  hybridTimer = setInterval(runListener, depositScanMs);

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

  console.log(
    `HYBRID engine started (deposit scan ${depositScanMs}ms, sweep ${sweepEngineMs}ms, claimable ${claimableMs}ms)`
  );
};

export const startHybridEngine = startDepositListener;
