import mongoose from "mongoose";
import User from "../../models/User.js";
import { SALARY_RULES } from "../utils/constants.js";
import { addHybridLedgerEntries } from "./ledgerService.js";

const getHighestSalaryRule = (user) => {
  let matchedRule = null;
  const claimedStages = new Set((user.claimedSalaryStages || []).map(Number));
  const direct = Number(user.directCount || 0);
  const team = Number(user.teamCount || 0);

  for (const rule of SALARY_RULES) {
    if (direct >= rule.directCount && team >= rule.teamCount && !claimedStages.has(rule.stage)) {
      matchedRule = rule;
    }
  }

  return matchedRule;
};

/** Next unclaimed milestone (for progress UI), sorted by stage. */
export const getNextSalaryRuleForUser = (user) => {
  const claimed = new Set((user.claimedSalaryStages || []).map(Number));
  const sorted = [...SALARY_RULES].sort((a, b) => a.stage - b.stage);
  return sorted.find((r) => !claimed.has(r.stage)) || null;
};

export const getSalaryUiMeta = (user) => {
  const claimable = getHighestSalaryRule(user);
  const nextRule = getNextSalaryRuleForUser(user);
  const d = Number(user.directCount || 0);
  const t = Number(user.teamCount || 0);
  return {
    claimableStage: claimable?.stage ?? 0,
    claimableAmount: claimable?.amount ?? 0,
    nextStage: nextRule?.stage ?? null,
    nextDirectNeed: nextRule?.directCount ?? null,
    nextTeamNeed: nextRule?.teamCount ?? null,
    nextReward: nextRule?.amount ?? null,
    directCount: d,
    teamCount: t,
    claimedSalaryStages: [...(user.claimedSalaryStages || [])],
  };
};

export const refreshSalaryStage = async (userId, session = null) => {
  const user = await User.findById(userId)
    .select("salaryDirectCount salaryTeamCount salaryStage claimedSalaryStages directCount teamCount")
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
          "directCount teamCount claimedSalaryStages rewardBalance totalEarnings salaryStage"
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
          directCount: { $gte: rule.directCount },
          teamCount: { $gte: rule.teamCount },
          claimedSalaryStages: { $ne: rule.stage },
        },
        {
          $inc: {
            rewardBalance: rule.amount,
            totalEarnings: rule.amount,
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
              directCount: Number(user.directCount || 0),
              teamCount: Number(user.teamCount || 0),
            },
          },
        ],
        session
      );

      await refreshSalaryStage(userId, session);

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
