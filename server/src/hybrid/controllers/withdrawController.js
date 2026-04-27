import {
  claimHybridWithdrawal,
  getHybridWithdrawals,
  requestHybridWithdrawal,
} from "../services/withdrawService.js";
import { sendError, sendSuccess } from "../utils/response.js";

const getIdempotencyKey = (req) => req.get("Idempotency-Key")?.trim() || null;

export const requestWithdraw = async (req, res) => {
  try {
    const { amount, walletAddress } = req.body;
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
    return sendSuccess(res, "Withdrawal claimed successfully", result);
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
