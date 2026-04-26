import Deposit from "../models/Deposit.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { distributeReferralIncome } from "../utils/referral.js";

//
// 🔥 CREATE DEPOSIT (USER)
//
export const createDeposit = async (req, res) => {
  try {
    let { amount, txHash } = req.body;

    // 🔧 NORMALIZE
    amount = Number(amount);
    txHash = txHash?.trim().toLowerCase();

    // ✅ VALIDATION (STRONG)
    if (!Number.isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ success: false, msg: "Amount must be a number greater than 0" });
    }

    if (!txHash) {
      return res
        .status(400)
        .json({ success: false, msg: "Transaction hash is required" });
    }

    // 🔥 CREATE DEPOSIT
    let deposit;
    try {
      deposit = await Deposit.create({
        userId: req.user._id,
        amount,
        txHash,
        status: "pending",
      });
    } catch (createErr) {
      if (createErr?.code === 11000) {
        return res
          .status(409)
          .json({ success: false, msg: "Transaction hash already used" });
      }
      throw createErr;
    }

    // 🔥 CREATE TRANSACTION (SAFE - NO DUPLICATE)
    await Transaction.findOneAndUpdate(
      { type: "deposit", refId: deposit._id },
      {
        user: req.user._id,
        type: "deposit",
        amount,
        status: "pending",
        refId: deposit._id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log("USER:", req.user);
    console.log("DEPOSIT:", deposit);
    console.log("Deposit created:", {
      userId: req.user._id,
      depositId: deposit._id,
      amount: deposit.amount,
    });

    res.json({
      success: true,
      data: { deposit },
    });

  } catch (err) {
    console.error("CREATE DEPOSIT ERROR:", err.message);
    res.status(500).json({ success: false, msg: err.message });
  }
};


//
// 🔥 ADMIN APPROVE DEPOSIT
//
export const approveDeposit = async (req, res) => {
  try {
    // 🔒 ATOMIC UPDATE (avoid double approve)
    const deposit = await Deposit.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { status: "approved", approvedAt: new Date() },
      { new: true }
    );

    if (!deposit) {
      return res
        .status(400)
        .json({ success: false, msg: "Already processed or not found" });
    }

    // 🔍 USER
    const user = await User.findById(deposit.userId);

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ success: false, msg: "User is blocked" });
    }

    // 🔥 SAFE BALANCE UPDATE
    await User.updateOne(
      { _id: user._id },
      {
        $inc: {
          balance: deposit.amount,
          totalInvested: deposit.amount,
        },
      }
    );

    // 🔥 REFERRAL DISTRIBUTION
    await distributeReferralIncome(user._id, deposit.amount);

    // 🔥 UPDATE TRANSACTION (SAFE)
    await Transaction.findOneAndUpdate(
      { type: "deposit", refId: deposit._id },
      {
        user: deposit.userId,
        type: "deposit",
        amount: deposit.amount,
        status: "approved",
        refId: deposit._id,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    console.log("USER:", req.user);
    console.log("DEPOSIT:", deposit);
    console.log("Admin deposit approve:", {
      adminId: req.user._id,
      depositId: deposit._id,
    });

    res.json({
      success: true,
      data: { deposit },
    });

  } catch (err) {
    console.error("APPROVE ERROR:", err.message);
    res.status(500).json({ success: false, msg: err.message });
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
      return res
        .status(400)
        .json({ success: false, msg: "Already processed or not found" });
    }

    // 🔥 UPDATE TRANSACTION (SAFE)
    await Transaction.findOneAndUpdate(
      { type: "deposit", refId: deposit._id },
      {
        user: deposit.userId,
        type: "deposit",
        amount: deposit.amount,
        status: "rejected",
        refId: deposit._id,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    console.log("USER:", req.user);
    console.log("DEPOSIT:", deposit);
    console.log("Admin deposit reject:", {
      adminId: req.user._id,
      depositId: deposit._id,
    });

    res.json({
      success: true,
      data: { deposit },
    });

  } catch (err) {
    console.error("REJECT ERROR:", err.message);
    res.status(500).json({ success: false, msg: err.message });
  }
};


//
// 📜 GET USER DEPOSITS
//
export const getMyDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { deposits },
    });

  } catch (err) {
    console.error("GET DEPOSITS ERROR:", err.message);
    res.status(500).json({ success: false, msg: err.message });
  }
};