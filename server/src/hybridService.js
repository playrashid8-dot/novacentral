/**
 * Dedicated process for WebSocket + hybrid engine (polling/sweep/recovery).
 * Run a single replica in production. API traffic should use NOVA_SERVICE=api replicas.
 */
import "dotenv/config";
import express from "express";
import connectDB from "./config/db.js";
import { runHybridStartupRecovery, startHybridEngine } from "./hybrid/engine/index.js";
import { startRealtimeListener } from "./hybrid/listeners/realtimeListener.js";

const _hybridWs = String(
  process.env.HYBRID_BSC_WS_URL || process.env.BSC_WS_URL || ""
).trim();
if (!_hybridWs) {
  console.warn(
    "⚠️ HYBRID_BSC_WS_URL (or BSC_WS_URL) missing — realtime will use RPC subscription only"
  );
} else {
  console.log("✅ HYBRID_BSC_WS_URL loaded for realtime deposits");
}

await connectDB();

try {
  await startRealtimeListener();
} catch (err) {
  console.error("Recovery crash prevented:", err?.message || String(err));
}

try {
  await runHybridStartupRecovery({ blocks: 1000 });
} catch (e) {
  console.error("Recovery crash prevented:", e?.message || String(e));
}
startHybridEngine();

const app = express();
const PORT = Number(process.env.PORT) || 5050;

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    msg: "Health check ok",
    data: { status: "ok" },
  });
});

app.listen(PORT, () => {
  console.log("💚 Hybrid service alive:", process.pid);
  console.log(`🔥 Hybrid health on port ${PORT}`);
});
