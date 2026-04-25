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

/* ==============================
   🔐 ADMIN CHECK
============================== */
const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ msg: "Admin access only" });
    }

    next();
  } catch (err) {
    res.status(500).json({ msg: "Admin check error" });
  }
};

/* ==============================
   📥 DEPOSITS
============================== */
router.get("/deposits", auth, isAdmin, async (req, res) => {
  const deposits = await Deposit.find()
    .populate("userId", "username email")
    .sort({ createdAt: -1 });

  res.json({ success: true, deposits });
});

router.get("/deposits/pending", auth, isAdmin, async (req, res) => {
  const deposits = await Deposit.find({ status: "pending" })
    .populate("userId", "username email")
    .sort({ createdAt: -1 });

  res.json({ success: true, deposits });
});

router.post("/approve-deposit/:id", auth, isAdmin, approveDeposit);
router.post("/reject-deposit/:id", auth, isAdmin, rejectDeposit);

/* ==============================
   💸 WITHDRAWALS
============================== */
router.get("/withdrawals", auth, isAdmin, async (req, res) => {
  const withdrawals = await Withdrawal.find()
    .populate("userId", "username email")
    .sort({ createdAt: -1 });

  res.json({ success: true, withdrawals });
});

router.get("/withdrawals/pending", auth, isAdmin, async (req, res) => {
  const withdrawals = await Withdrawal.find({ status: "pending" })
    .populate("userId", "username email")
    .sort({ createdAt: -1 });

  res.json({ success: true, withdrawals });
});

router.post("/approve-withdrawal/:id", auth, isAdmin, approveWithdrawal);
router.post("/reject-withdrawal/:id", auth, isAdmin, rejectWithdrawal);

/* ==============================
   👤 USER MANAGEMENT
============================== */

// 📄 all users
router.get("/users", auth, isAdmin, async (req, res) => {
  const users = await User.find().select("-password").sort({ createdAt: -1 });

  res.json({ success: true, users });
});

// 🔒 block
router.post("/block/:id", auth, isAdmin, async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { isBlocked: true });

  res.json({ success: true, msg: "User blocked" });
});

// 🔓 unblock
router.post("/unblock/:id", auth, isAdmin, async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { isBlocked: false });

  res.json({ success: true, msg: "User unblocked" });
});

// 💰 reset wallet (dangerous → admin only)
router.post("/reset-wallet/:id", auth, isAdmin, async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, {
    balance: 0,
    totalEarnings: 0,
    totalWithdraw: 0,
  });

  res.json({ success: true, msg: "Wallet reset" });
});

/* ==============================
   📊 ADMIN STATS
============================== */
router.get("/stats", auth, isAdmin, async (req, res) => {
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
});

export default router;