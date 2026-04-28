import bcrypt from "bcryptjs";
import User from "../../models/User.js";
import { OTP_PURPOSE } from "../../models/Otp.js";
import { verifyOtp } from "../../controllers/authController.js";
import {
  claimHybridWithdrawal,
  getHybridWithdrawals,
  requestHybridWithdrawal,
} from "../services/withdrawService.js";
import { sendError, sendSuccess } from "../utils/response.js";

const getIdempotencyKey = (req) => req.get("Idempotency-Key")?.trim() || null;

export const requestWithdraw = async (req, res) => {
  try {
    const { amount, walletAddress, password, otp } = req.body;

    if (!password || String(password).length < 8) {
      return sendError(res, 400, "Password required (minimum 8 characters)", null);
    }

    const otpStr = otp != null ? String(otp).trim() : "";
    if (!/^[0-9]{6}$/.test(otpStr)) {
      return sendError(res, 400, "Valid 6-digit OTP required", null);
    }

    const user = await User.findById(req.user._id).select("+password email isBlocked");

    if (!user) {
      return sendError(res, 404, "User not found", null);
    }

    if (user.isBlocked) {
      return sendError(res, 403, "Account blocked", null);
    }

    const email = String(user.email || "").toLowerCase().trim();
    if (!email) {
      return sendError(res, 400, "User email not found", null);
    }

    const isPasswordValid = await bcrypt.compare(String(password || ""), user.password);

    if (!isPasswordValid) {
      return sendError(res, 400, "Invalid password");
    }

    const isValidOtp = await verifyOtp(email, otpStr, OTP_PURPOSE.WITHDRAW);

    if (!isValidOtp) {
      return sendError(res, 400, "Invalid or expired OTP");
    }

    const result = await requestHybridWithdrawal(
      req.user._id,
      amount,
      walletAddress,
      getIdempotencyKey(req)
    );

    return sendSuccess(res, "Withdrawal requested successfully", result);
  } catch (error) {
    return sendError(res, 400, error.message || "Failed to request withdrawal");
  }
};

export const claimWithdraw = async (req, res) => {
  try {
    const { withdrawalId } = req.body;

    if (!withdrawalId) {
      return sendError(res, 400, "Withdrawal ID is required");
    }

    const result = await claimHybridWithdrawal(req.user._id, withdrawalId);
    return sendSuccess(res, "Withdrawal is claimable; awaiting admin approval and payout", result);
  } catch (error) {
    return sendError(res, 400, error.message || "Failed to claim withdrawal");
  }
};

export const getMyHybridWithdrawals = async (req, res) => {
  try {
    const withdrawals = await getHybridWithdrawals(req.user._id);
    return sendSuccess(res, "Hybrid withdrawals fetched successfully", {
      withdrawals,
    });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to fetch withdrawals");
  }
};
