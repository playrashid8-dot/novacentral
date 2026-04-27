import { scanHybridDeposits } from "../services/depositListener.js";
import { runHybridSweepBatch } from "../services/sweepService.js";

let hybridTimer = null;
let sweepTimer = null;
let isRunning = false;
let sweepRunning = false;

const isEnabled = (value) => String(value).toLowerCase() === "true";

const runListener = async () => {
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
    console.error("❌ Deposit listener error:", error);
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
    console.error("❌ Hybrid sweep engine error:", error);
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

  runListener();
  hybridTimer = setInterval(runListener, depositScanMs);

  runSweepEngine();
  sweepTimer = setInterval(runSweepEngine, sweepEngineMs);

  console.log(
    `HYBRID engine started (deposit scan ${depositScanMs}ms, sweep ${sweepEngineMs}ms)`
  );
};

export const startHybridEngine = startDepositListener;
