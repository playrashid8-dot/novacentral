import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const readEnv = (key, fallback = "") => String(process.env[key] ?? fallback).trim();

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return String(value).toLowerCase() === "true";
};

const parsePort = (value) => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : null;
};

const criticalFields = {
  HYBRID_ADMIN_WALLET: readEnv("HYBRID_ADMIN_WALLET"),
  HYBRID_MNEMONIC: readEnv("HYBRID_MNEMONIC"),
  HYBRID_PRIVATE_KEY_ENCRYPTION_SECRET: readEnv("HYBRID_PRIVATE_KEY_ENCRYPTION_SECRET"),
};

const optionalFields = {
  HYBRID_GAS_FUNDER_PRIVATE_KEY: readEnv("HYBRID_GAS_FUNDER_PRIVATE_KEY"),
  HYBRID_BSC_RPC_URL: readEnv("HYBRID_BSC_RPC_URL"),
  HYBRID_USDT_CONTRACT: readEnv("HYBRID_USDT_CONTRACT"),
  EMAIL_HOST: readEnv("EMAIL_HOST"),
  EMAIL_PORT: readEnv("EMAIL_PORT"),
  EMAIL_USER: readEnv("EMAIL_USER"),
  EMAIL_PASS: readEnv("EMAIL_PASS"),
};

const missingCritical = Object.entries(criticalFields)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingCritical.length > 0) {
  throw new Error(`Missing critical HybridEarn environment variables: ${missingCritical.join(", ")}`);
}

const missingOptional = Object.entries(optionalFields)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingOptional.length > 0) {
  console.warn(`HybridEarn optional environment variables missing: ${missingOptional.join(", ")}`);
}

const emailPort = parsePort(optionalFields.EMAIL_PORT);

if (optionalFields.EMAIL_PORT && !emailPort) {
  console.warn("HybridEarn EMAIL_PORT must be a positive integer when configured");
}

export const hybridConfig = {
  adminWallet: criticalFields.HYBRID_ADMIN_WALLET,
  gasKey: optionalFields.HYBRID_GAS_FUNDER_PRIVATE_KEY,
  mnemonic: criticalFields.HYBRID_MNEMONIC,
  rpcUrl: optionalFields.HYBRID_BSC_RPC_URL,
  usdtContract: optionalFields.HYBRID_USDT_CONTRACT,
  encryptionSecret: criticalFields.HYBRID_PRIVATE_KEY_ENCRYPTION_SECRET,
  earnEnabled: parseBoolean(process.env.HYBRID_EARN_ENABLED, true),
  sweepEnabled: parseBoolean(process.env.HYBRID_SWEEP_ENABLED, true),
  emailConfig: {
    host: optionalFields.EMAIL_HOST,
    port: emailPort,
    user: optionalFields.EMAIL_USER,
    pass: optionalFields.EMAIL_PASS,
    secure: emailPort === 465,
  },
};

export default hybridConfig;
