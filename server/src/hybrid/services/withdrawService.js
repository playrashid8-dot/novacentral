import mongoose from "mongoose";
import { Contract, Interface, isAddress, getAddress, parseUnits, Wallet } from "ethers";
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
import { getProvider, withProviderRetry } from "../utils/provider.js";
import { ensureMonthWindow, WITHDRAW_DELAY_MS } from "../utils/time.js";
import { addHybridLedgerEntries } from "./ledgerService.js";
import { getSpendableHybridBalance, splitHybridBalance } from "./balanceService.js";
import {
  completeIdempotency,
  failIdempotency,
  getCompletedIdempotency,
  markIdempotencyProcessing,
  releaseIdempotentAction,
} from "./idempotencyService.js";

const getMonthlyLimit = (level) => WITHDRAW_MONTHLY_LIMITS[Math.min(Number(level || 0), 3)] || 0;

export const allowedWithdrawTransitions = {
  pending: ["approved", "rejected"],
  approved: ["paid"],
  rejected: [],
  paid: [],
};

const assertWithdrawTransition = (currentStatus, nextStatus) => {
  const current = String(currentStatus || "");
  const allowed = allowedWithdrawTransitions[current] || [];

  if (!allowed.includes(nextStatus)) {
    throw adminClientError(`Invalid withdrawal transition: ${current || "unknown"} → ${nextStatus}`);
  }
};

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
  const withdrawIdempotencyKey = idempotencyKey
    ? `${String(userId)}:${String(idempotencyKey).trim().toLowerCase()}`
    : null;

  if (withdrawIdempotencyKey) {
    const storedResponse = await getCompletedIdempotency("withdraw", withdrawIdempotencyKey);
    if (storedResponse?.withdrawalId) {
      const withdrawal = await HybridWithdrawal.findById(storedResponse.withdrawalId);
      if (withdrawal) {
        return { withdrawal };
      }
    }

    const previous = await HybridWithdrawal.findOne({ userId, idempotencyKey });

    if (previous?.idempotencyResponse) {
      return previous.idempotencyResponse.data;
    }
  }

  const session = await mongoose.startSession();

  try {
    let result = null;

    session.startTransaction();

      if (withdrawIdempotencyKey) {
        await markIdempotencyProcessing("withdraw", withdrawIdempotencyKey, session);
      }

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
      const initialStatus = "pending";

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

        await completeIdempotency(
          "withdraw",
          withdrawIdempotencyKey,
          {
            withdrawalId: String(withdrawal._id),
            status: withdrawal.status,
            grossAmount: numericAmount,
          },
          session
        );
      }

    await session.commitTransaction();

    return result;
  } catch (error) {
    await session.abortTransaction();
    if (withdrawIdempotencyKey) {
      await failIdempotency("withdraw", withdrawIdempotencyKey, error);
    }
    throw new Error(error.message || "Failed to request withdrawal");
  } finally {
    session.endSession();
  }
};

/**
 * User "claim" is now a lock-window readiness check only.
 * Strict financial states stay pending → approved → paid or pending → rejected.
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

    if (withdrawal.status === "approved" || withdrawal.status === "paid") {
      result = {
        withdrawalId: withdrawal._id,
        status: withdrawal.status,
        netAmount: Number(withdrawal.netAmount || 0),
        feeAmount: Number(withdrawal.feeAmount || 0),
      };
      await session.commitTransaction();
      return result;
    }

    if (withdrawal.status !== "pending") {
      throw new Error("Withdrawal cannot be claimed in its current state");
    }

    if (new Date(withdrawal.availableAt).getTime() > Date.now()) {
      throw new Error("Withdrawal is still locked for 96 hours");
    }

    result = {
      withdrawalId: withdrawal._id,
      status: withdrawal.status,
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

const adminClientError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const wrapAdminClientError = (error, fallback) => {
  const wrapped = new Error(error?.message || fallback);
  wrapped.statusCode = error?.statusCode;
  if (!wrapped.statusCode) {
    wrapped.statusCode = 500;
  }
  return wrapped;
};

const transferEventIface = new Interface(BSC_USDT_ABI);
const PAYOUT_LOCK_MS = Number(process.env.HYBRID_WITHDRAW_PAYOUT_LOCK_MS || 5 * 60 * 1000);

const getPayoutPrivateKey = () =>
  String(process.env.HYBRID_PAYOUT_PRIVATE_KEY || "").trim();

export const canAutoExecuteWithdrawals = () =>
  Boolean(getPayoutPrivateKey() && hybridConfig.usdtContract);

const getPayoutContract = () => {
  const payoutKey = getPayoutPrivateKey();
  if (!payoutKey) {
    throw new Error("HYBRID_PAYOUT_PRIVATE_KEY missing");
  }
  if (!hybridConfig.usdtContract) {
    throw new Error("USDT contract not configured");
  }

  const signer = new Wallet(payoutKey, getProvider());
  return new Contract(hybridConfig.usdtContract, BSC_USDT_ABI, signer);
};

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

const storePayoutFailure = async (withdrawalId, error) => {
  await HybridWithdrawal.findOneAndUpdate(
    {
      _id: withdrawalId,
      status: "approved",
    },
    {
      $set: {
        payoutLastError: String(error?.message || error || "Payout failed").slice(0, 500),
        payoutLockedUntil: null,
        payoutStatus: "failed",
      },
    }
  );
};

export const executeApprovedWithdrawalPayout = async (withdrawalId = null) => {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + PAYOUT_LOCK_MS);

  const withdrawal = await HybridWithdrawal.findOneAndUpdate(
    {
      ...(withdrawalId ? { _id: withdrawalId } : {}),
      status: "approved",
      paidAt: null,
      $or: [
        { payoutLockedUntil: null },
        { payoutLockedUntil: { $exists: false } },
        { payoutLockedUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        payoutLockedUntil: lockUntil,
        payoutStartedAt: now,
        payoutLastError: "",
        payoutStatus: "sending",
      },
      $inc: {
        payoutAttemptCount: 1,
      },
    },
    {
      new: true,
      sort: { approvedAt: 1, createdAt: 1 },
    }
  );

  if (!withdrawal) {
    return { processed: false, reason: "none_available" };
  }

  const payoutKey = `withdrawal:${String(withdrawal._id)}`;
  let txHash = normalizeTxHash(withdrawal.txHash);

  try {
    if (txHash) {
      const result = await markHybridWithdrawalPaidAfterAutoVerification(withdrawal._id, txHash);
      return { processed: true, ...result };
    }

    const storedResponse = await getCompletedIdempotency("payout", payoutKey);
    if (storedResponse?.txHash) {
      const result = await markHybridWithdrawalPaidAfterAutoVerification(
        withdrawal._id,
        storedResponse.txHash
      );
      return { processed: true, ...result };
    }

    await markIdempotencyProcessing("payout", payoutKey);

    const token = getPayoutContract();
    const amountWei = parseUnits(String(withdrawal.netAmount), HYBRID_TOKEN.decimals);
    const tx = await token.transfer(withdrawal.walletAddress, amountWei);
    txHash = normalizeTxHash(tx.hash);

    if (!txHash) {
      throw new Error("Payout transaction hash missing after broadcast");
    }

    const stored = await HybridWithdrawal.findOneAndUpdate(
      {
        _id: withdrawal._id,
        status: "approved",
        paidAt: null,
        $or: [{ txHash: null }, { txHash: "" }],
      },
      {
        $set: {
          txHash,
          payoutStatus: "verifying",
        },
      },
      { new: true }
    );

    if (!stored) {
      throw new Error("Unable to store payout transaction hash");
    }

    await tx.wait(1);

    await verifyPayoutTransferInReceipt(txHash, withdrawal.walletAddress, withdrawal.netAmount);
    const result = await markHybridWithdrawalPaidAfterAutoVerification(withdrawal._id, txHash);
    await completeIdempotency(
      "payout",
      payoutKey,
      {
        withdrawalId: String(withdrawal._id),
        txHash,
        status: "paid",
      }
    );
    return { processed: true, ...result };
  } catch (error) {
    if (!txHash) {
      await releaseIdempotentAction("payout", payoutKey);
    }
    await storePayoutFailure(withdrawal._id, error);
    throw error;
  }
};

export const runAutoWithdrawExecutorBatch = async (limit = 5) => {
  if (!canAutoExecuteWithdrawals()) {
    return { enabled: false, processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;
  const max = Math.max(1, Number(limit) || 5);

  for (let i = 0; i < max; i += 1) {
    try {
      const result = await executeApprovedWithdrawalPayout();
      if (!result?.processed) {
        break;
      }
      processed += 1;
    } catch (err) {
      failed += 1;
      console.error("Auto withdraw executor failed:", err?.message || String(err));
    }
  }

  return { enabled: true, processed, failed };
};

/** Strict state machine: no automatic state changes before admin approval. */
export const autoMarkClaimable = async () => {
  return { modifiedCount: 0 };
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

    assertWithdrawTransition(withdrawal.status, "approved");

    if (new Date(withdrawal.availableAt).getTime() > Date.now()) {
      throw adminClientError("Withdrawal lock period (96h) is still active");
    }

    const updated = await HybridWithdrawal.findOneAndUpdate(
      {
        _id: withdrawalId,
        status: "pending",
        approvedAt: null,
        paidAt: null,
      },
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

const markHybridWithdrawalPaidAfterAutoVerification = async (withdrawalId, txHash) => {
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
  assertWithdrawTransition(head.status, "paid");

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
          payoutStatus: "idle",
          payoutLockedUntil: null,
          payoutLastError: "",
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

export const adminMarkHybridWithdrawalPaid = async () => {
  throw adminClientError("Manual mark-paid is disabled. Approved withdrawals are paid by the auto executor.", 410);
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

    assertWithdrawTransition(withdrawal.status, "rejected");

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
      {
        _id: withdrawalId,
        status: "pending",
        approvedAt: null,
        paidAt: null,
      },
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
