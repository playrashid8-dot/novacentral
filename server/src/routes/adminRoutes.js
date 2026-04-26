import express from "express";
import auth from "../middleware/auth.js";
import User from "../models/User.js";
import Deposit from "../models/Deposit.js";
import Withdrawal from "../models/Withdrawal.js";

// 🔥 controllers
import {
  approveDeposit,
  rejectDeposit,
} from "../controllers/depositController.js";

import {
  approveWithdrawal,
  rejectWithdrawal,
} from "../controllers/withdrawalController.js";

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
   📥 DEPOSITS
============================== */
router.get("/deposits", auth, isAdmin, async (req, res) => {
  try {
    const deposits = await Deposit.find()
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
    const deposits = await Deposit.find({ status: "pending" })
      .populate("userId", "username email")
      .sort({ createdAt: -1 });
    res.json({
      success: true,
      msg: "Pending deposits fetched successfully",
      data: { deposits },
      deposits,
    });
  } catch (err) {
    sendAdminError(res, err, "ADMIN PENDING DEPOSITS ERROR");
  }
});

router.post("/approve-deposit/:id", auth, isAdmin, approveDeposit);
router.post("/reject-deposit/:id", auth, isAdmin, rejectDeposit);

/* ==============================
   💸 WITHDRAWALS
============================== */
router.get("/withdrawals", auth, isAdmin, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find()
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
    const withdrawals = await Withdrawal.find({ status: "pending" })
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

router.post("/approve-withdrawal/:id", auth, isAdmin, approveWithdrawal);
router.post("/reject-withdrawal/:id", auth, isAdmin, rejectWithdrawal);

/* ==============================
   👤 USER MANAGEMENT
============================== */

// 📄 all users
router.get("/users", auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    sendAdminError(res, err, "ADMIN USERS ERROR");
  }
});

// 🔒 block
router.post("/block/:id", auth, isAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: true }, { new: true });
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json({ success: true, msg: "User blocked" });
  } catch (err) {
    sendAdminError(res, err, "ADMIN BLOCK ERROR");
  }
});

// 🔓 unblock
router.post("/unblock/:id", auth, isAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: false }, { new: true });
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json({ success: true, msg: "User unblocked" });
  } catch (err) {
    sendAdminError(res, err, "ADMIN UNBLOCK ERROR");
  }
});

// 💰 reset wallet (dangerous → admin only)
router.post("/reset-wallet/:id", auth, isAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        balance: 0,
        totalEarnings: 0,
        totalWithdraw: 0,
      },
      { new: true }
    );
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json({ success: true, msg: "Wallet reset" });
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
    const totalDeposits = await Deposit.countDocuments({ status: "approved" });
    const totalWithdrawals = await Withdrawal.countDocuments({ status: "approved" });

    const users = await User.find();

    let totalBalance = 0;
    let totalEarnings = 0;

    users.forEach((u) => {
      totalBalance += u.balance;
      totalEarnings += u.totalEarnings;
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalDeposits,
        totalWithdrawals,
        totalBalance,
        totalEarnings,
      },
    });
  } catch (err) {
    sendAdminError(res, err, "ADMIN STATS ERROR");
  }
});

export default router;