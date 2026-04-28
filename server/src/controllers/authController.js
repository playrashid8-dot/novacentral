import User from "../models/User.js";
import Otp, { OTP_PURPOSE } from "../models/Otp.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createUserWallet } from "../hybrid/services/walletService.js";
import { updateUserLevel } from "../hybrid/services/levelService.js";
import { sendEmail, isMailConfigured } from "../utils/mailService.js";

export { OTP_PURPOSE };

const OTP_TTL_MS = 5 * 60 * 1000;

const TOKEN_COOKIE_NAME = "token";

const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  };
};

const setAuthCookie = (res, token) => {
  const options = getCookieOptions();
  res.cookie(TOKEN_COOKIE_NAME, token, options);
};

const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);
const isValidPhone = (phone) => /^\+?\d{10,15}$/.test(phone);

const sendAuthResponse = (res, status, success, msg, data = null) =>
  res.status(status).json({ success, msg, data });

//
// 📧 SIGNUP OTP (public)
//
export const sendSignupOtp = async (req, res) => {
  try {
    let { email } = req.body;

    email = email?.toLowerCase().trim();

    if (!email || !isValidEmail(email)) {
      return sendAuthResponse(res, 400, false, "Valid email required");
    }

    if (!isMailConfigured()) {
      return sendAuthResponse(res, 503, false, "Email service not configured");
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return sendAuthResponse(res, 400, false, "An account already exists with this email");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.deleteMany({ email, purpose: OTP_PURPOSE.SIGNUP });

    await Otp.create({
      email,
      otp,
      purpose: OTP_PURPOSE.SIGNUP,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    await sendEmail(email, "Your OTP code", `Your OTP is: ${otp}\nExpires in 5 minutes.`);

    return sendAuthResponse(res, 200, true, "OTP sent to email", null);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("SEND SIGNUP OTP ERROR:", err.message);
    } else {
      console.error("SEND SIGNUP OTP ERROR");
    }
    return sendAuthResponse(res, 500, false, "Failed to send OTP");
  }
};

export const sendOtp = sendSignupOtp;

//
// 📧 WITHDRAW OTP (authenticated — sends to account email)
//
export const sendWithdrawOtp = async (req, res) => {
  try {
    if (!isMailConfigured()) {
      return sendAuthResponse(res, 503, false, "Email service not configured");
    }

    const user = await User.findById(req.user._id).select("email isBlocked");

    if (!user) {
      return sendAuthResponse(res, 404, false, "User not found");
    }

    if (user.isBlocked) {
      return sendAuthResponse(res, 403, false, "Account blocked");
    }

    const email = String(user.email || "").toLowerCase().trim();

    if (!email || !isValidEmail(email)) {
      return sendAuthResponse(res, 400, false, "Invalid account email");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.deleteMany({ email, purpose: OTP_PURPOSE.WITHDRAW });

    await Otp.create({
      email,
      otp,
      purpose: OTP_PURPOSE.WITHDRAW,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    await sendEmail(
      email,
      "Withdrawal verification code",
      `Your withdrawal OTP is: ${otp}\nExpires in 5 minutes.\nIf you did not request a withdrawal, ignore this email.`
    );

    return sendAuthResponse(res, 200, true, "OTP sent to email", null);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("SEND WITHDRAW OTP ERROR:", err.message);
    } else {
      console.error("SEND WITHDRAW OTP ERROR");
    }
    return sendAuthResponse(res, 500, false, "Failed to send OTP");
  }
};

/**
 * Single-use: removes the OTP row on success so it cannot be reused.
 */
export const verifyOtp = async (email, otp, purpose) => {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const otpStr = String(otp || "").trim();

  if (!normalizedEmail || !otpStr) {
    return false;
  }

  if (![OTP_PURPOSE.SIGNUP, OTP_PURPOSE.WITHDRAW].includes(purpose)) {
    return false;
  }

  if (!/^[0-9]{6}$/.test(otpStr)) {
    return false;
  }

  const deleted = await Otp.findOneAndDelete({
    email: normalizedEmail,
    otp: otpStr,
    purpose,
    expiresAt: { $gt: new Date() },
  });

  return Boolean(deleted);
};

const bumpTeamCounts = async (referredById) => {
  let current = referredById;

  while (current) {
    const parent = await User.findById(current).select("_id referredBy");
    if (!parent) break;

    await User.updateOne({ _id: parent._id }, { $inc: { teamCount: 1 } });
    await updateUserLevel(parent._id);
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
    let { username, email, password, referralCode, number, otp } = req.body;

    // 🔧 NORMALIZE
    username = username?.toLowerCase().trim();
    email = email?.toLowerCase().trim();
    number = number?.trim();
    otp = String(otp || "").trim();

    if (!email || !otp) {
      return sendAuthResponse(res, 400, false, "Email and OTP required");
    }

    // ✅ VALIDATION
    if (!username || !email || !password || !number || !otp) {
      return sendAuthResponse(res, 400, false, "All fields required including OTP");
    }

    if (username.length < 3) {
      return sendAuthResponse(res, 400, false, "Username must be at least 3 characters");
    }

    if (!isValidEmail(email)) {
      return sendAuthResponse(res, 400, false, "Invalid email address");
    }

    if (!isValidPhone(number)) {
      return sendAuthResponse(res, 400, false, "Invalid phone number");
    }

    if (password.length < 8) {
      return sendAuthResponse(res, 400, false, "Password must be at least 8 characters");
    }

    if (!/^[0-9]{6}$/.test(otp)) {
      return sendAuthResponse(res, 400, false, "OTP must be a 6-digit code");
    }

    // ✅ CHECK DUPLICATE (before OTP verify so we don't burn a code on bad input)
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return sendAuthResponse(res, 400, false, "User already exists");
    }

    const otpOk = await verifyOtp(email, otp, OTP_PURPOSE.SIGNUP);
    if (!otpOk) {
      return sendAuthResponse(res, 400, false, "Invalid or expired OTP");
    }

    // 🔐 HASH PASSWORD
    const hashed = await bcrypt.hash(password, 10);

    let wallet;
    try {
      wallet = await createUserWallet();
    } catch (error) {
      console.error("WALLET GENERATION ERROR:", error.message);
      return sendAuthResponse(res, 500, false, "Wallet generation failed");
    }

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
        await updateUserLevel(refUser._id);
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
      referrer: refUser ? refUser._id : null,
      walletAddress: wallet.address,
      privateKey: wallet.privateKey,
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
    const safeUser = await User.findById(user._id).select("-password -privateKey");

    setAuthCookie(res, token);

    return sendAuthResponse(res, 200, true, "Account created successfully", {
      user: safeUser,
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err.message);
    if (err?.code === 11000) {
      return sendAuthResponse(res, 400, false, "User already exists");
    }

    return sendAuthResponse(res, 500, false, "Server error");
  }
};

export const me = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password -privateKey");

    if (!user) {
      return sendAuthResponse(res, 404, false, "User not found");
    }

    if (user.isBlocked) {
      return sendAuthResponse(res, 403, false, "Account blocked");
    }

    return sendAuthResponse(res, 200, true, "User fetched successfully", {
      user,
    });
  } catch (err) {
    console.error("AUTH ME ERROR:", err.message);
    return sendAuthResponse(res, 500, false, "Server error");
  }
};

//
// 🔐 LOGIN (USERNAME OR EMAIL)
//
export const login = async (req, res) => {
  try {
    let { identifier, username, email, password } = req.body;

    identifier = (identifier || username || email)?.trim();

    if (!identifier || !password) {
      return sendAuthResponse(res, 400, false, "Enter identifier & password");
    }

    if (identifier.length < 3 || password.length < 8) {
      return sendAuthResponse(res, 400, false, "Invalid credentials");
    }

    // 🔍 FIND USER (WITH PASSWORD)
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier },
      ],
    }).select("+password");

    if (!user) {
      return sendAuthResponse(res, 400, false, "Invalid credentials");
    }

    // 🔒 BLOCK CHECK
    if (user.isBlocked) {
      return sendAuthResponse(res, 403, false, "Account blocked");
    }

    // 🔑 PASSWORD MATCH
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return sendAuthResponse(res, 400, false, "Invalid credentials");
    }

    // 🔐 TOKEN
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // ✅ SAFE USER
    const safeUser = await User.findById(user._id).select("-password -privateKey");
    await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });

    setAuthCookie(res, token);

    return sendAuthResponse(res, 200, true, "Login successful", {
      user: safeUser,
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err.message);
    return sendAuthResponse(res, 500, false, "Server error");
  }
};

export const logout = async (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  const clearOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };

  res.clearCookie(TOKEN_COOKIE_NAME, clearOptions);

  return sendAuthResponse(res, 200, true, "Logged out successfully");
};