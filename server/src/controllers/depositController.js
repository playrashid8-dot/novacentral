import Deposit from "../models/Deposit.js";
import User from "../models/User.js";

// CREATE DEPOSIT
export const createDeposit = async (req, res) => {
  try {
    const { amount, txHash } = req.body;

    const deposit = await Deposit.create({
      userId: req.user.id,
      amount,
      txHash,
    });

    res.json({ msg: "Deposit submitted", deposit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ADMIN APPROVE
export const approveDeposit = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);

    if (!deposit) return res.status(404).json({ msg: "Not found" });

    deposit.status = "approved";
    await deposit.save();

    // update user balance
    const user = await User.findById(deposit.userId);
    user.balance += deposit.amount;
    user.totalDeposit += deposit.amount;
    await user.save();

    res.json({ msg: "Deposit approved" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};