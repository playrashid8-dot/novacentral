import { scanHybridDeposits } from "../services/depositListener.js";

let hybridTimer = null;
let isRunning = false;

const isEnabled = (value) => String(value).toLowerCase() === "true";

const runListener = async () => {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const result = await scanHybridDeposits();

    if (!result?.skipped) {
      console.log(`HYBRID listener processed ${result.processed || 0} deposits`);
    }
  } catch (error) {
    console.error("HYBRID listener error:", error.message);
  } finally {
    isRunning = false;
  }
};

export const startHybridEngine = () => {
  if (!isEnabled(process.env.HYBRID_EARN_ENABLED)) {
    console.log("HYBRID engine disabled");
    return;
  }

  if (hybridTimer) {
    return;
  }

  const intervalMs = Number(process.env.HYBRID_SWEEP_INTERVAL_MS || 30000);

  runListener();
  hybridTimer = setInterval(runListener, intervalMs);

  console.log(`HYBRID engine started (${intervalMs}ms interval)`);
};
