import express from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  login,
  logout,
  me,
  sendSignupOtp,
  sendOtp,
  sendWithdrawOtp,
} from "../controllers/authController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/* ==============================
   🔐 GENERAL LIMIT (REGISTER)
============================== */
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    msg: "Too many registrations, try later",
    data: null,
  },
});

/* ==============================
   📧 SIGNUP OTP RATE LIMIT
============================== */
const sendSignupOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    msg: "Too many OTP requests, try later",
    data: null,
  },
});

const sendWithdrawOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?._id ? String(req.user._id) : req.ip || ""),
  message: {
    success: false,
    msg: "Too many OTP requests, try later",
    data: null,
  },
});

/* ==============================
   🔐 STRICT LIMIT (LOGIN)
============================== */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    msg: "Too many login attempts, try later",
    data: null,
  },
});

/* ==============================
   📧 SIGNUP OTP (public)
============================== */
router.post("/send-signup-otp", sendSignupOtpLimiter, sendSignupOtp);
router.post("/send-otp", sendSignupOtpLimiter, sendOtp);

/* ==============================
   📧 WITHDRAW OTP (authenticated)
============================== */
router.post("/send-withdraw-otp", auth, sendWithdrawOtpLimiter, sendWithdrawOtp);

/* ==============================
   🔥 REGISTER
============================== */
router.post("/register", registerLimiter, register);

/* ==============================
   🔐 LOGIN
============================== */
router.post("/login", loginLimiter, login);

/* ==============================
   👤 CURRENT USER
============================== */
router.get("/me", auth, me);

/* ==============================
   🚪 LOGOUT
============================== */
router.post("/logout", logout);

/* ==============================
   ❤️ HEALTH CHECK
============================== */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    msg: "Auth API running 🚀",
    data: { time: new Date() },
  });
});

export default router;