import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const TOKEN_COOKIE_NAME = "token";

const getCookieOptions = () => ({
  httpOnly: true,
  secure: false,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
});

const setAuthCookie = (res, token) => {
  const options = getCookieOptions();
  res.cookie(TOKEN_COOKIE_NAME, token, options);
  console.log("SET COOKIE:", token);
};

const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);
const isValidPhone = (phone) => /^\+?\d{10,15}$/.test(phone);

const bumpTeamCounts = async (referredById) => {
  let current = referredById;

  while (current) {
    const parent = await User.findById(current).select("_id referredBy");
    if (!parent) break;

    await User.updateOne({ _id: parent._id }, { $inc: { teamCount: 1 } });
    current = parent.referredBy;
  }
};

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
    let { username, email, password, referralCode, number } = req.body;

    // 🔧 NORMALIZE
    username = username?.toLowerCase().trim();
    email = email?.toLowerCase().trim();
    number = number?.trim();

    // ✅ VALIDATION
    if (!username || !email || !password || !number) {
      return res.status(400).json({ msg: "All fields required" });
    }

    if (username.length < 3) {
      return res.status(400).json({ msg: "Username must be at least 3 characters" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ msg: "Invalid email address" });
    }

    if (!isValidPhone(number)) {
      return res.status(400).json({ msg: "Invalid phone number" });
    }

    if (password.length < 8) {
      return res.status(400).json({ msg: "Password must be at least 8 characters" });
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
      number,
      password: hashed,
      referralCode: await generateCode(),
      referredBy: refUser ? refUser._id : null,
    });

    if (refUser) {
      await bumpTeamCounts(refUser._id);
    }

    // 🔐 TOKEN
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // ✅ SAFE USER (no password)
    const safeUser = await User.findById(user._id).select("-password");

    setAuthCookie(res, token);

    res.json({
      success: true,
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

    if (username.length < 3 || password.length < 8) {
      return res.status(400).json({ msg: "Invalid credentials" });
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
    await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });

    setAuthCookie(res, token);

    res.json({
      success: true,
      user: safeUser,
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
};

export const logout = async (req, res) => {
  const clearOptions = {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  };

  console.log("CLEAR AUTH COOKIE:", clearOptions);
  res.clearCookie(TOKEN_COOKIE_NAME, clearOptions);

  res.json({
    success: true,
    msg: "Logged out successfully",
  });
};