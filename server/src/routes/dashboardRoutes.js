import express from "express";
import auth from "../middleware/auth.js";
import User from "../models/User.js";
import HybridDeposit from "../hybrid/models/HybridDeposit.js";
import HybridWithdrawal from "../hybrid/models/HybridWithdrawal.js";
import { getCurrentRoiRate } from "../hybrid/services/roiService.js";

const router = express.Router();

/* ==============================
   📊 MAIN DASHBOARD DATA
============================== */
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // 🔍 USER
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found", data: null });
    }

    // 💰 HYBRID DEPOSITS
    const deposits = await HybridDeposit.find({
      userId,
      status: { $in: ["credited", "swept"] },
    });

    let totalDeposited = 0;
    deposits.forEach((d) => {
      totalDeposited += d.amount;
    });

    // 💸 HYBRID WITHDRAWALS
    const withdrawals = await HybridWithdrawal.find({
      userId,
      status: { $in: ["paid", "claimed"] },
    });

    let totalWithdrawn = 0;
    withdrawals.forEach((w) => {
      totalWithdrawn += Number(w.grossAmount || 0);
    });

    // 👥 REFERRALS
    const directUsers = await User.find({ referredBy: userId });

    const depositBalance = Number(user.depositBalance || 0);
    const rewardBalance = Number(user.rewardBalance || 0);
    const hybridBalance = depositBalance + rewardBalance;

    const dashboard = {
      balance: hybridBalance,
      depositBalance,
      rewardBalance,
      pendingWithdraw: Number(user.pendingWithdraw || 0),
      todayProfit: Number(user.todayProfit || 0),
      lastClaimProfit: Number(user.todayProfit || 0),

      totalInvested: depositBalance,
      totalEarned: rewardBalance,
      totalDeposited,
      totalWithdrawn,

      activePlans: 0,
      directCount: directUsers.length,
      teamCount: Number(user.teamCount || 0),

      referralIncome: Number(user.referralEarnings || 0),
      vipLevel: user.level,
      level: Number(user.level || 0),
      roiRate: getCurrentRoiRate(user.level),
    };

    res.json({
      success: true,
      msg: "Dashboard data",
      data: dashboard,
      dashboard,
    });

  } catch (err) {
    console.error("DASHBOARD ERROR:", err.message);
    res.status(500).json({ success: false, msg: "Server error", data: null });
  }
});

export default router;