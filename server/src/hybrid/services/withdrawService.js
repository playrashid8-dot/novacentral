import mongoose from "mongoose";
import User from "../../models/User.js";
import HybridWithdrawal from "../models/HybridWithdrawal.js";
import {
  WITHDRAW_FEE_RATE,
  WITHDRAW_MIN_AMOUNT,
  WITHDRAW_MONTHLY_LIMITS,
} from "../utils/constants.js";
import { ensureMonthWindow, WITHDRAW_DELAY_MS } from "../utils/time.js";
import { addHybridLedgerEntries } from "./ledgerService.js";
import { getSpendableHybridBalance, splitHybridBalance } from "./balanceService.js";

const getMonthlyLimit = (level) => WITHDRAW_MONTHLY_LIMITS[Math.min(Number(level || 0), 3)] || 0;

const getMonthKey = (value) => {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

export const requestHybridWithdrawal = async (
  userId,
  amount,
  walletAddress,
  idempotencyKey = null
) => {
  const numericAmount = Number(amount);
  const normalizedWallet = walletAddress?.trim();

  if (!Number.isFinite(numericAmount) || numericAmount < WITHDRAW_MIN_AMOUNT) {
    throw new Error(`Minimum withdrawal is ${WITHDRAW_MIN_AMOUNT} USDT`);
  }

  if (!normalizedWallet || normalizedWallet.length < 8) {
    throw new Error("Valid wallet address required");
  }

  if (idempotencyKey) {
    const previous = await HybridWithdrawal.findOne({ userId, idempotencyKey });

    if (previous?.idempotencyResponse) {
      return previous.idempotencyResponse.data;
    }
  }

  const session = await mongoose.startSession();

  try {
    let result = null;

    await session.withTransaction(async () => {
      const user = await User.findById(userId)
        .select(
          "depositBalance rewardBalance pendingWithdraw level monthlyWithdrawn monthStart lastWithdrawRequest"
        )
        .session(session);

      if (!user) {
        throw new Error("User not found");
      }

      const monthlyLimit = getMonthlyLimit(user.level);

      if (monthlyLimit <= 0) {
        throw new Error("Upgrade to level 1 to withdraw");
      }

      if (getSpendableHybridBalance(user) < numericAmount) {
        throw new Error("Insufficient Hybrid balance");
      }

      const monthWindow = ensureMonthWindow(user);
      const nextMonthlyWithdrawn = monthWindow.monthlyWithdrawn + numericAmount;

      if (nextMonthlyWithdrawn > monthlyLimit) {
        throw new Error("Monthly withdrawal limit reached");
      }

      const sourceBreakdown = splitHybridBalance(user, numericAmount);
      const feeAmount = Number((numericAmount * WITHDRAW_FEE_RATE).toFixed(8));
      const netAmount = Number((numericAmount - feeAmount).toFixed(8));
      const now = new Date();
      const availableAt = new Date(now.getTime() + WITHDRAW_DELAY_MS);

      const [withdrawal] = await HybridWithdrawal.create(
        [
          {
            userId,
            grossAmount: numericAmount,
            feeAmount,
            netAmount,
            walletAddress: normalizedWallet,
            availableAt,
            requestedAt: now,
            monthKey: getMonthKey(now),
            idempotencyKey,
          },
        ],
        { session }
      );

      await User.findByIdAndUpdate(
        userId,
        {
          $inc: {
            rewardBalance: -sourceBreakdown.rewardBalance,
            depositBalance: -sourceBreakdown.depositBalance,
            pendingWithdraw: numericAmount,
          },
          $set: {
            monthStart: monthWindow.monthStart,
            monthlyWithdrawn: nextMonthlyWithdrawn,
            lastWithdrawRequest: now,
          },
        },
        {
          new: true,
          session,
        }
      );

      const ledgerEntries = [
        {
          userId,
          entryType: "credit",
          balanceType: "pendingWithdraw",
          amount: numericAmount,
          source: "withdraw_request",
          referenceId: withdrawal._id,
          meta: {
            walletAddress: normalizedWallet,
            netAmount,
            feeAmount,
          },
        },
      ];

      if (sourceBreakdown.rewardBalance > 0) {
        ledgerEntries.push({
          userId,
          entryType: "debit",
          balanceType: "rewardBalance",
          amount: sourceBreakdown.rewardBalance,
          source: "withdraw_request",
          referenceId: withdrawal._id,
          meta: {
            walletAddress: normalizedWallet,
          },
        });
      }

      if (sourceBreakdown.depositBalance > 0) {
        ledgerEntries.push({
          userId,
          entryType: "debit",
          balanceType: "depositBalance",
          amount: sourceBreakdown.depositBalance,
          source: "withdraw_request",
          referenceId: withdrawal._id,
          meta: {
            walletAddress: normalizedWallet,
          },
        });
      }

      await addHybridLedgerEntries(ledgerEntries, session);

      result = {
        withdrawal,
      };

      if (idempotencyKey) {
        await HybridWithdrawal.findByIdAndUpdate(
          withdrawal._id,
          {
            $set: {
              idempotencyResponse: {
                data: result,
              },
            },
          },
          {
            session,
          }
        );
      }
    });

    return result;
  } finally {
    session.endSession();
  }
};

export const claimHybridWithdrawal = async (userId, withdrawalId) => {
  const session = await mongoose.startSession();

  try {
    let result = null;

    await session.withTransaction(async () => {
      const withdrawal = await HybridWithdrawal.findOne({
        _id: withdrawalId,
        userId,
        status: { $in: ["pending", "claimable"] },
      }).session(session);

      if (!withdrawal) {
        throw new Error("Withdrawal not found");
      }

      if (new Date(withdrawal.availableAt).getTime() > Date.now()) {
        throw new Error("Withdrawal is still locked for 96 hours");
      }

      await HybridWithdrawal.findByIdAndUpdate(
        withdrawal._id,
        {
          $set: {
            status: "claimed",
            claimedAt: new Date(),
          },
        },
        {
          new: true,
          session,
        }
      );

      await User.findByIdAndUpdate(
        userId,
        {
          $inc: {
            pendingWithdraw: -Number(withdrawal.grossAmount || 0),
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
            entryType: "debit",
            balanceType: "pendingWithdraw",
            amount: Number(withdrawal.grossAmount || 0),
            source: "withdraw_claim",
            referenceId: withdrawal._id,
            meta: {
              netAmount: Number(withdrawal.netAmount || 0),
              feeAmount: Number(withdrawal.feeAmount || 0),
              walletAddress: withdrawal.walletAddress,
            },
          },
        ],
        session
      );

      result = {
        withdrawalId: withdrawal._id,
        netAmount: Number(withdrawal.netAmount || 0),
        feeAmount: Number(withdrawal.feeAmount || 0),
      };
    });

    return result;
  } finally {
    session.endSession();
  }
};

export const getHybridWithdrawals = async (userId) => {
  await HybridWithdrawal.updateMany(
    {
      userId,
      status: "pending",
      availableAt: { $lte: new Date() },
    },
    {
      $set: {
        status: "claimable",
      },
    }
  );

  return HybridWithdrawal.find({ userId }).sort({ createdAt: -1 });
};
