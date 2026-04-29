import express from "express";
import bcrypt from "bcryptjs";
import auth from "../middleware/auth.js";
import User from "../models/User.js";
import HybridWithdrawal from "../hybrid/models/HybridWithdrawal.js";
import { getCurrentRoiRate } from "../hybrid/services/roiService.js";
import { requestWithdraw } from "../hybrid/controllers/withdrawController.js";

const sumPaidWithdrawalsGross = async (userId) => {
  const [row] = await HybridWithdrawal.aggregate([
    { $match: { userId, status: { $in: ["paid", "claimed"] } } },
    { $group: { _id: null, total: { $sum: "$grossAmount" } } },
  ]);
  return Number(row?.total || 0);
};

const router = express.Router();

/* ==============================
   👤 GET CURRENT USER
============================== */
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found", data: null });
    }

    if (user.isBlocked) {
      return res.status(403).json({ success: false, msg: "Account blocked", data: null });
    }

    res.json({
      success: true,
      msg: "User fetched",
      data: user,
      user,
    });

  } catch (err) {
    console.error("GET /me ERROR:", err.message);
    res.status(500).json({ success: false, msg: "Server error", data: null });
  }
});

router.post("/password", auth, async (req, res) => {
  try {
    let { currentPassword, newPassword } = req.body;
    currentPassword = currentPassword != null ? String(currentPassword) : "";
    newPassword = newPassword != null ? String(newPassword) : "";

    if (!currentPassword.trim() || !newPassword.trim()) {
      return res.status(400).json({
        success: false,
        msg: "Current password and new password are required",
        data: null,
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        msg: "New password must be at least 8 characters",
        data: null,
      });
    }

    const user = await User.findById(req.user._id).select("+password isBlocked");

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found", data: null });
    }

    if (user.isBlocked) {
      return res.status(403).json({ success: false, msg: "Account blocked", data: null });
    }

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return res.status(400).json({
        success: false,
        msg: "Current password is incorrect",
        data: null,
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ success: true, msg: "Password updated successfully", data: null });
  } catch (err) {
    console.error("POST /password ERROR:", err.message);
    return res.status(500).json({ success: false, msg: "Server error", data: null });
  }
});

/* ==============================
   📊 USER STATS (BASIC)
============================== */
router.get("/stats", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "depositBalance rewardBalance pendingWithdraw referralEarnings todayProfit totalEarnings isBlocked level directCount teamCount"
    );

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found", data: null });
    }

    if (user.isBlocked) {
      return res.status(403).json({ success: false, msg: "Account blocked", data: null });
    }

    const depositBalance = Number(user.depositBalance || 0);
    const rewardBalance = Number(user.rewardBalance || 0);
    const totalWithdrawPaid = await sumPaidWithdrawalsGross(user._id);

    const stats = {
      balance: depositBalance + rewardBalance,
      depositBalance,
      rewardBalance,
      pendingWithdraw: Number(user.pendingWithdraw || 0),
      totalInvested: depositBalance,
      totalWithdraw: totalWithdrawPaid,
      totalEarnings: Number(user.totalEarnings || 0),
      todayProfit: user.todayProfit,
      lastClaimProfit: user.todayProfit,
      vipLevel: user.level,
      level: Number(user.level || 0),
      roiRate: getCurrentRoiRate(user.level),
      directCount: user.directCount,
      teamCount: user.teamCount,
    };

    res.json({
      success: true,
      msg: "Stats fetched",
      data: stats,
      stats,
    });

  } catch (err) {
    console.error("GET /stats ERROR:", err.message);
    res.status(500).json({ success: false, msg: "Server error", data: null });
  }
});

/* ==============================
   📈 ADVANCED DASHBOARD (COMBINED)
============================== */
router.get("/dashboard", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select(
      "depositBalance rewardBalance pendingWithdraw referralEarnings todayProfit totalEarnings level directCount teamCount"
    );

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found", data: null });
    }

    if (user.isBlocked) {
      return res.status(403).json({ success: false, msg: "Account blocked", data: null });
    }

    const depositBalance = Number(user.depositBalance || 0);
    const rewardBalance = Number(user.rewardBalance || 0);
    const totalWithdrawPaid = await sumPaidWithdrawalsGross(userId);

    const dashboard = {
      balance: depositBalance + rewardBalance,
      depositBalance,
      rewardBalance,
      pendingWithdraw: Number(user.pendingWithdraw || 0),
      todayProfit: user.todayProfit,
      lastClaimProfit: user.todayProfit,
      totalEarned: rewardBalance,
      totalEarnings: Number(user.totalEarnings || 0),
      totalWithdraw: totalWithdrawPaid,

      totalInvested: depositBalance,
      investmentProfit: 0,

      activePlans: 0,
      directCount: user.directCount,
      teamCount: user.teamCount,
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

/* ==============================
   👥 TEAM MEMBERS (READ — referral tree A / B / C)
============================== */
router.get("/team-members", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    const viewer = await User.findById(userId).select("isBlocked");
    if (!viewer) {
      return res.status(404).json({ success: false, msg: "User not found", data: null });
    }
    if (viewer.isBlocked) {
      return res.status(403).json({ success: false, msg: "Account blocked", data: null });
    }

    const levelA = await User.find({ referredBy: userId })
      .select("username depositBalance rewardBalance createdAt")
      .lean();

    const levelAIds = levelA.map((u) => u._id);
    const levelB =
      levelAIds.length > 0
        ? await User.find({ referredBy: { $in: levelAIds } })
            .select("username depositBalance rewardBalance createdAt")
            .lean()
        : [];

    const levelBIds = levelB.map((u) => u._id);
    const levelC =
      levelBIds.length > 0
        ? await User.find({ referredBy: { $in: levelBIds } })
            .select("username depositBalance rewardBalance createdAt")
            .lean()
        : [];

    const format = (users, level) =>
      users.map((u) => ({
        id: String(u._id),
        username: u.username,
        level,
        joinedAt: u.createdAt,
        balance: Number(u.depositBalance || 0) + Number(u.rewardBalance || 0),
      }));

    const members = [
      ...format(levelA, "A"),
      ...format(levelB, "B"),
      ...format(levelC, "C"),
    ];

    return res.json({
      success: true,
      msg: "Team members loaded",
      data: members,
    });
  } catch (err) {
    console.error("Team members error:", err);
    return res.status(500).json({ success: false, msg: "Failed to load team", data: null });
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
      return res.status(404).json({ success: false, msg: "User not found", data: null });
    }

    const stats = {
      referralCode: user.referralCode,
      referralEarnings: user.referralEarnings || 0,
      directCount: user.directCount || 0,
      teamCount: user.teamCount || 0,
      teamVolume: user.teamVolume || 0,
    };

    res.json({
      success: true,
      msg: "Stats fetched",
      data: stats,
      stats,
    });
  } catch (err) {
    console.error("GET /referral-stats ERROR:", err.message);
    res.status(500).json({ success: false, msg: "Server error", data: null });
  }
});

/* ==============================
   💸 HYBRID WITHDRAW — POST /api/user/withdraw only
============================== */
router.post("/withdraw", auth, requestWithdraw);

export default router;