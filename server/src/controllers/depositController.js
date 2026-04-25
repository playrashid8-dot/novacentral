import Deposit from "../models/Deposit.js";
import User from "../models/User.js";
import { distributeReferralIncome } from "../utils/referral.js";

//
// 🔥 CREATE DEPOSIT (USER)
//
export const createDeposit = async (req, res) => {
  try {
    let { amount, txHash } = req.body;

    // 🔧 NORMALIZE
    txHash = txHash?.trim().toLowerCase();

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
    console.error("CREATE DEPOSIT ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
};


//
// 🔥 ADMIN APPROVE DEPOSIT (SAFE + ATOMIC + REFERRAL)
//
export const approveDeposit = async (req, res) => {
  try {
    // 🔒 ATOMIC FIND + UPDATE (prevents double approve)
    const deposit = await Deposit.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { status: "approved", approvedAt: new Date() },
      { new: true }
    );

    if (!deposit) {
      return res.status(400).json({ msg: "Already processed or not found" });
    }

    // 🔍 FIND USER
    const user = await User.findById(deposit.userId);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // 🔒 BLOCK CHECK
    if (user.isBlocked) {
      return res.status(403).json({ msg: "User is blocked" });
    }

    // 🔥 ATOMIC BALANCE UPDATE
    await User.updateOne(
      { _id: user._id },
      {
        $inc: {
          balance: deposit.amount,
          totalInvested: deposit.amount,
        },
      }
    );

    // 🔥 REFERRAL + VIP SYSTEM
    await distributeReferralIncome(user._id, deposit.amount);

    res.json({
      success: true,
      msg: "Deposit approved + referral distributed",
    });

  } catch (err) {
    console.error("APPROVE ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
};


//
// ❌ ADMIN REJECT DEPOSIT
//
export const rejectDeposit = async (req, res) => {
  try {
    const deposit = await Deposit.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { status: "rejected", rejectedAt: new Date() },
      { new: true }
    );

    if (!deposit) {
      return res.status(400).json({ msg: "Already processed or not found" });
    }

    res.json({
      success: true,
      msg: "Deposit rejected",
    });

  } catch (err) {
    console.error("REJECT ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
};


//
// 📜 GET USER DEPOSITS
//
export const getMyDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find({ userId: req.user.id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      deposits,
    });

  } catch (err) {
    console.error("GET DEPOSITS ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
};