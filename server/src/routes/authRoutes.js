import express from "express";
import rateLimit from "express-rate-limit";
import { register, login } from "../controllers/authController.js";

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
    msg: "Too many registrations, try later",
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
    msg: "Too many login attempts, try later",
  },
});

/* ==============================
   🔥 REGISTER
============================== */
router.post("/register", registerLimiter, register);

/* ==============================
   🔐 LOGIN
============================== */
router.post("/login", loginLimiter, login);

/* ==============================
   ❤️ HEALTH CHECK
============================== */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    msg: "Auth API running 🚀",
    time: new Date(),
  });
});

export default router;