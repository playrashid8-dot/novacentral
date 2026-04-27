import { JsonRpcProvider } from "ethers";
import hybridConfig from "../../config/hybridConfig.js";

export const provider = hybridConfig.rpcUrl
  ? new JsonRpcProvider(hybridConfig.rpcUrl)
  : null;

export const getProvider = () => {
  if (!provider) {
    throw new Error("HYBRID_BSC_RPC_URL is required for BSC provider access");
  }

  return provider;
};

export default provider;
