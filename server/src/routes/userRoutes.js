import express from "express";
import auth from "../middleware/auth.js";
import User from "../models/User.js";

const router = express.Router();

/* ==============================
   👤 GET CURRENT USER
============================== */
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json({
      success: true,
      user,
    });

  } catch (err) {
    console.log("User Route Error:", err.message);

    res.status(500).json({
      msg: "Server error",
    });
  }
});

/* ==============================
   📊 USER STATS (OPTIONAL)
============================== */
router.get("/stats", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.json({
      success: true,
      stats: {
        balance: user.balance,
        totalInvested: user.totalInvested,
        totalWithdraw: user.totalWithdraw,
        totalEarnings: user.totalEarnings,
        todayProfit: user.todayProfit,
      },
    });

  } catch (err) {
    res.status(500).json({ msg: "Stats error" });
  }
});

export default router;