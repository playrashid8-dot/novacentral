import { JsonRpcProvider } from "ethers";
import hybridConfig from "../../config/hybridConfig.js";

const RPCS = [
  hybridConfig.rpcUrl,
  process.env.HYBRID_BSC_RPC_FALLBACK_1,
  process.env.HYBRID_BSC_RPC_FALLBACK_2,
]
  .map((url) => String(url || "").trim())
  .filter(Boolean);

const uniqueRpcs = [...new Set(RPCS)];
const providerCache = new Map();
let currentRpcIndex = 0;

export const getRpcUrls = () => [...uniqueRpcs];

export const getProvider = () => {
  if (uniqueRpcs.length === 0) {
    throw new Error("HYBRID_BSC_RPC_URL is required for BSC provider access");
  }

  const rpcUrl = uniqueRpcs[currentRpcIndex % uniqueRpcs.length];

  if (!providerCache.has(rpcUrl)) {
    providerCache.set(rpcUrl, new JsonRpcProvider(rpcUrl));
  }

  return providerCache.get(rpcUrl);
};

export const rotateProvider = () => {
  if (uniqueRpcs.length > 1) {
    currentRpcIndex = (currentRpcIndex + 1) % uniqueRpcs.length;
  }

  return getProvider();
};

export const withProviderRetry = async (operation, maxAttempts = 3) => {
  let lastError = null;
  const attempts = Math.max(1, Math.min(Number(maxAttempts) || 3, 3));

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation(getProvider(), attempt);
    } catch (error) {
      lastError = error;

      if (attempt < attempts - 1) {
        rotateProvider();
      }
    }
  }

  throw lastError;
};

export const provider = uniqueRpcs.length > 0 ? getProvider() : null;

export default provider;
