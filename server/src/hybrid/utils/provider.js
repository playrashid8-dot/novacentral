import { JsonRpcProvider } from "ethers";

/** WebSocket — HYBRID_BSC_WS_URL or BSC_WS_URL — see hybrid/utils/wsProvider.js */
export { getWsProvider, whenWsProviderReady } from "./wsProvider.js";

/**
 * RPC priority (env only): HYBRID_BSC_RPC_URL or BSC_RPC_URL (main, e.g. NodeReal) →
 * HYBRID_BSC_RPC_FALLBACK (e.g. publicnode) → HYBRID_BSC_RPC_BACKUP (e.g. ankr).
 */
const RPC_URLS = [
  String(process.env.HYBRID_BSC_RPC_URL || process.env.BSC_RPC_URL || "").trim(),
  String(process.env.HYBRID_BSC_RPC_FALLBACK || "").trim(),
  String(process.env.HYBRID_BSC_RPC_BACKUP || "").trim(),
]
  .map((url) => String(url || "").trim())
  .filter(Boolean);

/** Dedupe while preserving priority (first occurrence wins) */
const uniqueRpcs = [...new Set(RPC_URLS)];

let currentIndex = 0;

/** Switch only after several failures — avoids rotating RPC on every chunk/transient -32005 */
const SWITCH_AFTER_CONSECUTIVE_FAILURES = 3;

let consecutiveRpcFailures = 0;

export const getRpcUrls = () => [...uniqueRpcs];

export const getCurrentRpcUrl = () => uniqueRpcs[currentIndex] || "";

export const getProvider = () => {
  if (uniqueRpcs.length === 0) {
    throw new Error("HYBRID_BSC_RPC_URL or BSC_RPC_URL is required for BSC provider access");
  }
  const url = uniqueRpcs[currentIndex % uniqueRpcs.length];
  return new JsonRpcProvider(url);
};

const switchRpc = () => {
  if (uniqueRpcs.length === 0) {
    return;
  }
  console.log("🔁 Switching RPC...");
  currentIndex = (currentIndex + 1) % uniqueRpcs.length;
  console.log("   Using:", uniqueRpcs[currentIndex]);
};

/** Enough attempts to allow multiple strikes per RPC before rotation + failover chain */
const defaultRetries = () => Math.max(24, uniqueRpcs.length * SWITCH_AFTER_CONSECUTIVE_FAILURES * 3);

export const withProviderRetry = async (fn, retries = null) => {
  if (uniqueRpcs.length === 0) {
    throw new Error("HYBRID_BSC_RPC_URL or BSC_RPC_URL is required for BSC provider access");
  }

  const maxAttempts = retries == null ? defaultRetries() : Math.max(1, Number(retries) || 1);
  let lastError;

  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const provider = getProvider();
      const result = await fn(provider);
      consecutiveRpcFailures = 0;
      return result;
    } catch (err) {
      lastError = err;
      const msg = String(err?.message || err || "");
      console.error("❌ ERROR:", msg);
      if (/[-]?32005|limit exceeded|query returned more than|range is too large/i.test(msg)) {
        console.warn(
          "⚠️ RPC rejected eth_getLogs / heavy query (-32005-style) — rotate HYBRID_BSC_RPC_URL or reduce scan range"
        );
      }
      if (/429|rate limit|too many|limit exceeded|exceeded/i.test(msg)) {
        console.warn("⚠️ RPC rate/limit stress detected");
      }
      if (/401|403|unauthorized|not allowed|invalid api key/i.test(msg)) {
        console.warn("⚠️ RPC auth / permission issue — check HYBRID_BSC_RPC_URL credentials");
      }

      consecutiveRpcFailures += 1;
      if (consecutiveRpcFailures >= SWITCH_AFTER_CONSECUTIVE_FAILURES) {
        switchRpc();
        consecutiveRpcFailures = 0;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  throw lastError;
};

export const checkRpcHealth = async () => {
  if (uniqueRpcs.length === 0) {
    return false;
  }
  try {
    await withProviderRetry((p) => p.getBlockNumber(), Math.max(6, uniqueRpcs.length * 3));
    return true;
  } catch (err) {
    console.error("❌ ERROR:", err?.message || String(err));
    return false;
  }
};

export default getProvider;
