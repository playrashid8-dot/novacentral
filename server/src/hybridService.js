/**
 * Dedicated process for WebSocket + hybrid engine (polling/sweep/recovery).
 * Run a single replica in production. API traffic should use NOVA_SERVICE=api replicas.
 */
import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { runHybridStartupRecovery, startHybridEngine } from "./hybrid/engine/index.js";
import { startRealtimeListener } from "./hybrid/listeners/realtimeListener.js";

dotenv.config();

await connectDB();

await startRealtimeListener();
await runHybridStartupRecovery();
startHybridEngine();

const app = express();
const PORT = Number(process.env.PORT) || 5050;

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log("💚 Hybrid service alive:", process.pid);
  console.log(`🔥 Hybrid health on port ${PORT}`);
});
