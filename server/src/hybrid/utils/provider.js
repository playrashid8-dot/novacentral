import { JsonRpcProvider } from "ethers";

/** Default public endpoints — merged with env so limits/pruned-node errors fail over cleanly */
const DEFAULT_BSC_RPCS = [
  "https://bsc-dataseed.binance.org/",
  "https://rpc.ankr.com/bsc",
  "https://bsc.publicnode.com",
];

const RPC_URLS = [
  ...DEFAULT_BSC_RPCS,
  process.env.HYBRID_BSC_RPC_URL,
  process.env.HYBRID_BSC_RPC_FALLBACK_1,
  process.env.HYBRID_BSC_RPC_FALLBACK_2,
]
  .map((url) => String(url || "").trim())
  .filter(Boolean);

const uniqueRpcs = [...new Set(RPC_URLS)];

let currentIndex = 0;

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

const defaultRetries = () => Math.max(3, uniqueRpcs.length);

export const withProviderRetry = async (fn, retries = null) => {
  if (uniqueRpcs.length === 0) {
    throw new Error("HYBRID_BSC_RPC_URL is required for BSC provider access");
  }

  const maxAttempts = retries == null ? defaultRetries() : Math.max(1, Number(retries) || 1);
  let lastError;

  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const provider = getProvider();
      return await fn(provider);
    } catch (err) {
      lastError = err;
      console.error("RPC failed:", err?.message);

      switchRpc();
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
