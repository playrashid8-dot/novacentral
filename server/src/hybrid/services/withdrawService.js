import mongoose from "mongoose";
import { Interface, isAddress, getAddress, parseUnits } from "ethers";
import User from "../../models/User.js";
import HybridWithdrawal from "../models/HybridWithdrawal.js";
import {
  BSC_USDT_ABI,
  HYBRID_TOKEN,
  WITHDRAW_FEE_RATE,
  WITHDRAW_MIN_AMOUNT,
  WITHDRAW_MONTHLY_LIMITS,
} from "../utils/constants.js";
import hybridConfig from "../../config/hybridConfig.js";
import { withProviderRetry } from "../utils/provider.js";
import { ensureMonthWindow, WITHDRAW_DELAY_MS } from "../utils/time.js";
import { addHybridLedgerEntries } from "./ledgerService.js";
import { getSpendableHybridBalance, splitHybridBalance } from "./balanceService.js";

const getMonthlyLimit = (level) => WITHDRAW_MONTHLY_LIMITS[Math.min(Number(level || 0), 3)] || 0;

const getMonthKey = (value) => {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const MS_HOUR = 60 * 60 * 1000;

export const requestHybridWithdrawal = async (
  userId,
  amount,
  walletAddress,
  idempotencyKey = null
) => {
  const numericAmount = Number(amount || 0);
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
          "depositBalance rewardBalance pendingWithdraw level monthlyWithdrawn monthStart lastWithdrawRequest adminFraudFlag createdAt totalInvested"
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

      if (user.lastWithdrawRequest) {
        const lastReq = new Date(user.lastWithdrawRequest).getTime();
        if (Number.isFinite(lastReq) && Date.now() - lastReq < WITHDRAW_DELAY_MS) {
          throw new Error("Withdrawal cooldown: wait 96 hours between requests");
        }
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

      const hourAgo = new Date(Date.now() - MS_HOUR);
      const priorHourCount = await HybridWithdrawal.countDocuments({
        userId,
        createdAt: { $gte: hourAgo },
        status: { $nin: ["rejected"] },
      }).session(session);
      const rapidPattern = priorHourCount >= 3;
      const isSuspicious = Boolean(user.adminFraudFlag) || rapidPattern;
      const initialStatus = isSuspicious ? "review" : "pending";

      let riskScore = 0;
      if (priorHourCount > 3) riskScore += 2;
      const depositsBaseline = Math.max(
        Number(user.totalInvested || 0),
        Number(user.depositBalance || 0)
      );
      if (depositsBaseline > 0 && numericAmount > depositsBaseline * 2) {
        riskScore += 2;
      } else if (depositsBaseline <= 0 && numericAmount > 0) {
        riskScore += 2;
      }
      const createdAtUser = user.createdAt ? new Date(user.createdAt).getTime() : 0;
      const newUser =
        Number.isFinite(createdAtUser) && createdAtUser > 0
          ? Date.now() - createdAtUser < 7 * 24 * 60 * 60 * 1000
          : false;
      if (newUser) riskScore += 1;

      const priority = isSuspicious ? "high" : "normal";

      if (riskScore >= 4) {
        console.warn("🚨 HIGH RISK WITHDRAW", {
          userId: String(userId),
          amount: numericAmount,
          riskScore,
        });
      }

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
            isSuspicious,
            status: initialStatus,
            priority,
            riskScore,
          },
        ],
        { session }
      );

      if (riskScore >= 4) {
        await User.updateOne(
          {
            _id: userId,
            adminFraudFlag: { $ne: true },
          },
          {
            $set: {
              adminFraudFlag: true,
              adminFraudReason: "Auto high-risk withdraw",
            },
          },
          { session }
        );
      }

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

/**
 * User "claim" only moves pending → claimable after the lock window.
 * Funds stay in pendingWithdraw until admin marks the withdrawal paid.
 */
export const claimHybridWithdrawal = async (userId, withdrawalId) => {
  const session = await mongoose.startSession();

  try {
    let result = null;

    session.startTransaction();

    const withdrawal = await HybridWithdrawal.findOne({
      _id: withdrawalId,
      userId,
    }).session(session);

    if (!withdrawal) {
      throw new Error("Withdrawal not found");
    }

    if (withdrawal.status === "claimable") {
      result = {
        withdrawalId: withdrawal._id,
        status: "claimable",
        netAmount: Number(withdrawal.netAmount || 0),
        feeAmount: Number(withdrawal.feeAmount || 0),
      };
      await session.commitTransaction();
      return result;
    }

    if (withdrawal.status === "review") {
      throw new Error("Withdrawal is under fraud review — wait for admin clearance");
    }

    if (withdrawal.status !== "pending") {
      throw new Error("Withdrawal cannot be marked claimable in its current state");
    }

    if (new Date(withdrawal.availableAt).getTime() > Date.now()) {
      throw new Error("Withdrawal is still locked for 96 hours");
    }

    const updated = await HybridWithdrawal.findOneAndUpdate(
      {
        _id: withdrawal._id,
        userId,
        status: "pending",
        availableAt: { $lte: new Date() },
      },
      {
        $set: { status: "claimable" },
      },
      {
        new: true,
        session,
      }
    );

    if (!updated) {
      throw new Error("Unable to mark withdrawal as claimable");
    }

    result = {
      withdrawalId: updated._id,
      status: "claimable",
      netAmount: Number(updated.netAmount || 0),
      feeAmount: Number(updated.feeAmount || 0),
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

const adminClientError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const wrapAdminClientError = (error, fallback) => {
  const wrapped = new Error(error?.message || fallback);
  wrapped.statusCode = error?.statusCode && error.statusCode < 500 ? error.statusCode : 400;
  return wrapped;
};

const transferEventIface = new Interface(BSC_USDT_ABI);

/**
 * Requires a successful receipt and a matching USDT Transfer to the user's wallet
 * with value >= expected net (no blind trust of txHash).
 */
const verifyPayoutTransferInReceipt = async (txHash, toWalletLower, minNetAmount) => {
  if (!hybridConfig.usdtContract) {
    throw new Error("USDT contract not configured");
  }

  const tokenExpected = hybridConfig.usdtContract.toLowerCase();
  const toExpected = String(toWalletLower || "").trim().toLowerCase();

  if (!toExpected.startsWith("0x")) {
    throw new Error("Invalid payout wallet on record");
  }

  const receipt = await withProviderRetry((p) => p.getTransactionReceipt(txHash));

  if (!receipt) {
    throw new Error("Transaction receipt not found");
  }

  if (receipt.status !== 1) {
    throw new Error("Transaction failed on-chain");
  }

  const minWei = parseUnits(String(minNetAmount), HYBRID_TOKEN.decimals);
  let total = 0n;

  for (const log of receipt.logs) {
    if (String(log.address).toLowerCase() !== tokenExpected) {
      continue;
    }
    try {
      const parsed = transferEventIface.parseLog(log);
      if (parsed.name !== "Transfer") {
        continue;
      }
      const to = String(parsed.args.to).toLowerCase();
      if (to !== toExpected) {
        continue;
      }
      total += BigInt(parsed.args.value.toString());
    } catch {
      // not a Transfer we can parse
    }
  }

  if (total < minWei) {
    throw new Error("On-chain USDT transfer to user is below expected net payout");
  }
};

/**
 * Boolean wrapper for on-chain payout verification (used by admin pay flow).
 * Uses the same rules as verifyPayoutTransferInReceipt: successful receipt + USDT Transfer to user ≥ net.
 */
export const verifyPayoutTx = async (txHash, expectedAmount, userAddress) => {
  try {
    const raw = String(txHash || "").trim().toLowerCase();
    if (!raw.startsWith("0x") || raw.length < 10) {
      return false;
    }
    await verifyPayoutTransferInReceipt(
      raw,
      String(userAddress || "").toLowerCase(),
      expectedAmount
    );
    return true;
  } catch (err) {
    console.error("Verify payout error:", err);
    return false;
  }
};

/** Moves time-unlocked pending withdrawals to claimable without a user call (cron). */
export const autoMarkClaimable = async () => {
  try {
    const res = await HybridWithdrawal.updateMany(
      {
        status: "pending",
        availableAt: { $lte: new Date() },
      },
      {
        $set: { status: "claimable" },
      }
    );

    if (res.modifiedCount > 0) {
      console.log(`✅ ${res.modifiedCount} withdrawals moved to claimable`);
    }
  } catch (err) {
    console.error("Auto claimable error:", err);
  }
};

export const adminApproveHybridWithdrawal = async (withdrawalId, adminId = null) => {
  if (!withdrawalId) {
    throw adminClientError("Withdrawal ID required");
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const withdrawal = await HybridWithdrawal.findById(withdrawalId).session(session);

    if (!withdrawal) {
      throw adminClientError("Withdrawal not found", 404);
    }

    if (withdrawal.status !== "pending" && withdrawal.status !== "review" && withdrawal.status !== "claimable") {
      throw adminClientError("Already processed");
    }

    if (new Date(withdrawal.availableAt).getTime() > Date.now()) {
      throw adminClientError("Withdrawal lock period (96h) is still active");
    }

    const updated = await HybridWithdrawal.findOneAndUpdate(
      { _id: withdrawalId, status: { $in: ["review", "pending", "claimable"] } },
      {
        $set: {
          status: "approved",
          approvedAt: new Date(),
          ...(adminId ? { approvedBy: adminId } : {}),
        },
      },
      { new: true, session }
    );

    if (!updated) {
      throw adminClientError("Unable to approve withdrawal");
    }

    await session.commitTransaction();
    return updated;
  } catch (error) {
    await session.abortTransaction();
    throw wrapAdminClientError(error, "Failed to approve withdrawal");
  } finally {
    session.endSession();
  }
};

export const adminMarkHybridWithdrawalPaid = async (withdrawalId, txHash, adminId = null) => {
  const normalized = normalizeTxHash(txHash);
  if (!normalized) {
    throw adminClientError("Valid transaction hash required");
  }

  const head = await HybridWithdrawal.findById(withdrawalId).select("status").lean();
  if (!head) {
    throw adminClientError("Withdrawal not found", 404);
  }
  if (head.status === "paid") {
    throw adminClientError("Withdrawal already paid");
  }

  const preCheck = await HybridWithdrawal.findOne({
    _id: withdrawalId,
    status: "approved",
  })
    .select("walletAddress netAmount")
    .lean();

  if (!preCheck) {
    throw adminClientError("Withdrawal not found or not approved");
  }

  const isValid = await verifyPayoutTx(normalized, preCheck.netAmount, preCheck.walletAddress);
  if (!isValid) {
    throw adminClientError("Invalid payout transaction");
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
      throw adminClientError("Withdrawal not found or not approved");
    }

    if (withdrawal.status === "paid") {
      throw adminClientError("Withdrawal already paid");
    }

    const userBeforePay = await User.findById(withdrawal.userId)
      .select("pendingWithdraw")
      .session(session)
      .lean();
    if (
      !userBeforePay ||
      Number(userBeforePay.pendingWithdraw || 0) < Number(withdrawal.grossAmount || 0)
    ) {
      console.warn("⚠️ Pending mismatch detected");
      throw adminClientError("Pending balance mismatch");
    }

    const duplicateTx = await HybridWithdrawal.findOne({
      txHash: normalized,
      _id: { $ne: withdrawalId },
    })
      .select("_id")
      .lean()
      .session(session);

    if (duplicateTx) {
      throw adminClientError("Transaction hash already used");
    }

    const nowPaid = new Date();
    const paid = await HybridWithdrawal.findOneAndUpdate(
      {
        _id: withdrawalId,
        status: "approved",
      },
      {
        $set: {
          status: "paid",
          txHash: normalized,
          paidAt: nowPaid,
          ...(adminId ? { paidBy: adminId } : {}),
        },
      },
      { new: true, session }
    );

    if (!paid) {
      throw adminClientError("Unable to mark withdrawal paid");
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
      throw adminClientError("Pending withdrawal balance mismatch");
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

    console.info("[withdraw.paid]", {
      withdrawalId: String(paid._id),
      userId: String(paid.userId),
      txHash: normalized,
      walletAddress: String(paid.walletAddress || "").toLowerCase(),
      netAmount: Number(paid.netAmount || 0),
    });

    result = { withdrawal: paid, txHash: normalized };
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    const code = error?.code ?? error?.cause?.code;
    const isDupTx =
      code === 11000 ||
      /E11000/i.test(String(error?.message || "")) ||
      /duplicate key/i.test(String(error?.message || ""));
    if (isDupTx) {
      throw adminClientError("Transaction hash already used");
    }
    throw wrapAdminClientError(error, "Failed to mark withdrawal paid");
  } finally {
    session.endSession();
  }
};

export const adminRejectHybridWithdrawal = async (withdrawalId) => {
  if (!withdrawalId) {
    throw adminClientError("Withdrawal ID required");
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const withdrawal = await HybridWithdrawal.findById(withdrawalId).session(session);

    if (!withdrawal) {
      throw adminClientError("Withdrawal not found", 404);
    }

    if (
      withdrawal.status !== "pending" &&
      withdrawal.status !== "review" &&
      withdrawal.status !== "claimable" &&
      withdrawal.status !== "approved"
    ) {
      throw adminClientError("Already processed");
    }

    const rewardBack = Number(withdrawal.sourceRewardAmount || 0);
    const depositBack = Number(withdrawal.sourceDepositAmount || 0);
    const gross = Number(withdrawal.grossAmount || 0);

    if (rewardBack + depositBack <= 0 && gross > 0) {
      throw adminClientError("Cannot reject this withdrawal: missing source breakdown (legacy record)");
    }

    if (Math.abs(rewardBack + depositBack - gross) > 0.0001) {
      throw adminClientError("Source breakdown does not match gross amount; reject aborted");
    }

    const updatedWithdrawal = await HybridWithdrawal.findOneAndUpdate(
      { _id: withdrawalId, status: { $in: ["review", "pending", "claimable", "approved"] } },
      { $set: { status: "rejected" } },
      { new: true, session }
    );

    if (!updatedWithdrawal) {
      throw adminClientError("Unable to reject withdrawal");
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
        $set: { lastWithdrawRequest: null },
      },
      { new: true, session }
    );

    if (!updatedUser) {
      throw adminClientError("User balance state mismatch; reject aborted");
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
    throw wrapAdminClientError(error, "Failed to reject withdrawal");
  } finally {
    session.endSession();
  }
};
