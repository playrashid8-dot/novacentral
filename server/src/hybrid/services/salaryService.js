import mongoose from "mongoose";
import User from "../../models/User.js";
import { SALARY_RULES } from "../utils/constants.js";
import { addHybridLedgerEntries } from "./ledgerService.js";

const getHighestSalaryRule = (user) => {
  let matchedRule = null;

  for (const rule of SALARY_RULES) {
    if (
      Number(user.salaryDirectCount || 0) >= rule.directCount &&
      Number(user.salaryTeamCount || 0) >= rule.teamCount
    ) {
      matchedRule = rule;
    }
  }

  return matchedRule;
};

export const refreshSalaryStage = async (userId, session = null) => {
  const user = await User.findById(userId)
    .select("salaryDirectCount salaryTeamCount salaryStage")
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
          "salaryDirectCount salaryTeamCount salaryStage rewardBalance totalEarnings"
        )
        .session(session);

      if (!user) {
        throw new Error("User not found");
      }

      const rule = getHighestSalaryRule(user);

      if (!rule) {
        throw new Error("Salary stage not reached");
      }

      await User.findByIdAndUpdate(
        userId,
        {
          $inc: {
            rewardBalance: rule.amount,
            totalEarnings: rule.amount,
          },
          $set: {
            salaryDirectCount: 0,
            salaryTeamCount: 0,
            salaryStage: 0,
          },
        },
        {
          new: true,
          session,
        }
      );

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
