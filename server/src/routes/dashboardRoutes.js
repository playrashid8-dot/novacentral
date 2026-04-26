import express from "express";
import auth from "../middleware/auth.js";
import User from "../models/User.js";
import Investment from "../models/Investment.js";
import Deposit from "../models/Deposit.js";
import Withdrawal from "../models/Withdrawal.js";

const router = express.Router();

/* ==============================
   📊 MAIN DASHBOARD DATA
============================== */
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // 🔍 USER
    const user = await User.findById(userId);

    // 📈 INVESTMENTS
    const investments = await Investment.find({ userId });

    let totalInvested = 0;
    let totalEarned = 0;
    let activePlans = 0;

    investments.forEach((inv) => {
      totalInvested += inv.amount;
      totalEarned += inv.totalEarned || 0;

      if (inv.status === "active") activePlans++;
    });

    // 💰 DEPOSITS
    const deposits = await Deposit.find({
      userId,
      status: "approved",
    });

    let totalDeposited = 0;
    deposits.forEach((d) => {
      totalDeposited += d.amount;
    });

    // 💸 WITHDRAWALS
    const withdrawals = await Withdrawal.find({
      userId,
      status: "approved",
    });

    let totalWithdrawn = 0;
    withdrawals.forEach((w) => {
      totalWithdrawn += w.amount;
    });

    // 👥 REFERRALS
    const directUsers = await User.find({ referredBy: userId });

    const referralIncome =
      user.totalEarnings - totalEarned; // approx split

    res.json({
      success: true,
      dashboard: {
        balance: user.balance,
        todayProfit: user.todayProfit,

        totalInvested,
        totalEarned,
        totalDeposited,
        totalWithdrawn,

        activePlans,
        directCount: directUsers.length,

        referralIncome,
        vipLevel: user.vipLevel,
      },
    });

  } catch (err) {
    console.error("DASHBOARD ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;