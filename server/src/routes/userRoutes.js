import express from "express";
import auth from "../middleware/auth.js";
import User from "../models/User.js";
import { getCurrentRoiRate } from "../hybrid/services/roiService.js";

const router = express.Router();

/* ==============================
   👤 GET CURRENT USER
============================== */
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ msg: "Account blocked" });
    }

    res.json({
      success: true,
      user,
    });

  } catch (err) {
    console.error("GET /me ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

/* ==============================
   📊 USER STATS (BASIC)
============================== */
router.get("/stats", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "depositBalance rewardBalance pendingWithdraw referralEarnings todayProfit isBlocked level directCount teamCount"
    );

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ msg: "Account blocked" });
    }

    const depositBalance = Number(user.depositBalance || 0);
    const rewardBalance = Number(user.rewardBalance || 0);

    res.json({
      success: true,
      stats: {
        balance: depositBalance + rewardBalance,
        depositBalance,
        rewardBalance,
        pendingWithdraw: Number(user.pendingWithdraw || 0),
        totalInvested: depositBalance,
        totalWithdraw: Number(user.pendingWithdraw || 0),
        totalEarnings: rewardBalance,
        todayProfit: user.todayProfit,
        vipLevel: user.level,
        level: Number(user.level || 0),
        roiRate: getCurrentRoiRate(user.level),
        directCount: user.directCount,
        teamCount: user.teamCount,
      },
    });

  } catch (err) {
    console.error("GET /stats ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

/* ==============================
   📈 ADVANCED DASHBOARD (COMBINED)
============================== */
router.get("/dashboard", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select(
      "depositBalance rewardBalance pendingWithdraw referralEarnings todayProfit level directCount teamCount"
    );

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ msg: "Account blocked" });
    }

    const depositBalance = Number(user.depositBalance || 0);
    const rewardBalance = Number(user.rewardBalance || 0);

    res.json({
      success: true,
      dashboard: {
        balance: depositBalance + rewardBalance,
        depositBalance,
        rewardBalance,
        pendingWithdraw: Number(user.pendingWithdraw || 0),
        todayProfit: user.todayProfit,
        totalEarned: rewardBalance,

        totalInvested: depositBalance,
        investmentProfit: 0,

        activePlans: 0,
        directCount: user.directCount,
        teamCount: user.teamCount,
        vipLevel: user.level,
        level: Number(user.level || 0),
        roiRate: getCurrentRoiRate(user.level),
      },
    });

  } catch (err) {
    console.error("DASHBOARD ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

/* ==============================
   👥 REFERRAL STATS
============================== */
router.get("/referral-stats", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "referralCode referralEarnings directCount teamCount teamVolume"
    );

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json({
      success: true,
      stats: {
        referralCode: user.referralCode,
        referralEarnings: user.referralEarnings || 0,
        directCount: user.directCount || 0,
        teamCount: user.teamCount || 0,
        teamVolume: user.teamVolume || 0,
      },
    });
  } catch (err) {
    console.error("GET /referral-stats ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;