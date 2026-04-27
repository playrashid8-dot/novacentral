import mongoose from "mongoose";
import User from "../../models/User.js";
import { SALARY_RULES } from "../utils/constants.js";
import { addHybridLedgerEntries } from "./ledgerService.js";

const getHighestSalaryRule = (user) => {
  let matchedRule = null;
  const claimedStages = new Set((user.claimedSalaryStages || []).map(Number));

  for (const rule of SALARY_RULES) {
    if (
      Number(user.salaryDirectCount || 0) >= rule.directCount &&
      Number(user.salaryTeamCount || 0) >= rule.teamCount &&
      !claimedStages.has(rule.stage)
    ) {
      matchedRule = rule;
    }
  }

  return matchedRule;
};

export const refreshSalaryStage = async (userId, session = null) => {
  const user = await User.findById(userId)
    .select("salaryDirectCount salaryTeamCount salaryStage claimedSalaryStages")
    .session(session);

  if (!user) {
    return null;
  }

  const rule = getHighestSalaryRule(user);
  const nextStage = rule?.stage || 0;

  return User.findByIdAndUpdate(
    userId,
    {
      $set: {
        salaryStage: nextStage,
      },
    },
    {
      new: true,
      session,
    }
  );
};

export const claimSalary = async (userId) => {
  const session = await mongoose.startSession();

  try {
    let result = null;

    await session.withTransaction(async () => {
      const user = await User.findById(userId)
        .select(
          "salaryDirectCount salaryTeamCount salaryStage claimedSalaryStages rewardBalance totalEarnings"
        )
        .session(session);

      if (!user) {
        throw new Error("User not found");
      }

      const rule = getHighestSalaryRule(user);

      if (!rule) {
        throw new Error("Salary stage not reached");
      }

      const updatedUser = await User.findOneAndUpdate(
        {
          _id: userId,
          salaryDirectCount: { $gte: rule.directCount },
          salaryTeamCount: { $gte: rule.teamCount },
          claimedSalaryStages: { $ne: rule.stage },
        },
        {
          $inc: {
            rewardBalance: rule.amount,
            totalEarnings: rule.amount,
          },
          $set: {
            salaryStage: 0,
            salaryDirectCount: 0,
            salaryTeamCount: 0,
          },
          $addToSet: {
            claimedSalaryStages: rule.stage,
          },
        },
        {
          new: true,
          session,
        }
      );

      if (!updatedUser) {
        throw new Error("Salary already claimed");
      }

      await addHybridLedgerEntries(
        [
          {
            userId,
            entryType: "credit",
            balanceType: "rewardBalance",
            amount: rule.amount,
            source: "salary_claim",
            meta: {
              stage: rule.stage,
            },
          },
        ],
        session
      );

      result = {
        stage: rule.stage,
        amount: rule.amount,
      };
    });

    return result;
  } finally {
    session.endSession();
  }
};
