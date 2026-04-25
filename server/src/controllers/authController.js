import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

//
// 🔥 SAFE REFERRAL CODE GENERATOR (NO DUPLICATE)
//
const generateCode = async () => {
  let code;
  let exists = true;

  while (exists) {
    code = "NC" + Math.random().toString(36).substring(2, 8).toUpperCase();
    exists = await User.findOne({ referralCode: code });
  }

  return code;
};

//
// 🔥 REGISTER / SIGNUP
//
export const register = async (req, res) => {
  try {
    let { username, email, password, referralCode } = req.body;

    // 🔧 NORMALIZE
    username = username?.toLowerCase().trim();
    email = email?.toLowerCase().trim();

    // ✅ VALIDATION
    if (!username || !email || !password) {
      return res.status(400).json({ msg: "All fields required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ msg: "Password must be at least 6 characters" });
    }

    // ✅ CHECK DUPLICATE
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    // 🔐 HASH PASSWORD
    const hashed = await bcrypt.hash(password, 10);

    // 👥 REFERRAL
    let refUser = null;
    if (referralCode) {
      refUser = await User.findOne({ referralCode });

      if (refUser) {
        // 🔥 SAFE DIRECT COUNT
        await User.updateOne(
          { _id: refUser._id },
          { $inc: { directCount: 1 } }
        );
      }
    }

    // 🔥 CREATE USER
    const user = await User.create({
      username,
      email,
      password: hashed,
      referralCode: await generateCode(),
      referredBy: refUser ? refUser._id : null,
    });

    // 🔐 TOKEN
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // ✅ SAFE USER (no password)
    const safeUser = await User.findById(user._id).select("-password");

    res.json({
      success: true,
      token,
      user: safeUser,
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
};

//
// 🔐 LOGIN (USERNAME BASED)
//
export const login = async (req, res) => {
  try {
    let { username, password } = req.body;

    username = username?.toLowerCase().trim();

    if (!username || !password) {
      return res.status(400).json({ msg: "Enter username & password" });
    }

    // 🔍 FIND USER (WITH PASSWORD)
    const user = await User.findOne({ username }).select("+password");

    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // 🔒 BLOCK CHECK
    if (user.isBlocked) {
      return res.status(403).json({ msg: "Account blocked" });
    }

    // 🔑 PASSWORD MATCH
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // 🔐 TOKEN
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // ✅ SAFE USER
    const safeUser = await User.findById(user._id).select("-password");

    res.json({
      success: true,
      token,
      user: safeUser,
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
};