import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { createUserWallet } from "../hybrid/services/walletService.js";
import { addUserToHybridDepositRealtimeMap } from "../hybrid/services/userMap.js";
import { updateUserLevel } from "../hybrid/services/levelService.js";
import { normalizeStoredWalletAddress } from "../utils/normalizeStoredWallet.js";

const TOKEN_COOKIE_NAME = "token";

const getCookieOptions = () => {
  const isProd =
    process.env.NODE_ENV === "production" ||
    process.env.RAILWAY_ENVIRONMENT === "production";

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
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

const bumpTeamCounts = async (referredById) => {
  let current = referredById;
  const visited = new Set();

  while (current && !visited.has(String(current))) {
    visited.add(String(current));
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
    code = "NC" + crypto.randomBytes(4).toString("hex").toUpperCase();
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
      return sendAuthResponse(res, 400, false, "All fields required");
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

    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return sendAuthResponse(res, 400, false, "User already exists");
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
    }

    const normalizedWalletAddress = normalizeStoredWalletAddress(wallet.address);

    const user = await User.create({
      username,
      email,
      number,
      password: hashed,
      referralCode: await generateCode(),
      referredBy: refUser ? refUser._id : null,
      referrer: refUser ? refUser._id : null,
      walletAddress: normalizedWalletAddress,
      privateKey: wallet.privateKey,
    });

    addUserToHybridDepositRealtimeMap({
      _id: user._id,
      walletAddress: normalizeStoredWalletAddress(user.walletAddress),
    });

    if (refUser) {
      await User.updateOne(
        { _id: refUser._id },
        { $inc: { directCount: 1 } }
      );
      await updateUserLevel(refUser._id);
      await bumpTeamCounts(refUser._id);
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    const safeUser = await User.findById(user._id).select("-password -privateKey");

    setAuthCookie(res, token);

    return sendAuthResponse(res, 200, true, "Signup successful", {
      user: safeUser,
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err.message);
    if (err?.code === 11000) {
      if (err?.keyPattern?.walletAddress || err?.keyValue?.walletAddress) {
        return sendAuthResponse(res, 409, false, "Wallet already assigned, please retry signup");
      }

      return sendAuthResponse(res, 400, false, "User already exists");
    }

    return sendAuthResponse(res, 500, false, "Internal server error");
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
    return sendAuthResponse(res, 500, false, "Internal server error");
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

    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier },
      ],
    }).select("+password");

    if (!user) {
      return sendAuthResponse(res, 400, false, "Invalid credentials");
    }

    if (user.isBlocked) {
      return sendAuthResponse(res, 403, false, "Account blocked");
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return sendAuthResponse(res, 400, false, "Invalid credentials");
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    const safeUser = await User.findById(user._id).select("-password -privateKey");
    await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });

    setAuthCookie(res, token);

    return sendAuthResponse(res, 200, true, "Login successful", {
      user: safeUser,
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err.message);
    return sendAuthResponse(res, 500, false, "Internal server error");
  }
};

export const logout = async (req, res) => {
  const isProd =
    process.env.NODE_ENV === "production" ||
    process.env.RAILWAY_ENVIRONMENT === "production";
  const clearOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };

  res.clearCookie(TOKEN_COOKIE_NAME, clearOptions);

  return sendAuthResponse(res, 200, true, "Logged out successfully");
};
