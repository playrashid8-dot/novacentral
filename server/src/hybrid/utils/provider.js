import { JsonRpcProvider } from "ethers";
import {
  getRPC,
  getRpcUrls as getRpcUrlsFromConfig,
  getRPCIndex,
  setRPCIndex,
  switchRPC as rotateRPC,
} from "../../config/rpc.js";

/** WebSocket — HYBRID_BSC_WS_URL or BSC_WS_URL — see hybrid/utils/wsProvider.js */
export {
  getWsProvider,
  whenWsProviderReady,
  verifyWsConnectivityAndLog,
  destroyHybridWsProvider,
} from "./wsProvider.js";

function computeUniqueRpcUrls() {
  return getRpcUrlsFromConfig();
}

/** Financial safety favors immediate failover over sticking to a degraded RPC. */
const SWITCH_AFTER_CONSECUTIVE_FAILURES = 1;

let consecutiveRpcFailures = 0;

/** True after startup probe if a non-primary URL was selected, or after runtime switch away from index 0 */
let rpcFallbackUsedSession = false;

let cachedJsonRpcProvider = null;
let cachedJsonRpcUrl = null;

export const getRpcUrls = () => [...computeUniqueRpcUrls()];

export const getCurrentRpcUrl = () => getRPC();

export const getRpcFallbackUsed = () => rpcFallbackUsedSession;

export const getProvider = () => {
  const urls = computeUniqueRpcUrls();
  if (urls.length === 0) {
    throw new Error("HYBRID_BSC_RPC_URL or BSC_RPC_URL is required for BSC provider access");
  }
  const url = getRPC();
  if (!cachedJsonRpcProvider || cachedJsonRpcUrl !== url) {
    try {
      cachedJsonRpcProvider?.destroy?.();
    } catch (_) {
      /* ignore */
    }
    cachedJsonRpcProvider = new JsonRpcProvider(url);
    cachedJsonRpcUrl = url;
  }
  return cachedJsonRpcProvider;
};

const switchRpc = () => {
  const urls = computeUniqueRpcUrls();
  if (urls.length === 0) {
    return;
  }
  const prev = getRPCIndex();
  if (process.env.NODE_ENV !== "production") {
    console.log("🔁 Switching RPC...");
  }
  rotateRPC();
  const next = getRPCIndex();
  if (process.env.NODE_ENV !== "production") {
    console.log("   Using:", urls[next]);
  }
  if (prev !== next && next !== 0) {
    rpcFallbackUsedSession = true;
    if (process.env.NODE_ENV !== "production") {
      console.log("RPC Fallback Used ⚠️");
    }
  }
  cachedJsonRpcUrl = null;
  try {
    cachedJsonRpcProvider?.destroy?.();
  } catch (_) {
    /* ignore */
  }
  cachedJsonRpcProvider = null;
};

/** Enough attempts to allow multiple strikes per RPC before rotation + failover chain */
const defaultRetries = () => {
  const n = computeUniqueRpcUrls().length;
  return Math.max(24, n * SWITCH_AFTER_CONSECUTIVE_FAILURES * 3);
};

export const withProviderRetry = async (fn, retries = null) => {
  if (computeUniqueRpcUrls().length === 0) {
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

/**
 * Pick first working RPC via getBlockNumber + getNetwork; updates current index for scans.
 * @returns {Promise<boolean>}
 */
export async function initializeHybridRpc() {
  const urls = computeUniqueRpcUrls();
  if (urls.length === 0) {
    console.error("❌ RPC Failed ❌", "No HYBRID_BSC_RPC_URL / BSC_RPC_URL configured");
    return false;
  }

  rpcFallbackUsedSession = false;

  for (let i = 0; i < urls.length; i += 1) {
    setRPCIndex(i);
    cachedJsonRpcUrl = null;
    try {
      cachedJsonRpcProvider?.destroy?.();
    } catch (_) {
      /* ignore */
    }
    cachedJsonRpcProvider = null;

    try {
      const p = getProvider();
      const block = await p.getBlockNumber();
      const net = await p.getNetwork();
      console.log("RPC Connected ✅", `chainId=${net.chainId}`, `block=${block}`);
      if (i > 0) {
        rpcFallbackUsedSession = true;
        console.log("RPC Fallback Used ⚠️");
      }
      return true;
    } catch (err) {
      console.error("❌ RPC Failed ❌", urls[i], err?.message || String(err));
    }
  }

  console.error("❌ RPC Failed ❌", "All RPC endpoints failed probe (getBlockNumber / getNetwork)");
  setRPCIndex(0);
  cachedJsonRpcUrl = null;
  try {
    cachedJsonRpcProvider?.destroy?.();
  } catch (_) {
    /* ignore */
  }
  cachedJsonRpcProvider = null;
  return false;
};

export const checkRpcHealth = async () => {
  if (computeUniqueRpcUrls().length === 0) {
    return false;
  }
  try {
    await withProviderRetry((p) => p.getBlockNumber(), Math.max(6, computeUniqueRpcUrls().length * 3));
    return true;
  } catch (err) {
    console.error("❌ RPC Failed ❌", err?.message || String(err));
    return false;
  }
};

export default getProvider;
