import Withdrawal from "../models/Withdrawal.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";

//
// 🔥 CREATE WITHDRAWAL
//
export const createWithdrawal = async (req, res) => {
  try {
    let { amount, walletAddress } = req.body;

    amount = Number(amount);
    walletAddress = walletAddress?.trim();

    // ✅ VALIDATION
    if (!Number.isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ success: false, msg: "Amount must be a number greater than 0" });
    }

    if (!walletAddress || walletAddress.length < 8) {
      return res
        .status(400)
        .json({ success: false, msg: "Valid wallet address required" });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ success: false, msg: "Account blocked" });
    }

    const cooldownMs = 96 * 60 * 60 * 1000;
    const now = new Date();
    const cutoff = new Date(now.getTime() - cooldownMs);
    // 🔥 ATOMIC BALANCE DEDUCT
    const updated = await User.findOneAndUpdate(
      {
        _id: user._id,
        isBlocked: { $ne: true },
        balance: { $gte: amount },
        $or: [
          { lastWithdrawalAt: { $exists: false } },
          { lastWithdrawalAt: null },
          { lastWithdrawalAt: { $lte: cutoff } },
        ],
      },
      { $inc: { balance: -amount }, $set: { lastWithdrawalAt: now } },
      { new: true }
    );

    if (!updated) {
      const refreshed = await User.findById(user._id).select("balance lastWithdrawalAt");
      const lastAt = refreshed?.lastWithdrawalAt
        ? new Date(refreshed.lastWithdrawalAt).getTime()
        : null;
      const remainingMs = lastAt ? cooldownMs - (Date.now() - lastAt) : 0;

      if (remainingMs > 0) {
        return res.status(400).json({
          success: false,
          msg: "Withdrawal cooldown active",
          cooldownRemaining: Math.ceil(remainingMs / 1000),
        });
      }

      return res.status(400).json({ success: false, msg: "Insufficient balance" });
    }

    // ⏱ 96h delay
    const releaseAt = new Date(Date.now() + cooldownMs);

    let withdrawal;
    try {
      withdrawal = await Withdrawal.create({
        userId: user._id,
        amount,
        walletAddress,
        releaseAt,
        status: "pending",
      });

      // 🔥 CREATE TRANSACTION (HISTORY)
      await Transaction.findOneAndUpdate(
        { type: "withdraw", refId: withdrawal._id },
        {
          user: user._id,
          type: "withdraw",
          amount,
          status: "pending",
          refId: withdrawal._id,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (createErr) {
      await User.updateOne(
        { _id: user._id },
        { $inc: { balance: amount }, $set: { lastWithdrawalAt: user.lastWithdrawalAt || null } }
      );
      throw createErr;
    }
    console.log("USER:", req.user);
    console.log("WITHDRAW:", withdrawal);
    console.log("Withdrawal created:", {
      userId: req.user._id,
      withdrawalId: withdrawal._id,
      amount: withdrawal.amount,
    });

    res.json({
      success: true,
      data: { withdrawal },
    });

  } catch (err) {
    console.error("CREATE WITHDRAWAL ERROR:", err.message);
    res.status(500).json({ success: false, msg: err.message });
  }
};


//
// 📄 USER WITHDRAWALS
//
export const getMyWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { withdrawals },
    });

  } catch (err) {
    console.error("GET WITHDRAWALS ERROR:", err.message);
    res.status(500).json({ success: false, msg: err.message });
  }
};


//
// 🔥 ADMIN APPROVE
//
export const approveWithdrawal = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { status: "approved", approvedAt: new Date() },
      { new: true }
    );

    if (!withdrawal) {
      return res
        .status(400)
        .json({ success: false, msg: "Already processed or not found" });
    }

    // 🔥 UPDATE TRANSACTION
    await Transaction.findOneAndUpdate(
      { type: "withdraw", refId: withdrawal._id },
      {
        user: withdrawal.userId,
        type: "withdraw",
        amount: withdrawal.amount,
        status: "approved",
        refId: withdrawal._id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log("USER:", req.user);
    console.log("WITHDRAW:", withdrawal);
    console.log("Admin withdrawal approve:", {
      adminId: req.user._id,
      withdrawalId: withdrawal._id,
    });

    res.json({
      success: true,
      data: { withdrawal },
    });

  } catch (err) {
    console.error("APPROVE ERROR:", err.message);
    res.status(500).json({ success: false, msg: err.message });
  }
};


//
// ❌ ADMIN REJECT (SAFE REFUND)
//
export const rejectWithdrawal = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { status: "rejected", rejectedAt: new Date() },
      { new: true }
    );

    if (!withdrawal) {
      return res
        .status(400)
        .json({ success: false, msg: "Already processed or not found" });
    }

    // 🔁 REFUND
    await User.updateOne(
      { _id: withdrawal.userId },
      {
        $inc: {
          balance: withdrawal.amount,
        },
        $set: {
          lastWithdrawalAt: null,
        },
      }
    );

    // 🔥 UPDATE TRANSACTION
    await Transaction.findOneAndUpdate(
      { type: "withdraw", refId: withdrawal._id },
      {
        user: withdrawal.userId,
        type: "withdraw",
        amount: withdrawal.amount,
        status: "rejected",
        refId: withdrawal._id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log("USER:", req.user);
    console.log("WITHDRAW:", withdrawal);
    console.log("Admin withdrawal reject:", {
      adminId: req.user._id,
      withdrawalId: withdrawal._id,
    });

    res.json({
      success: true,
      data: { withdrawal },
    });

  } catch (err) {
    console.error("REJECT ERROR:", err.message);
    res.status(500).json({ success: false, msg: err.message });
  }
};