import express from "express";
import Deposit from "../models/Deposit.js";
import User from "../models/User.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/* ==============================
   🔐 ADMIN MIDDLEWARE (BASIC)
============================== */
const isAdmin = (req, res, next) => {
  // 👉 simple check (later upgrade karenge)
  if (!req.user) {
    return res.status(401).json({ msg: "Unauthorized" });
  }
  next();
};

/* ==============================
   📥 GET ALL DEPOSITS
============================== */
router.get("/deposits", auth, isAdmin, async (req, res) => {
  try {
    const deposits = await Deposit.find()
      .populate("userId", "username email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      deposits,
    });

  } catch (err) {
    res.status(500).json({ message: "Error fetching deposits" });
  }
});

/* ==============================
   ✅ APPROVE DEPOSIT
============================== */
router.post("/approve/:id", auth, isAdmin, async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);

    if (!deposit) {
      return res.status(404).json({ message: "Deposit not found" });
    }

    // ❌ already approved
    if (deposit.status === "approved") {
      return res.status(400).json({ message: "Already approved" });
    }

    // 🔥 UPDATE STATUS
    deposit.status = "approved";
    await deposit.save();

    // 🔥 UPDATE USER
    const user = await User.findById(deposit.userId);

    user.balance += deposit.amount;
    user.totalInvested += deposit.amount;

    await user.save();

    res.json({
      success: true,
      message: "Deposit approved & balance updated ✅",
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error approving deposit" });
  }
});

/* ==============================
   ❌ REJECT DEPOSIT
============================== */
router.post("/reject/:id", auth, isAdmin, async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);

    if (!deposit) {
      return res.status(404).json({ message: "Deposit not found" });
    }

    deposit.status = "rejected";
    await deposit.save();

    res.json({
      success: true,
      message: "Deposit rejected ❌",
    });

  } catch (err) {
    res.status(500).json({ message: "Error rejecting deposit" });
  }
});

export default router;