import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const TOKEN_COOKIE_NAME = "token";

const getCookieOptions = () => ({
  httpOnly: true,
  secure: false,
  sameSite: "lax",
});

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

    // ✅ CHECK DUPLICATE
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return sendAuthResponse(res, 400, false, "User already exists");
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

    return sendAuthResponse(res, 200, true, "Account created successfully", {
      user: safeUser,
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err.message);
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
    const safeUser = await User.findById(user._id).select("-password");
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
  const clearOptions = {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  };

  res.clearCookie(TOKEN_COOKIE_NAME, clearOptions);

  return sendAuthResponse(res, 200, true, "Logged out successfully");
};