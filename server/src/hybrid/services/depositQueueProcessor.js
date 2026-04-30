import { Interface, formatUnits } from "ethers";

import HybridDeposit from "../models/HybridDeposit.js";
import User from "../../models/User.js";
import { processDepositLog } from "./depositListener.js";
import { BSC_USDT_ABI, HYBRID_TOKEN } from "../utils/constants.js";

const iface = new Interface(BSC_USDT_ABI);

const decodeTopicAddress = (topic = "") =>
  `0x${String(topic).slice(-40).toLowerCase()}`;

async function processSerializedDepositLog(serializedLog) {
  const normalized = String(serializedLog?.transactionHash || "").toLowerCase();

  if (!normalized) {
    console.error("❌ Worker error: missing transaction hash on job");
    return { outcome: "skip", reason: "missing_tx", processedDelta: 0 };
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`⚙️ Processing job: ${normalized}`);
  }

  const existingDeposit = await HybridDeposit.findOne({ txHash: normalized })
    .select("_id status")
    .lean();

  if (["credited", "swept"].includes(existingDeposit?.status)) {
    return { outcome: "duplicate", txHash: normalized, processedDelta: 0 };
  }

  const log = {
    transactionHash: serializedLog.transactionHash,
    address:
      serializedLog.address != null
        ? String(serializedLog.address).trim()
        : undefined,
    blockNumber:
      serializedLog.blockNumber != null &&
      Number.isFinite(Number(serializedLog.blockNumber))
        ? Number(serializedLog.blockNumber)
        : undefined,
    topics: [...(serializedLog.topics || [])],
    data: serializedLog.data,
  };

  const expectedContract = String(process.env.HYBRID_USDT_CONTRACT || "").trim().toLowerCase();
  const logAddr = log.address != null ? String(log.address).trim().toLowerCase() : "";
  if (expectedContract && logAddr && logAddr !== expectedContract) {
    console.warn("❌ Invalid contract event ignored", {
      expected: expectedContract,
      received: logAddr,
    });
    return { outcome: "skip", reason: "contract", txHash: normalized, processedDelta: 0 };
  }

  const toAddr = decodeTopicAddress(log.topics?.[2]).toLowerCase();
  if (!toAddr || toAddr === "0x") {
    console.error("❌ Safety check: invalid recipient wallet on log", normalized);
    return { outcome: "skip", reason: "wallet", txHash: normalized, processedDelta: 0 };
  }

  let parsedAmount;
  try {
    const parsed = iface.parseLog({
      address: logAddr || expectedContract,
      topics: log.topics,
      data: log.data,
    });
    parsedAmount = Number(formatUnits(parsed.args.value, HYBRID_TOKEN.decimals));
  } catch (err) {
    console.error("❌ Deposit parsing error:", normalized, err?.message || String(err));
    throw err;
  }

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    console.error("❌ Safety check: amount must be > 0", { txHash: normalized, parsedAmount });
    return { outcome: "skip", reason: "amount", txHash: normalized, processedDelta: 0 };
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`💰 Amount parsed: ${parsedAmount} USDT`);
  }

  const user = await User.findOne({ walletAddress: toAddr })
    .select("_id walletAddress")
    .lean();

  if (!user) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("No user found:", toAddr);
    }
    return { outcome: "skip", reason: "no_user", txHash: normalized, processedDelta: 0 };
  }

  const usersByWallet = new Map([
    [
      String(user.walletAddress || "")
        .trim()
        .toLowerCase(),
      user,
    ],
  ]);

  const r = await processDepositLog(log, iface, usersByWallet, { skipQueue: true });

  if (r.creditFailure) {
    console.error("❌ Worker error: credit failed", normalized);
    throw new Error("Hybrid deposit credit failed");
  }

  const processedDelta = Number(r.processedDelta) || 0;
  if (processedDelta > 0) {
    return {
      outcome: "credited",
      txHash: normalized,
      processedDelta,
      userId: String(user._id),
      amount: parsedAmount,
    };
  }

  return { outcome: "skip", reason: "no_credit", txHash: normalized, processedDelta: 0 };
}

/**
 * BullMQ job handler: `job.data` is `{ log, blockNumber? }` from enqueueDepositJob.
 */
export async function processDepositJob(jobData) {
  const serializedLog = jobData?.log != null ? jobData.log : jobData;
  return processSerializedDepositLog(serializedLog);
}
