import mongoose from "mongoose";
import User from "../../models/User.js";
import HybridStake from "../models/HybridStake.js";
import { ROI_RATES } from "../utils/constants.js";
import { ONE_DAY_MS } from "../utils/time.js";
import { addHybridLedgerEntries } from "./ledgerService.js";

export const getCurrentRoiRate = (level) => ROI_RATES[Number(level || 0)] || 0;

/** Eligible principal: on-hand deposit + funds locked in active staking plans (excludes rewardBalance to avoid compounding abuse). */
export const getRoiPrincipalBase = async (userId, session = null) => {
  const q = HybridStake.find({ userId, status: "active" }).select("amount");
  if (session) {
    q.session(session);
  }
  const stakes = await q.lean();
  const staked = stakes.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const depositQuery = User.findById(userId).select("depositBalance");
  if (session) {
    depositQuery.session(session);
  }
  const user = await depositQuery.lean();
  const deposit = Number(user?.depositBalance || 0);
  return Number((deposit + staked).toFixed(8));
};

export const claimDailyRoi = async (userId) => {
  const session = await mongoose.startSession();

  try {
    let result = null;

    await session.withTransaction(async () => {
      const user = await User.findById(userId)
        .select(
          "depositBalance rewardBalance pendingWithdraw lastDailyClaim level totalEarnings todayProfit"
        )
        .session(session);

      if (!user) {
        throw new Error("User not found");
      }

      const now = new Date();
      const lastClaimAt = user.lastDailyClaim
        ? new Date(user.lastDailyClaim).getTime()
        : null;

      if (lastClaimAt && now.getTime() - lastClaimAt < ONE_DAY_MS) {
        throw new Error("ROI claim available every 24 hours");
      }

      const roiRate = getCurrentRoiRate(user.level);

      if (roiRate <= 0) {
        throw new Error("Reach Hybrid level 1 to claim ROI");
      }

      const totalBase = await getRoiPrincipalBase(userId, session);

      if (totalBase <= 0) {
        throw new Error("No eligible balance for ROI claim (keep a deposit or active stake)");
      }

      const reward = Number((totalBase * roiRate).toFixed(8));
      const claimCutoffMs = Date.now() - 86400000;

      const updatedUser = await User.findOneAndUpdate(
        {
          _id: userId,
          $or: [
            { lastDailyClaim: null },
            { lastDailyClaim: { $lte: new Date(claimCutoffMs) } },
            { lastDailyClaim: { $exists: false } },
          ],
        },
        {
          $inc: {
            rewardBalance: reward,
            totalEarnings: reward,
            todayProfit: reward,
          },
          $set: {
            lastDailyClaim: now,
          },
        },
        {
          new: true,
          session,
        }
      );

      if (!updatedUser) {
        throw new Error("ROI claim available every 24 hours");
      }

      await addHybridLedgerEntries(
        [
          {
            userId,
            entryType: "credit",
            balanceType: "rewardBalance",
            amount: reward,
            source: "roi_claim",
            meta: {
              level: user.level,
              roiRate,
              totalBase,
            },
          },
        ],
        session
      );

      result = {
        amount: reward,
        roiRate,
        totalBase,
      };
    });

    return result;
  } finally {
    session.endSession();
  }
};
