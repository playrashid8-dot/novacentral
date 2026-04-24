import express from "express";
import Deposit from "../models/Deposit.js";
import User from "../models/User.js";

const router = express.Router();

// 🔥 GET ALL DEPOSITS
router.get("/deposits", async (req, res) => {
  try {
    const deposits = await Deposit.find().populate("userId");
    res.json(deposits);
  } catch (err) {
    res.status(500).json({ message: "Error fetching deposits" });
  }
});

// 🔥 APPROVE DEPOSIT
router.post("/approve/:id", async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);

    if (!deposit) {
      return res.status(404).json({ message: "Deposit not found" });
    }

    if (deposit.status === "confirmed") {
      return res.json({ message: "Already approved" });
    }

    // 🔥 UPDATE USER BALANCE
    await User.findByIdAndUpdate(deposit.userId, {
      $inc: { balance: deposit.amount },
    });

    deposit.status = "confirmed";
    await deposit.save();

    res.json({ message: "Deposit approved ✅" });

  } catch (err) {
    res.status(500).json({ message: "Error approving deposit" });
  }
});

export default router;