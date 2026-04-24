import Deposit from "../models/Deposit.js";
import User from "../models/User.js";

// 🔥 CREATE DEPOSIT (USER SIDE)
export const createDeposit = async (req, res) => {
  try {
    const { amount, txHash } = req.body;

    // ✅ VALIDATION
    if (!amount || amount < 10) {
      return res.status(400).json({ msg: "Minimum deposit is $10" });
    }

    if (!txHash) {
      return res.status(400).json({ msg: "Transaction hash required" });
    }

    // ❌ DUPLICATE TX CHECK
    const existing = await Deposit.findOne({ txHash });
    if (existing) {
      return res.status(400).json({ msg: "Transaction already used" });
    }

    // 🔥 CREATE
    const deposit = await Deposit.create({
      userId: req.user.id,
      amount,
      txHash,
      status: "pending",
    });

    res.json({
      success: true,
      msg: "Deposit submitted",
      deposit,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};

// 🔥 ADMIN APPROVE DEPOSIT
export const approveDeposit = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);

    if (!deposit) {
      return res.status(404).json({ msg: "Deposit not found" });
    }

    // ❌ ALREADY APPROVED CHECK
    if (deposit.status === "approved") {
      return res.status(400).json({ msg: "Already approved" });
    }

    // ✅ UPDATE STATUS
    deposit.status = "approved";
    await deposit.save();

    // 🔥 UPDATE USER BALANCE
    const user = await User.findById(deposit.userId);

    user.balance += deposit.amount;
    user.totalInvested += deposit.amount;

    await user.save();

    res.json({
      success: true,
      msg: "Deposit approved & balance updated",
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🔥 GET USER DEPOSITS
export const getMyDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find({ userId: req.user.id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      deposits,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};