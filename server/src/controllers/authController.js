import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


// 🔐 REGISTER
export const register = async (req, res) => {
  try {
    const { username, email, password, referralCode } = req.body;

    // check existing user
    const exist = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (exist) {
      return res.status(400).json({ message: "User already exists" });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // generate referral code
    const myReferral = username + Math.floor(1000 + Math.random() * 9000);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      referralCode: myReferral,
      referredBy: referralCode || null,
      balance: 0
    });

    res.json({
      message: "Register working ✅",
      data: user
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// 🔑 LOGIN (USERNAME BASED)
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Wrong password" });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login success ✅",
      token
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// 👤 GET LOGGED USER
export const getMe = async (req, res) => {
  try {
    const token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({ message: "No token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    res.json(user);

  } catch (err) {
    res.status(500).json({ message: "Auth error" });
  }
};