import express from "express";
import auth from "../middleware/auth.js";
import User from "../models/User.js";
import Investment from "../models/Investment.js";

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
      "balance totalInvested totalWithdraw totalEarnings todayProfit isBlocked vipLevel directCount"
    );

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ msg: "Account blocked" });
    }

    res.json({
      success: true,
      stats: {
        balance: user.balance,
        totalInvested: user.totalInvested,
        totalWithdraw: user.totalWithdraw,
        totalEarnings: user.totalEarnings,
        todayProfit: user.todayProfit,
        vipLevel: user.vipLevel,
        directCount: user.directCount,
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
      "balance totalEarnings todayProfit vipLevel directCount"
    );

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ msg: "Account blocked" });
    }

    // 🔥 INVESTMENTS
    const investments = await Investment.find({ userId });

    let totalInvested = 0;
    let totalEarned = 0;
    let activePlans = 0;

    investments.forEach((inv) => {
      totalInvested += inv.amount;
      totalEarned += inv.totalEarned || 0;
      if (inv.status === "active") activePlans++;
    });

    res.json({
      success: true,
      dashboard: {
        balance: user.balance,
        todayProfit: user.todayProfit,
        totalEarned: user.totalEarnings,

        totalInvested,
        investmentProfit: totalEarned,

        activePlans,
        directCount: user.directCount,
        vipLevel: user.vipLevel,
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