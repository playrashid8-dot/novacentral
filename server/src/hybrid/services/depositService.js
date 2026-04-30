import mongoose from "mongoose";
import User from "../../models/User.js";
import HybridDeposit from "../models/HybridDeposit.js";
import { withProviderRetry } from "../utils/provider.js";
import { addHybridLedgerEntries } from "./ledgerService.js";
import { distributeHybridReferralRewards } from "./referralService.js";
import { syncUserLevel } from "./levelService.js";
import {
  completeIdempotency,
  failIdempotency,
  getCompletedIdempotency,
  markIdempotencyProcessing,
} from "./idempotencyService.js";
export const creditHybridDeposit = async ({
  userId,
  walletAddress,
  txHash,
  amount,
  blockNumber = null,
  fromAddress = "",
  tokenAddress = "",
}) => {
  const normalizedTxHash = String(txHash || "").trim().toLowerCase();
  const normalizedWallet = String(walletAddress || "").trim().toLowerCase();
  const numericAmount = Number(amount || 0);

  if (!normalizedTxHash || !normalizedWallet || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Invalid deposit payload");
  }

  const storedResponse = await getCompletedIdempotency("deposit", normalizedTxHash);
  if (storedResponse?.depositId) {
    const storedDeposit = await HybridDeposit.findById(storedResponse.depositId);
    if (storedDeposit && ["credited", "swept"].includes(storedDeposit.status)) {
      return storedDeposit;
    }
  }

  const session = await mongoose.startSession();

  try {
    let deposit = null;
    let creditedNew = false;

    await session.withTransaction(async () => {
      await markIdempotencyProcessing("deposit", normalizedTxHash, session);

      const creditedDeposit = await HybridDeposit.findOne({
        txHash: normalizedTxHash,
        status: { $in: ["credited", "swept"] },
      }).session(session);

      if (creditedDeposit) {
        deposit = creditedDeposit;
        await completeIdempotency(
          "deposit",
          normalizedTxHash,
          {
            depositId: String(creditedDeposit._id),
            status: creditedDeposit.status,
            amount: Number(creditedDeposit.amount || 0),
          },
          session
        );
        return;
      }

      const user = await User.findById(userId)
        .select("depositBalance")
        .session(session);

      if (!user) {
        throw new Error("User not found");
      }

      const qualifiedDepositCount = await HybridDeposit.countDocuments({
        userId,
        status: { $in: ["credited", "swept"] },
      }).session(session);

      const isFirstQualifiedDeposit = qualifiedDepositCount === 0;

      const existing = await HybridDeposit.findOne({
        txHash: normalizedTxHash,
      }).session(session);

      if (existing) {
        deposit = await HybridDeposit.findOneAndUpdate(
          {
            _id: existing._id,
            status: { $nin: ["credited", "swept"] },
          },
          {
            $set: {
              status: "credited",
              sweeped: false,
              walletAddress: normalizedWallet,
              amount: numericAmount,
              blockNumber,
              fromAddress: String(fromAddress || "").toLowerCase(),
              tokenAddress: String(tokenAddress || "").toLowerCase(),
              errorMessage: "",
            },
          },
          {
            new: true,
            session,
          }
        );

        if (!deposit) {
          deposit = await HybridDeposit.findOne({
            txHash: normalizedTxHash,
          }).session(session);
          return;
        }
      } else {
        [deposit] = await HybridDeposit.create(
          [
            {
              userId,
              walletAddress: normalizedWallet,
              amount: numericAmount,
              txHash: normalizedTxHash,
              blockNumber,
              fromAddress: String(fromAddress || "").toLowerCase(),
              tokenAddress: String(tokenAddress || "").toLowerCase(),
              status: "credited",
              sweeped: false,
            },
          ],
          { session }
        );
      }

      creditedNew = true;

      await User.findByIdAndUpdate(
        userId,
        {
          $inc: {
            depositBalance: numericAmount,
          },
        },
        {
          new: true,
          session,
        }
      );

      await addHybridLedgerEntries(
        [
          {
            userId,
            entryType: "credit",
            balanceType: "depositBalance",
            amount: numericAmount,
            source: "hybrid_deposit",
            referenceId: deposit._id,
            meta: {
              txHash: normalizedTxHash,
            },
          },
        ],
        session
      );

      await distributeHybridReferralRewards(userId, numericAmount, session, {
        isFirstQualifiedDeposit,
        depositTxHash: normalizedTxHash,
      });
      await syncUserLevel(userId, session);

      await completeIdempotency(
        "deposit",
        normalizedTxHash,
        {
          depositId: String(deposit._id),
          status: deposit.status,
          amount: numericAmount,
        },
        session
      );
    });

    if (creditedNew && deposit) {
      console.log("✅ Deposit credited");
    }

    return deposit;
  } catch (error) {
    console.error("❌ ERROR:", error?.message || String(error));
    if (error?.code === 11000) {
      const existing = await HybridDeposit.findOne({ txHash: normalizedTxHash });

      if (existing && ["credited", "swept"].includes(existing.status)) {
        return existing;
      }
    }

    await failIdempotency("deposit", normalizedTxHash, error);
    throw error;
  } finally {
    session.endSession();
  }
};

const HYBRID_DEPOSIT_CONFIRMATIONS_REQUIRED = 3;

export const enrichHybridDepositsWithConfirmations = async (deposits) => {
  if (!Array.isArray(deposits) || deposits.length === 0) {
    return deposits;
  }

  try {
    const currentBlock = await withProviderRetry((p) => p.getBlockNumber());
    return deposits.map((d) => {
      const bn = d.blockNumber;
      let confirmations =
        bn != null && Number.isFinite(Number(bn))
          ? Math.max(0, currentBlock - Number(bn))
          : 0;
      confirmations = confirmations || 0;
      const confirmationStatus =
        confirmations >= HYBRID_DEPOSIT_CONFIRMATIONS_REQUIRED ? "confirmed" : "confirming";
      return {
        ...d,
        currentBlock,
        confirmations,
        confirmationStatus,
      };
    });
  } catch (err) {
    console.error("❌ ERROR:", err?.message || String(err));
    return deposits.map((d) => ({
      ...d,
      currentBlock: null,
      confirmations: 0,
      confirmationStatus: "unknown",
    }));
  }
};

export const getUserHybridDeposits = async (userId) => {
  const deposits = await HybridDeposit.find({ userId }).sort({ createdAt: -1 }).lean();
  return enrichHybridDepositsWithConfirmations(deposits);
};

/** BullMQ worker entry — dynamic import avoids circular static imports with depositListener. */
export async function processDepositJob(jobData) {
  const { processDepositJob: run } = await import("./depositQueueProcessor.js");
  return run(jobData);
}
