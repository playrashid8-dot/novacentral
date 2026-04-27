import User from "../../models/User.js";
import { getUserHybridDeposits } from "../services/depositService.js";
import { getUserStakes } from "../services/stakingService.js";
import { getCurrentRoiRate } from "../services/roiService.js";
import { refreshSalaryStage } from "../services/salaryService.js";
import { sendError, sendSuccess } from "../utils/response.js";

export const getHybridDepositDashboard = async (req, res) => {
  try {
    const refreshedUser = await refreshSalaryStage(req.user._id);

    const [user, deposits, stakes] = await Promise.all([
      User.findById(req.user._id).select(
        "walletAddress depositBalance rewardBalance level pendingWithdraw salaryStage salaryDirectCount salaryTeamCount lastDailyClaim directCount teamCount"
      ),
      getUserHybridDeposits(req.user._id),
      getUserStakes(req.user._id),
    ]);

    if (!user) {
      return sendError(res, 404, "User not found");
    }

    const activeStakeAmount = stakes
      .filter((stake) => stake.status === "active")
      .reduce((sum, stake) => sum + Number(stake.amount || 0), 0);

    return sendSuccess(res, "Hybrid deposit data fetched successfully", {
      walletAddress: user.walletAddress || "",
      depositBalance: Number(user.depositBalance || 0),
      rewardBalance: Number(user.rewardBalance || 0),
      pendingWithdraw: Number(user.pendingWithdraw || 0),
      level: Number(user.level || 0),
      roiRate: getCurrentRoiRate(user.level),
      salaryStage: Number(refreshedUser?.salaryStage ?? user.salaryStage ?? 0),
      salaryDirectCount: Number(user.salaryDirectCount || 0),
      salaryTeamCount: Number(user.salaryTeamCount || 0),
      directCount: Number(user.directCount || 0),
      teamCount: Number(user.teamCount || 0),
      activeStakeAmount,
      lastDailyClaim: user.lastDailyClaim,
      deposits,
      stakes,
    });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to fetch Hybrid data");
  }
};

export const getMyHybridDeposits = async (req, res) => {
  try {
    const deposits = await getUserHybridDeposits(req.user._id);
    return sendSuccess(res, "Hybrid deposits fetched successfully", { deposits });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to fetch deposits");
  }
};
