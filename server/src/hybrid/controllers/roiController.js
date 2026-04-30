import User from "../../models/User.js";
import { claimDailyRoi } from "../services/roiService.js";
import { sendError, sendSuccess } from "../utils/response.js";
import { ONE_DAY_MS } from "../utils/time.js";

export const claimRoi = async (req, res) => {
  try {
    const result = await claimDailyRoi(req.user._id);
    const nextAt = new Date(Date.now() + ONE_DAY_MS);
    return sendSuccess(res, "ROI claimed successfully", {
      ...result,
      nextClaimAvailableAt: nextAt.toISOString(),
    });
  } catch (error) {
    return sendError(res, 400, error.message || "Failed to claim ROI", null);
  }
};

/** Optional: read-only hint for dashboards (claim still enforces server-side). */
export const getRoiClaimStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("lastDailyClaim depositBalance level")
      .lean();
    if (!user) {
      return sendError(res, 404, "User not found", null);
    }
    const last = user.lastDailyClaim ? new Date(user.lastDailyClaim).getTime() : null;
    const now = Date.now();
    const lastClaimPassed = !last || now - last >= ONE_DAY_MS;
    const hasDeposit = Number(user.depositBalance || 0) > 0;
    const isVipEligible = Number(user.level || 0) >= 1;
    const canClaim = hasDeposit && isVipEligible && lastClaimPassed;
    const nextClaimAvailableAt =
      !canClaim && last ? new Date(last + ONE_DAY_MS).toISOString() : null;
    return sendSuccess(res, "ROI claim status", { canClaim, nextClaimAvailableAt });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to read ROI status", null);
  }
};
