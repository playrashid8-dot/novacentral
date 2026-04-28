import { JsonRpcProvider } from "ethers";

/** Ordered list: primary env → fallback env → Binance seeds (same provider order every process start) */
const BSC_PUBLIC_SEEDS = [
  "https://bsc-dataseed1.binance.org",
  "https://bsc-dataseed2.binance.org",
];

const RPC_URLS = [
  String(process.env.HYBRID_BSC_RPC_URL || "").trim(),
  String(process.env.HYBRID_BSC_RPC_FALLBACK || "").trim(),
  ...BSC_PUBLIC_SEEDS,
]
  .map((url) => String(url || "").trim())
  .filter(Boolean);

/** Dedupe while preserving priority (first occurrence wins) */
const uniqueRpcs = [...new Set(RPC_URLS)];

let currentIndex = 0;

/** Switch to next RPC only after this many consecutive failures on the current RPC */
const SWITCH_AFTER_CONSECUTIVE_FAILURES = 3;

let consecutiveRpcFailures = 0;

export const getRpcUrls = () => [...uniqueRpcs];

export const getCurrentRpcUrl = () => uniqueRpcs[currentIndex] || "";

export const getProvider = () => {
  if (uniqueRpcs.length === 0) {
    throw new Error("HYBRID_BSC_RPC_URL is required for BSC provider access");
  }
  const url = uniqueRpcs[currentIndex % uniqueRpcs.length];
  return new JsonRpcProvider(url);
};

const switchRpc = () => {
  if (uniqueRpcs.length === 0) {
    return;
  }
  currentIndex = (currentIndex + 1) % uniqueRpcs.length;
  console.log("🔁 Switching RPC →", uniqueRpcs[currentIndex]);
};

/** Enough attempts to allow multiple strikes per RPC before rotation + failover chain */
const defaultRetries = () => Math.max(24, uniqueRpcs.length * SWITCH_AFTER_CONSECUTIVE_FAILURES * 3);

export const withProviderRetry = async (fn, retries = null) => {
  if (uniqueRpcs.length === 0) {
    throw new Error("HYBRID_BSC_RPC_URL is required for BSC provider access");
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
      console.error("RPC failed:", msg);
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
    const provider = getProvider();
    await provider.getBlockNumber();
    return true;
  } catch {
    return false;
  }
};

export const provider = uniqueRpcs.length > 0 ? getProvider() : null;

export default provider;
