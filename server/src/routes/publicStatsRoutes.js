import express from "express";
import User from "../models/User.js";
import HybridDeposit from "../hybrid/models/HybridDeposit.js";
import HybridWithdrawal from "../hybrid/models/HybridWithdrawal.js";

const router = express.Router();

/** Public aggregate counts only (same definitions as GET /api/admin/stats). */
router.get("/platform-stats", async (_req, res) => {
  try {
    const [totalUsers, totalDeposits, totalWithdrawals] = await Promise.all([
      User.countDocuments(),
      HybridDeposit.countDocuments({
        status: { $in: ["credited", "swept"] },
      }),
      HybridWithdrawal.countDocuments({ status: "paid" }),
    ]);

    const stats = {
      totalUsers,
      totalDeposits,
      totalWithdrawals,
    };

    res.json({
      success: true,
      msg: "Platform stats",
      data: { stats },
      stats,
    });
  } catch (err) {
    console.error("GET /public/platform-stats:", err?.message || String(err));
    res.status(500).json({
      success: false,
      msg: "Could not load platform stats",
      data: null,
    });
  }
});

export default router;
