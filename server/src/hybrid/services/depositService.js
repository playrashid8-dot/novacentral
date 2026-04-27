import mongoose from "mongoose";
import User from "../../models/User.js";
import HybridDeposit from "../models/HybridDeposit.js";
import { addHybridLedgerEntries } from "./ledgerService.js";
import { distributeHybridReferralRewards } from "./referralService.js";
import { syncUserLevel } from "./levelService.js";
import { sweepHybridDeposit } from "./sweepService.js";

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

  const session = await mongoose.startSession();

  try {
    let deposit = null;

    await session.withTransaction(async () => {
      const creditedDeposit = await HybridDeposit.findOne({
        txHash: normalizedTxHash,
        status: { $in: ["credited", "swept"] },
      }).session(session);

      if (creditedDeposit) {
        deposit = creditedDeposit;
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
            },
          ],
          { session }
        );
      }

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
      });
      await syncUserLevel(userId, session);
    });

    try {
      await sweepHybridDeposit(deposit._id);
    } catch (error) {
      await HybridDeposit.findByIdAndUpdate(deposit._id, {
        $set: {
          errorMessage: error.message,
        },
      });
    }

    return deposit;
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await HybridDeposit.findOne({ txHash: normalizedTxHash });

      if (existing && ["credited", "swept"].includes(existing.status)) {
        return existing;
      }
    }

    throw error;
  } finally {
    session.endSession();
  }
};

export const getUserHybridDeposits = async (userId) =>
  HybridDeposit.find({ userId }).sort({ createdAt: -1 });
