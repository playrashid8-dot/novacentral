import express from "express";
import mongoose from "mongoose";
import auth from "../middleware/auth.js";
import User from "../models/User.js";
import HybridDeposit from "../hybrid/models/HybridDeposit.js";
import HybridWithdrawal from "../hybrid/models/HybridWithdrawal.js";
import {
  adminApproveHybridWithdrawal,
  adminMarkHybridWithdrawalPaid,
  adminRejectHybridWithdrawal,
} from "../hybrid/services/withdrawService.js";
import { scanHybridDeposits } from "../hybrid/services/depositListener.js";
import { getProvider } from "../hybrid/utils/provider.js";
import { getHybridAdminSystemStatus } from "../hybrid/utils/adminSystemStatus.js";
import { getRedis } from "../config/redis.js";
import { depositQueue } from "../queues/depositQueue.js";
import { writeAdminAudit } from "../utils/adminAudit.js";
import {
  buildAdminOverview,
  buildFraudSignals,
  salaryPayoutsPage,
  logFeed,
  getUserAdminDetail,
} from "../services/adminPanelService.js";

const router = express.Router();
const sendAdminError = (res, err, context) => {
  console.error(`${context}:`, err.message);
  return res.status(500).json({ success: false, msg: "Internal server error", data: null });
};

/** Legacy withdrawals may omit risk fields — keep admin UI stable. */
function normalizeHybridWithdrawRows(rows) {
  return (rows || []).map((w) => {
    const o = w && typeof w.toObject === "function" ? w.toObject() : { ...(w || {}) };
    return {
      ...o,
      riskScore: o.riskScore ?? 0,
      priority: o.priority ?? "normal",
    };
  });
}

/* ==============================
   🔐 ADMIN CHECK
============================== */
const isAdmin = async (req, res, next) => {
  try {
    if (!req.user?._id || req.user.isAdmin !== true) {
      return res.status(403).json({
        success: false,
        msg: "Admin access only",
        data: null,
      });
    }

    next();
  } catch (err) {
    console.error("ADMIN CHECK ERROR:", err.message);
    res.status(500).json({ success: false, msg: "Internal server error", data: null });
  }
};

/* ==============================
   💚 SYSTEM STATUS
============================== */
router.get("/system-status", auth, isAdmin, async (req, res) => {
  try {
    const status = await getHybridAdminSystemStatus();
    return res.json({
      success: true,
      msg: "System status",
      data: { status },
    });
  } catch (err) {
    return sendAdminError(res, err, "ADMIN SYSTEM STATUS ERROR");
  }
});

router.get("/system-health", auth, isAdmin, async (req, res) => {
  try {
    let queue = null;
    try {
      if (depositQueue) {
        queue = await depositQueue.getJobCounts();
      }
    } catch (err) {
      queue = { error: err?.message || String(err) };
    }
    return res.json({
      success: true,
      msg: "System health",
      data: {
        redis: !!getRedis(),
        queue,
        uptime: process.uptime(),
      },
    });
  } catch (err) {
    return sendAdminError(res, err, "ADMIN SYSTEM HEALTH ERROR");
  }
});

/* ==============================
   📥 HYBRID DEPOSITS
============================== */
router.get("/overview", auth, isAdmin, async (req, res) => {
  try {
    const overview = await buildAdminOverview();
    return res.json({
      success: true,
      msg: "Overview",
      data: { overview },
    });
  } catch (err) {
    return sendAdminError(res, err, "ADMIN OVERVIEW ERROR");
  }
});

router.get("/fraud-signals", auth, isAdmin, async (req, res) => {
  try {
    const signals = await buildFraudSignals();
    return res.json({
      success: true,
      msg: "Fraud signals",
      data: { signals },
    });
  } catch (err) {
    return sendAdminError(res, err, "ADMIN FRAUD SIGNALS ERROR");
  }
});

router.get("/salary-payouts", auth, isAdmin, async (req, res) => {
  try {
    const page = req.query.page;
    const limit = req.query.limit;
    const search = req.query.search;
    const data = await salaryPayoutsPage({
      page,
      limit,
      search,
    });
    return res.json({
      success: true,
      msg: "Salary payouts",
      data,
    });
  } catch (err) {
    return sendAdminError(res, err, "ADMIN SALARY PAYOUTS ERROR");
  }
});

router.get("/log-feed", auth, isAdmin, async (req, res) => {
  try {
    const type = String(req.query.type || "").toLowerCase();
    const allowed = ["admin", "withdraw", "deposit", "salary"];
    if (!allowed.includes(type)) {
      return res.status(400).json({
        success: false,
        msg: `type must be one of: ${allowed.join(", ")}`,
        data: null,
      });
    }
    const data = await logFeed({
      type,
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      adminId: req.query.adminId,
      userId: req.query.userId,
      actionType: req.query.actionType,
    });
    return res.json({
      success: true,
      msg: "Log feed",
      data,
    });
  } catch (err) {
    return sendAdminError(res, err, "ADMIN LOG FEED ERROR");
  }
});

router.get("/users/:id/detail", auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        msg: "Invalid user id",
        data: null,
      });
    }
    const detail = await getUserAdminDetail(id);
    if (!detail) {
      return res.status(404).json({ success: false, msg: "User not found", data: null });
    }
    return res.json({
      success: true,
      msg: "User detail",
      data: detail,
    });
  } catch (err) {
    return sendAdminError(res, err, "ADMIN USER DETAIL ERROR");
  }
});

router.post("/users/:id/fraud-flag", auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid user id", data: null });
    }
    const note = String(reason || "").trim().slice(0, 500);
    if (!note) {
      return res.status(400).json({
        success: false,
        msg: "Reason is required to flag user",
        data: null,
      });
    }
    const user = await User.findByIdAndUpdate(
      id,
      { $set: { adminFraudFlag: true, adminFraudReason: note } },
      { new: true }
    ).select("username email adminFraudFlag adminFraudReason");
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found", data: null });
    }
    await writeAdminAudit({
      adminId: req.user._id,
      category: "fraud",
      action: "User flagged for fraud review",
      targetUserId: id,
      meta: { reason: note },
    });
    return res.json({
      success: true,
      msg: "User flagged",
      data: { user },
    });
  } catch (err) {
    return sendAdminError(res, err, "ADMIN FRAUD FLAG ERROR");
  }
});

router.post("/users/:id/fraud-unflag", auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid user id", data: null });
    }
    const unflagReason = String(reason || "").trim();
    if (!unflagReason) {
      return res.status(400).json({
        success: false,
        msg: "Reason is required to clear fraud flag",
        data: null,
      });
    }
    const user = await User.findByIdAndUpdate(
      id,
      { $set: { adminFraudFlag: false, adminFraudReason: "" } },
      { new: true }
    ).select("username email adminFraudFlag adminFraudReason");
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found", data: null });
    }
    await writeAdminAudit({
      adminId: req.user._id,
      category: "fraud",
      action: "Fraud flag cleared",
      targetUserId: id,
      meta: { reason: unflagReason.slice(0, 500) },
    });
    return res.json({
      success: true,
      msg: "Fraud flag cleared",
      data: { user },
    });
  } catch (err) {
    return sendAdminError(res, err, "ADMIN FRAUD UNFLAG ERROR");
  }
});

router.get("/deposits", auth, isAdmin, async (req, res) => {
  try {
    const q = {};
    const { from, to } = req.query || {};
    if (from || to) {
      q.createdAt = {};
      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) q.createdAt.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) q.createdAt.$lte = d;
      }
    }
    const limRaw = Number(req.query.limit);
    const lim = Math.min(Math.max(Number.isFinite(limRaw) ? limRaw : 2500, 1), 5000);

    const deposits = await HybridDeposit.find(q)
      .populate("userId", "username email")
      .sort({ createdAt: -1 })
      .limit(lim);
    const latestDeposits = deposits.map((d) => ({
      txHash: d.txHash,
      wallet: d.walletAddress,
      amount: d.amount,
      status: d.status,
      createdAt: d.createdAt,
    }));
    res.json({
      success: true,
      msg: "Deposits fetched successfully",
      data: { deposits, latestDeposits },
      deposits,
      latestDeposits,
    });
  } catch (err) {
    sendAdminError(res, err, "ADMIN DEPOSITS ERROR");
  }
});

router.get("/deposits/pending", auth, isAdmin, async (req, res) => {
  try {
    const deposits = await HybridDeposit.find({ status: { $in: ["credited", "swept"] } })
      .populate("userId", "username email")
      .sort({ createdAt: -1 });
    res.json({
      success: true,
      msg: "Credited hybrid deposits fetched successfully",
      data: { deposits },
      deposits,
    });
  } catch (err) {
    sendAdminError(res, err, "ADMIN PENDING DEPOSITS ERROR");
  }
});

/* ==============================
   💸 HYBRID WITHDRAWALS
============================== */
router.get("/withdrawals", auth, isAdmin, async (req, res) => {
  try {
    const rows = await HybridWithdrawal.find()
      .populate("userId", "username email")
      .sort({ priority: 1, riskScore: -1, createdAt: -1 });
    const withdrawals = normalizeHybridWithdrawRows(rows);
    res.json({
      success: true,
      msg: "Withdrawals fetched successfully",
      data: { withdrawals },
      withdrawals,
    });
  } catch (err) {
    sendAdminError(res, err, "ADMIN WITHDRAWALS ERROR");
  }
});

router.get("/withdrawals/pending", auth, isAdmin, async (req, res) => {
  try {
    const rows = await HybridWithdrawal.find({
      status: { $in: ["review", "pending", "claimable", "approved"] },
    })
      .populate("userId", "username email")
      .sort({ priority: 1, riskScore: -1, createdAt: -1 });
    const withdrawals = normalizeHybridWithdrawRows(rows);
    res.json({
      success: true,
      msg: "Pending withdrawals fetched successfully",
      data: { withdrawals },
      withdrawals,
    });
  } catch (err) {
    sendAdminError(res, err, "ADMIN PENDING WITHDRAWALS ERROR");
  }
});

router.post("/hybrid/withdraw/approve", auth, isAdmin, async (req, res) => {
  try {
    const { withdrawalId } = req.body || {};
    if (!withdrawalId || String(withdrawalId).trim() === "") {
      return res.status(400).json({ success: false, msg: "Invalid ID", data: {} });
    }
    const data = await adminApproveHybridWithdrawal(withdrawalId, req.user._id);
    await writeAdminAudit({
      adminId: req.user._id,
      category: "withdraw",
      action: "Withdrawal approved",
      targetUserId: data?.userId,
      meta: { withdrawalId: String(withdrawalId), status: data?.status, netAmount: data?.netAmount },
    });
    return res.json({ success: true, msg: "Withdrawal approved", data: { withdrawal: data } });
  } catch (err) {
    console.error("ADMIN WITHDRAW APPROVE ERROR:", err.message);
    return res.status(400).json({ success: false, msg: "Request failed", data: null });
  }
});

router.post("/hybrid/withdraw/pay", auth, isAdmin, async (req, res) => {
  try {
    const { withdrawalId, txHash } = req.body || {};
    if (!withdrawalId || String(withdrawalId).trim() === "") {
      return res.status(400).json({ success: false, msg: "Invalid ID", data: {} });
    }
    if (!txHash || String(txHash).trim() === "") {
      return res.status(400).json({ success: false, msg: "txHash required", data: {} });
    }
    const data = await adminMarkHybridWithdrawalPaid(withdrawalId, txHash, req.user._id);
    await writeAdminAudit({
      adminId: req.user._id,
      category: "withdraw",
      action: "Withdrawal marked paid",
      targetUserId: data?.withdrawal?.userId ?? data?.userId,
      meta: { withdrawalId: String(withdrawalId), txHash: String(txHash).trim() },
    });
    return res.json({ success: true, msg: "Withdrawal marked as paid", data });
  } catch (err) {
    console.error("ADMIN WITHDRAW PAY ERROR:", err.message);
    return res.status(400).json({ success: false, msg: "Request failed", data: null });
  }
});

router.post("/hybrid/withdraw/reject", auth, isAdmin, async (req, res) => {
  try {
    const { withdrawalId } = req.body || {};
    if (!withdrawalId || String(withdrawalId).trim() === "") {
      return res.status(400).json({ success: false, msg: "Invalid ID", data: {} });
    }
    const data = await adminRejectHybridWithdrawal(withdrawalId);
    await writeAdminAudit({
      adminId: req.user._id,
      category: "withdraw",
      action: "Withdrawal rejected",
      targetUserId: data?.userId,
      meta: { withdrawalId: String(withdrawalId) },
    });
    return res.json({ success: true, msg: "Withdrawal rejected and refunded", data: { withdrawal: data } });
  } catch (err) {
    console.error("ADMIN WITHDRAW REJECT ERROR:", err.message);
    return res.status(400).json({ success: false, msg: "Request failed", data: null });
  }
});

/** REST-style withdraw actions (same services as body-based hybrid routes) */
router.post("/withdraw/approve/:id", auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || String(id).trim() === "") {
      return res.status(400).json({ success: false, msg: "Invalid ID", data: {} });
    }
    const data = await adminApproveHybridWithdrawal(id, req.user._id);
    await writeAdminAudit({
      adminId: req.user._id,
      category: "withdraw",
      action: "Withdrawal approved",
      targetUserId: data?.userId,
      meta: { withdrawalId: String(id), status: data?.status, netAmount: data?.netAmount },
    });
    return res.json({ success: true, msg: "Withdrawal approved", data: { withdrawal: data } });
  } catch (err) {
    console.error("ADMIN REST WITHDRAW APPROVE ERROR:", err.message);
    return res.status(400).json({ success: false, msg: "Request failed", data: null });
  }
});

router.post("/withdraw/reject/:id", auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || String(id).trim() === "") {
      return res.status(400).json({ success: false, msg: "Invalid ID", data: {} });
    }
    const data = await adminRejectHybridWithdrawal(id);
    await writeAdminAudit({
      adminId: req.user._id,
      category: "withdraw",
      action: "Withdrawal rejected",
      targetUserId: data?.userId,
      meta: { withdrawalId: String(id) },
    });
    return res.json({ success: true, msg: "Withdrawal rejected and refunded", data: { withdrawal: data } });
  } catch (err) {
    console.error("ADMIN REST WITHDRAW REJECT ERROR:", err.message);
    return res.status(400).json({ success: false, msg: "Request failed", data: null });
  }
});

/* ==============================
   🔁 DEPOSIT RESCAN & RECOVERY
============================== */

/** Last-N-blocks backup sweep (admin trigger; duplicate-safe via listener) */
router.post("/recover-deposits", auth, isAdmin, async (req, res) => {
  try {
    console.log("🛟 Admin triggered recovery scan (last 1000 blocks)");
    const result = await scanHybridDeposits(null, null, {
      blocks: 1000,
      logEmptyOnZero: true,
    });
    console.log(
      `📦 Recovery job queued — deposit jobs enqueued: ${result?.processed ?? 0}`
    );
    await writeAdminAudit({
      adminId: req.user._id,
      category: "admin",
      action: "Recovery scan triggered (recover-deposits)",
      meta: { processed: result?.processed ?? 0 },
    });
    return res.json({
      success: true,
      msg: "Recovery scan executed",
      data: result,
    });
  } catch (err) {
    console.error("❌ Recovery failed:", err?.message || String(err));
    return res.status(500).json({ success: false, msg: "Internal server error", data: null });
  }
});

/** Deep scan between explicit blocks (manual rescan) */
router.post("/rescan-deposits", auth, isAdmin, async (req, res) => {
  try {
    const { fromBlock, toBlock } = req.body || {};
    const fromN = Number(fromBlock);
    const toN = Number(toBlock);
    if (
      fromBlock === undefined ||
      fromBlock === null ||
      toBlock === undefined ||
      toBlock === null ||
      !Number.isFinite(fromN) ||
      !Number.isFinite(toN) ||
      fromN < 0 ||
      toN < 0 ||
      fromN > toN
    ) {
      return res.status(400).json({
        success: false,
        msg: "Valid fromBlock and toBlock (0 ≤ fromBlock ≤ toBlock) required",
        data: null,
      });
    }
    console.log("🔎 Admin deep rescan range:", fromN, "→", toN);
    const result = await scanHybridDeposits(fromN, toN, { isManualRescan: true });
    await writeAdminAudit({
      adminId: req.user._id,
      category: "admin",
      action: "Deep rescan deposits",
      meta: { fromBlock: fromN, toBlock: toN },
    });
    return res.json({
      success: true,
      msg: "Deep rescan completed",
      data: result,
    });
  } catch (err) {
    console.error("❌ Deep rescan failed:", err?.message || String(err));
    return res.status(500).json({ success: false, msg: "Internal server error", data: null });
  }
});

/** Resolve tx → block window and scan (±5 blocks) */
router.post("/recover-by-tx", auth, isAdmin, async (req, res) => {
  try {
    const { txHash } = req.body || {};
    const normalized = String(txHash || "").trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) {
      return res.status(400).json({
        success: false,
        msg: "Valid txHash (0x + 64 hex chars) required",
        data: null,
      });
    }
    console.log(
      "🔎 Recover-by-tx: resolving block from receipt:",
      `${normalized.slice(0, 10)}…${normalized.slice(-6)}`
    );
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(normalized);
    if (!receipt) {
      return res.status(400).json({
        success: false,
        msg: "Transaction not found or not yet mined",
        data: null,
      });
    }
    const bn = Number(receipt.blockNumber);
    if (!Number.isFinite(bn)) {
      return res.status(400).json({
        success: false,
        msg: "Invalid block number on receipt",
        data: null,
      });
    }
    const fromBlk = Math.max(0, bn - 5);
    const toBlk = bn + 5;
    console.log("🔎 Deep scan range:", fromBlk, toBlk);
    const result = await scanHybridDeposits(fromBlk, toBlk, { isManualRescan: true });
    await writeAdminAudit({
      adminId: req.user._id,
      category: "admin",
      action: "Recover deposit by TX",
      meta: { txHashNormalized: normalized.slice(0, 12) + "…" },
    });
    return res.json({
      success: true,
      msg: "Recover by TX completed",
      data: { ...result, blockNumber: bn },
    });
  } catch (err) {
    console.error("❌ Recover by TX failed:", err?.message || String(err));
    return res.status(500).json({ success: false, msg: "Internal server error", data: null });
  }
});

/* ==============================
   👤 USER MANAGEMENT
============================== */

// 📄 all users
router.get("/users", auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    const userSummaries = users.map((u) => ({
      _id: u._id,
      username: u.username,
      wallet: u.walletAddress,
      depositBalance: u.depositBalance,
      totalEarned: u.totalEarnings,
      vipLevel: u.vipLevel,
    }));
    res.json({
      success: true,
      msg: "Users fetched",
      data: { users, userSummaries },
      users,
      userSummaries,
    });
  } catch (err) {
    sendAdminError(res, err, "ADMIN USERS ERROR");
  }
});

router.post("/set-vip", auth, isAdmin, async (req, res) => {
  try {
    const { userId, vipLevel } = req.body || {};
    const id = String(userId || "").trim();
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        msg: "Valid userId required",
        data: null,
      });
    }
    const level = Number(vipLevel);
    if (!Number.isFinite(level) || level < 0) {
      return res.status(400).json({
        success: false,
        msg: "vipLevel must be a non-negative number",
        data: null,
      });
    }
    const nextLevel = Math.floor(level);
    const user = await User.findByIdAndUpdate(
      id,
      { $set: { vipLevel: nextLevel } },
      { new: true }
    ).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found", data: null });
    }
    console.log("👑 VIP updated:", userId);
    await writeAdminAudit({
      adminId: req.user._id,
      category: "admin",
      action: `VIP set to ${nextLevel}`,
      targetUserId: id,
      meta: { vipLevel: nextLevel },
    });
    return res.json({
      success: true,
      msg: "VIP level updated",
      data: { user },
    });
  } catch (err) {
    return sendAdminError(res, err, "ADMIN SET VIP ERROR");
  }
});

// 🔒 block
router.post("/block/:id", auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || String(id).trim() === "") {
      return res.status(400).json({ success: false, msg: "Invalid ID", data: {} });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: true }, { new: true });
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found", data: null });
    }
    await writeAdminAudit({
      adminId: req.user._id,
      category: "user",
      action: "User blocked",
      targetUserId: id,
      meta: {},
    });
    res.json({ success: true, msg: "User blocked", data: null });
  } catch (err) {
    sendAdminError(res, err, "ADMIN BLOCK ERROR");
  }
});

// 🔓 unblock
router.post("/unblock/:id", auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || String(id).trim() === "") {
      return res.status(400).json({ success: false, msg: "Invalid ID", data: {} });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: false }, { new: true });
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found", data: null });
    }
    await writeAdminAudit({
      adminId: req.user._id,
      category: "user",
      action: "User unblocked",
      targetUserId: id,
      meta: {},
    });
    res.json({ success: true, msg: "User unblocked", data: null });
  } catch (err) {
    sendAdminError(res, err, "ADMIN UNBLOCK ERROR");
  }
});

// 💰 reset wallet (dangerous → admin only)
router.post("/reset-wallet/:id", auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || String(id).trim() === "") {
      return res.status(400).json({ success: false, msg: "Invalid ID", data: {} });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        balance: 0,
        totalEarnings: 0,
        totalWithdraw: 0,
        depositBalance: 0,
        rewardBalance: 0,
        pendingWithdraw: 0,
      },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found", data: null });
    }
    await writeAdminAudit({
      adminId: req.user._id,
      category: "admin",
      action: "Wallet reset by admin",
      targetUserId: id,
      meta: {},
    });
    res.json({ success: true, msg: "Wallet reset", data: null });
  } catch (err) {
    sendAdminError(res, err, "ADMIN RESET WALLET ERROR");
  }
});

/* ==============================
   📊 ADMIN STATS
============================== */
router.get("/stats", auth, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalDeposits = await HybridDeposit.countDocuments({
      status: { $in: ["credited", "swept"] },
    });
    const totalWithdrawals = await HybridWithdrawal.countDocuments({ status: "paid" });

    const users = await User.find();

    let totalBalance = 0;
    let totalEarnings = 0;

    users.forEach((u) => {
      totalBalance += u.balance;
      totalEarnings += u.totalEarnings;
    });

    const statsPayload = {
      totalUsers,
      totalDeposits,
      totalWithdrawals,
      totalBalance,
      totalEarnings,
    };

    res.json({
      success: true,
      msg: "Stats fetched",
      data: { stats: statsPayload },
      stats: statsPayload,
    });
  } catch (err) {
    sendAdminError(res, err, "ADMIN STATS ERROR");
  }
});

export default router;
