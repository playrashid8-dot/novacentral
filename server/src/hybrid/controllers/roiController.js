import { claimDailyRoi } from "../services/roiService.js";
import { sendError, sendSuccess } from "../utils/response.js";

export const claimRoi = async (req, res) => {
  try {
    const result = await claimDailyRoi(req.user._id);
    return sendSuccess(res, "ROI claimed successfully", result);
  } catch (error) {
    const status = error.message?.includes("24 hours") ? 400 : 400;
    return sendError(res, status, error.message || "Failed to claim ROI");
  }
};
