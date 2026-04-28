import express from "express";
import rateLimit from "express-rate-limit";
import auth from "../../middleware/auth.js";
import { sendWithdrawOtp } from "../../controllers/authController.js";
import { claimWithdraw, getMyHybridWithdrawals, requestWithdraw } from "../controllers/withdrawController.js";

const router = express.Router();

const sendWithdrawOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?._id || req.ip || ""),
  message: {
    success: false,
    msg: "Too many OTP requests, try later",
    data: null,
  },
});

router.post("/send-otp", auth, sendWithdrawOtpLimiter, sendWithdrawOtp);
router.post("/request", auth, requestWithdraw);
router.post("/claim", auth, claimWithdraw);
router.get("/my", auth, getMyHybridWithdrawals);

export default router;
