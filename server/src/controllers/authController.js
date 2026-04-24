import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// 🔥 REGISTER / SIGNUP
export const register = async (req, res) => {
  try {
    const { username, email, password, referralCode } = req.body;

    // ✅ VALIDATION
    if (!username || !email || !password) {
      return res.status(400).json({ msg: "All fields required" });
    }

    // ✅ CHECK EXIST
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ msg: "User already exists" });
    }

    // 🔐 HASH PASSWORD
    const hashed = await bcrypt.hash(password, 10);

    // 👥 REFERRAL (optional)
    let refUser = null;
    if (referralCode) {
      refUser = await User.findOne({ referralCode });
    }

    // 🔥 CREATE USER
    const user = await User.create({
      username,
      email,
      password: hashed,
      referralCode: generateCode(),
      referredBy: refUser ? refUser._id : null,
      balance: 0,
      totalEarnings: 0,
      todayProfit: 0,
      totalInvested: 0,
      totalWithdraw: 0,
    });

    // 🔐 TOKEN
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // ✅ RESPONSE (IMPORTANT)
    res.json({
      success: true,
      token,
      user,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};

// 🔐 LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 🔍 FIND USER
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ msg: "User not found" });
    }

    // 🔑 CHECK PASSWORD
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({ msg: "Wrong password" });
    }

    // 🔐 TOKEN
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // ✅ RESPONSE
    res.json({
      success: true,
      token,
      user,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🔥 GENERATE REFERRAL CODE
const generateCode = () => {
  return "NC" + Math.random().toString(36).substring(2, 8).toUpperCase();
};