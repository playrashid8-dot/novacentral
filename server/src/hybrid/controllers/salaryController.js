import { claimSalary } from "../services/salaryService.js";
import { sendError, sendSuccess } from "../utils/response.js";

export const claimSalaryReward = async (req, res) => {
  try {
    const result = await claimSalary(req.user._id);
    return sendSuccess(res, "Salary claimed successfully", result);
  } catch (error) {
    return sendError(res, 400, error.message || "Failed to claim salary");
  }
};
