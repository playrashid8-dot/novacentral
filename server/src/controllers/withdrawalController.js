import Withdrawal from "../models/Withdrawal.js";
import User from "../models/User.js";

//
// 🔥 CREATE WITHDRAWAL
//
export const createWithdrawal = async (req, res) => {
  try {
    let { amount, walletAddress } = req.body;

    amount = Number(amount);

    // ✅ VALIDATION
    if (!amount || amount < 5) {
      return res.status(400).json({ msg: "Minimum withdrawal is $5" });
    }

    if (!walletAddress) {
      return res.status(400).json({ msg: "Wallet address required" });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ msg: "Account blocked" });
    }

    // 🔥 ATOMIC BALANCE DEDUCT (NO DOUBLE WITHDRAW)
    const updated = await User.findOneAndUpdate(
      { _id: user._id, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({ msg: "Insufficient balance" });
    }

    // ⏱ 96h delay
    const releaseAt = new Date(Date.now() + 96 * 60 * 60 * 1000);

    const withdrawal = await Withdrawal.create({
      userId: user._id,
      amount,
      walletAddress,
      releaseAt,
      status: "pending",
    });

    res.json({
      success: true,
      msg: "Withdrawal request submitted",
      withdrawal,
    });

  } catch (err) {
    console.error("CREATE WITHDRAWAL ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
};


//
// 📄 USER WITHDRAWALS
//
export const getMyWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ userId: req.user.id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      withdrawals,
    });

  } catch (err) {
    console.error("GET WITHDRAWALS ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
};


//
// 🔥 ADMIN APPROVE (SAFE)
//
export const approveWithdrawal = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { status: "approved", approvedAt: new Date() },
      { new: true }
    );

    if (!withdrawal) {
      return res.status(400).json({ msg: "Already processed or not found" });
    }

    res.json({
      success: true,
      msg: "Withdrawal approved",
    });

  } catch (err) {
    console.error("APPROVE ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
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
      return res.status(400).json({ msg: "Already processed or not found" });
    }

    // 🔁 REFUND (ATOMIC)
    await User.updateOne(
      { _id: withdrawal.userId },
      {
        $inc: {
          balance: withdrawal.amount,
        },
      }
    );

    res.json({
      success: true,
      msg: "Rejected & refunded",
    });

  } catch (err) {
    console.error("REJECT ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
};