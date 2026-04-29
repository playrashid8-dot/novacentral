import {
  claimSalary,
  buildSalaryProgressPayload,
} from "../services/salaryService.js";
import { sendError, sendSuccess } from "../utils/response.js";

export const claimSalaryReward = async (req, res) => {
  try {
    const result = await claimSalary(req.user._id);
    const stage = Number(result?.stage ?? 0);
    return sendSuccess(res, stage ? `Stage ${stage} claimed` : "Salary claimed successfully", result);
  } catch (error) {
    return sendError(res, 400, error.message || "Failed to claim salary");
  }
};

export const getSalaryProgress = async (req, res) => {
  try {
    const data = await buildSalaryProgressPayload(req.user._id);
    if (!data) {
      return sendError(res, 404, "User not found");
    }

    return sendSuccess(res, "Salary progress", {
      stage: data.stage,
      direct: data.direct,
      team: data.team,
      claimableStage: data.claimableStage,
      lastClaimedStage: data.lastClaimedStage,
      lastClaimedAt: data.lastClaimedAt,
      salaryComplete: data.salaryComplete,
      claimedSalaryStages: data.claimedSalaryStages,
      rules: data.rules,
    });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to load salary progress");
  }
};
