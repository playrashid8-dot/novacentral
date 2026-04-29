import express from "express";
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

const router = express.Router();
const sendAdminError = (res, err, context) => {
  console.error(`${context}:`, err.message);
  return res.status(500).json({ success: false, msg: err.message, data: null });
};

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
    res.status(500).json({ success: false, msg: err.message, data: null });
  }
};

/* ==============================
   📥 HYBRID DEPOSITS
============================== */
router.get("/deposits", auth, isAdmin, async (req, res) => {
  try {
    const deposits = await HybridDeposit.find()
      .populate("userId", "username email")
      .sort({ createdAt: -1 });
    res.json({
      success: true,
      msg: "Deposits fetched successfully",
      data: { deposits },
      deposits,
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
    const withdrawals = await HybridWithdrawal.find()
      .populate("userId", "username email")
      .sort({ createdAt: -1 });
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
    const withdrawals = await HybridWithdrawal.find({
      status: { $in: ["pending", "claimable", "approved"] },
    })
      .populate("userId", "username email")
      .sort({ createdAt: -1 });
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
    return res.json({ success: true, msg: "Withdrawal approved", data: { withdrawal: data } });
  } catch (err) {
    return res.status(400).json({ success: false, msg: err.message, data: null });
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
    return res.json({ success: true, msg: "Withdrawal marked as paid", data });
  } catch (err) {
    return res.status(400).json({ success: false, msg: err.message, data: null });
  }
});

router.post("/hybrid/withdraw/reject", auth, isAdmin, async (req, res) => {
  try {
    const { withdrawalId } = req.body || {};
    if (!withdrawalId || String(withdrawalId).trim() === "") {
      return res.status(400).json({ success: false, msg: "Invalid ID", data: {} });
    }
    const data = await adminRejectHybridWithdrawal(withdrawalId);
    return res.json({ success: true, msg: "Withdrawal rejected and refunded", data: { withdrawal: data } });
  } catch (err) {
    return res.status(400).json({ success: false, msg: err.message, data: null });
  }
});

/* ==============================
   🔁 DEPOSIT RESCAN & RECOVERY
============================== */

/** Last-N-blocks backup sweep (same shape as auto recovery, for admin trigger) */
router.post("/recover-deposits", auth, isAdmin, async (req, res) => {
  try {
    console.log("🛟 Admin recover last deposits (backup window)…");
    let result = await scanHybridDeposits(null, null, { blocks: 2000 });
    if (result && result.skipped === false && result.processed === 0) {
      console.log("⚠️ No deposits found — expanding scan range");
      result = await scanHybridDeposits(null, null, { blocks: 5000 });
    }
    return res.json({
      success: true,
      msg: "Recover scan completed",
      data: result,
    });
  } catch (err) {
    console.error("❌ Recover last deposits failed:", err?.message || String(err));
    return res.status(500).json({ success: false, msg: err.message, data: null });
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
    console.log("🛟 Admin deep rescan:", fromN, toN);
    console.log("🔎 Deep scan range:", fromN, toN);
    const result = await scanHybridDeposits(fromN, toN, { isManualRescan: true });
    return res.json({
      success: true,
      msg: "Deep rescan completed",
      data: result,
    });
  } catch (err) {
    console.error("❌ Deep rescan failed:", err?.message || String(err));
    return res.status(500).json({ success: false, msg: err.message, data: null });
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
    console.log("📦 Recovery job queued:", normalized);
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
    return res.json({
      success: true,
      msg: "Recover by TX completed",
      data: { ...result, blockNumber: bn },
    });
  } catch (err) {
    console.error("❌ Recover by TX failed:", err?.message || String(err));
    return res.status(500).json({ success: false, msg: err.message, data: null });
  }
});

/* ==============================
   👤 USER MANAGEMENT
============================== */

// 📄 all users
router.get("/users", auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({
      success: true,
      msg: "Users fetched",
      data: { users },
      users,
    });
  } catch (err) {
    sendAdminError(res, err, "ADMIN USERS ERROR");
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
