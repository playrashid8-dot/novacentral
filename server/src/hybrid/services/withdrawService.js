import mongoose from "mongoose";
import { isAddress, getAddress } from "ethers";
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

  if (!normalizedWallet) {
    throw new Error("Valid wallet address required");
  }

  let checksummed;
  try {
    checksummed = getAddress(normalizedWallet);
  } catch {
    throw new Error("Invalid EVM wallet address");
  }

  if (!isAddress(checksummed)) {
    throw new Error("Invalid EVM wallet address");
  }

  const walletLower = checksummed.toLowerCase();

  if (idempotencyKey) {
    const previous = await HybridWithdrawal.findOne({ userId, idempotencyKey });

    if (previous?.idempotencyResponse) {
      return previous.idempotencyResponse.data;
    }
  }

  const session = await mongoose.startSession();

  try {
    let result = null;

    session.startTransaction();

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

      if (Number(user.pendingWithdraw || 0) > 0) {
        throw new Error("Pending withdrawal must be completed first");
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
            walletAddress: walletLower,
            sourceRewardAmount: Number(sourceBreakdown.rewardBalance || 0),
            sourceDepositAmount: Number(sourceBreakdown.depositBalance || 0),
            availableAt,
            requestedAt: now,
            monthKey: getMonthKey(now),
            idempotencyKey,
          },
        ],
        { session }
      );

      const updatedUser = await User.findOneAndUpdate(
        {
          _id: userId,
          pendingWithdraw: { $lte: 0 },
          rewardBalance: { $gte: sourceBreakdown.rewardBalance },
          depositBalance: { $gte: sourceBreakdown.depositBalance },
        },
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

      if (!updatedUser) {
        throw new Error("Insufficient Hybrid balance or pending withdrawal exists");
      }

      const ledgerEntries = [
        {
          userId,
          entryType: "credit",
          balanceType: "pendingWithdraw",
          amount: numericAmount,
          source: "withdraw_request",
          referenceId: withdrawal._id,
          meta: {
            walletAddress: walletLower,
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
            walletAddress: walletLower,
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
            walletAddress: walletLower,
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

    await session.commitTransaction();

    return result;
  } catch (error) {
    await session.abortTransaction();
    throw new Error(error.message || "Failed to request withdrawal");
  } finally {
    session.endSession();
  }
};

export const claimHybridWithdrawal = async (userId, withdrawalId) => {
  const session = await mongoose.startSession();

  try {
    let result = null;

    session.startTransaction();

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

      const claimedWithdrawal = await HybridWithdrawal.findOneAndUpdate(
        {
          _id: withdrawal._id,
          userId,
          status: { $in: ["pending", "claimable"] },
          availableAt: { $lte: new Date() },
        },
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

      if (!claimedWithdrawal) {
        throw new Error("Withdrawal already claimed");
      }

      const updatedUser = await User.findOneAndUpdate(
        {
          _id: userId,
          pendingWithdraw: { $gte: Number(withdrawal.grossAmount || 0) },
        },
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

      if (!updatedUser) {
        throw new Error("Pending withdrawal balance mismatch");
      }

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

    await session.commitTransaction();

    return result;
  } catch (error) {
    await session.abortTransaction();
    throw new Error(error.message || "Failed to claim withdrawal");
  } finally {
    session.endSession();
  }
};

export const getHybridWithdrawals = async (userId) =>
  HybridWithdrawal.find({ userId }).sort({ createdAt: -1 });

const normalizeTxHash = (txHash) => {
  const raw = String(txHash || "").trim().toLowerCase();
  if (!raw.startsWith("0x") || raw.length < 10) {
    return null;
  }
  return raw;
};

export const adminApproveHybridWithdrawal = async (withdrawalId) => {
  if (!withdrawalId) {
    throw new Error("Withdrawal ID required");
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const withdrawal = await HybridWithdrawal.findById(withdrawalId).session(session);

    if (!withdrawal) {
      throw new Error("Withdrawal not found");
    }

    if (!["pending", "claimable"].includes(withdrawal.status)) {
      throw new Error("Withdrawal is not awaiting approval");
    }

    if (new Date(withdrawal.availableAt).getTime() > Date.now()) {
      throw new Error("Withdrawal lock period (96h) is still active");
    }

    const updated = await HybridWithdrawal.findOneAndUpdate(
      { _id: withdrawalId, status: { $in: ["pending", "claimable"] } },
      { $set: { status: "approved", approvedAt: new Date() } },
      { new: true, session }
    );

    if (!updated) {
      throw new Error("Unable to approve withdrawal");
    }

    await session.commitTransaction();
    return updated;
  } catch (error) {
    await session.abortTransaction();
    throw new Error(error.message || "Failed to approve withdrawal");
  } finally {
    session.endSession();
  }
};

export const adminMarkHybridWithdrawalPaid = async (withdrawalId, txHash) => {
  const normalized = normalizeTxHash(txHash);
  if (!normalized) {
    throw new Error("Valid transaction hash required");
  }

  const session = await mongoose.startSession();

  try {
    let result = null;
    session.startTransaction();

    const withdrawal = await HybridWithdrawal.findOne({
      _id: withdrawalId,
      status: "approved",
    }).session(session);

    if (!withdrawal) {
      throw new Error("Withdrawal not found or not approved");
    }

    const duplicateTx = await HybridWithdrawal.findOne({
      txHash: normalized,
      _id: { $ne: withdrawalId },
    })
      .select("_id")
      .lean()
      .session(session);

    if (duplicateTx) {
      throw new Error("Transaction hash already used");
    }

    const paid = await HybridWithdrawal.findOneAndUpdate(
      {
        _id: withdrawalId,
        status: "approved",
      },
      {
        $set: {
          status: "paid",
          txHash: normalized,
          paidAt: new Date(),
        },
      },
      { new: true, session }
    );

    if (!paid) {
      throw new Error("Unable to mark withdrawal paid");
    }

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: paid.userId,
        pendingWithdraw: { $gte: Number(paid.grossAmount || 0) },
      },
      {
        $inc: {
          pendingWithdraw: -Number(paid.grossAmount || 0),
        },
      },
      { new: true, session }
    );

    if (!updatedUser) {
      throw new Error("Pending withdrawal balance mismatch");
    }

    await addHybridLedgerEntries(
      [
        {
          userId: paid.userId,
          entryType: "debit",
          balanceType: "pendingWithdraw",
          amount: Number(paid.grossAmount || 0),
          source: "withdraw_payout",
          referenceId: paid._id,
          meta: {
            netAmount: Number(paid.netAmount || 0),
            feeAmount: Number(paid.feeAmount || 0),
            walletAddress: paid.walletAddress,
            txHash: normalized,
          },
        },
      ],
      session
    );

    result = { withdrawal: paid, txHash: normalized };
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw new Error(error.message || "Failed to mark withdrawal paid");
  } finally {
    session.endSession();
  }
};

export const adminRejectHybridWithdrawal = async (withdrawalId) => {
  if (!withdrawalId) {
    throw new Error("Withdrawal ID required");
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const withdrawal = await HybridWithdrawal.findById(withdrawalId).session(session);

    if (!withdrawal) {
      throw new Error("Withdrawal not found");
    }

    if (!["pending", "claimable", "approved"].includes(withdrawal.status)) {
      throw new Error("Withdrawal cannot be rejected");
    }

    const rewardBack = Number(withdrawal.sourceRewardAmount || 0);
    const depositBack = Number(withdrawal.sourceDepositAmount || 0);
    const gross = Number(withdrawal.grossAmount || 0);

    if (rewardBack + depositBack <= 0 && gross > 0) {
      throw new Error("Cannot reject this withdrawal: missing source breakdown (legacy record)");
    }

    if (Math.abs(rewardBack + depositBack - gross) > 0.0001) {
      throw new Error("Source breakdown does not match gross amount; reject aborted");
    }

    const updatedWithdrawal = await HybridWithdrawal.findOneAndUpdate(
      { _id: withdrawalId, status: { $in: ["pending", "claimable", "approved"] } },
      { $set: { status: "rejected" } },
      { new: true, session }
    );

    if (!updatedWithdrawal) {
      throw new Error("Unable to reject withdrawal");
    }

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: withdrawal.userId,
        pendingWithdraw: { $gte: gross },
      },
      {
        $inc: {
          pendingWithdraw: -gross,
          rewardBalance: rewardBack,
          depositBalance: depositBack,
        },
      },
      { new: true, session }
    );

    if (!updatedUser) {
      throw new Error("User balance state mismatch; reject aborted");
    }

    const ledger = [
      {
        userId: withdrawal.userId,
        entryType: "debit",
        balanceType: "pendingWithdraw",
        amount: gross,
        source: "withdraw_reject",
        referenceId: withdrawal._id,
        meta: { walletAddress: withdrawal.walletAddress },
      },
    ];

    if (rewardBack > 0) {
      ledger.push({
        userId: withdrawal.userId,
        entryType: "credit",
        balanceType: "rewardBalance",
        amount: rewardBack,
        source: "withdraw_reject",
        referenceId: withdrawal._id,
        meta: { walletAddress: withdrawal.walletAddress },
      });
    }

    if (depositBack > 0) {
      ledger.push({
        userId: withdrawal.userId,
        entryType: "credit",
        balanceType: "depositBalance",
        amount: depositBack,
        source: "withdraw_reject",
        referenceId: withdrawal._id,
        meta: { walletAddress: withdrawal.walletAddress },
      });
    }

    await addHybridLedgerEntries(ledger, session);
    await session.commitTransaction();
    return updatedWithdrawal;
  } catch (error) {
    await session.abortTransaction();
    throw new Error(error.message || "Failed to reject withdrawal");
  } finally {
    session.endSession();
  }
};
