import mongoose from "mongoose";
import User from "../../models/User.js";
import { SALARY_RULES } from "../utils/constants.js";
import { addHybridLedgerEntries } from "./ledgerService.js";

const MAX_GRAPH_DEPTH = 100;

/** Full fresh downline (all depths under root); optional cutoff by join date after last salary claim */
const countFreshTeam = async (rootId, lastClaimDate, session = null) => {
  const oid = rootId instanceof mongoose.Types.ObjectId ? rootId : new mongoose.Types.ObjectId(rootId);

  const restrictSearchWithMatch =
    lastClaimDate instanceof Date && !Number.isNaN(lastClaimDate.getTime())
      ? { createdAt: { $gt: lastClaimDate } }
      : {};

  const aggOpts = session != null ? { session } : {};
  const rows = await User.aggregate(
    [
      { $match: { _id: oid } },
      {
        $graphLookup: {
          from: User.collection.name,
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "referredBy",
          as: "downline",
          maxDepth: MAX_GRAPH_DEPTH,
          restrictSearchWithMatch,
        },
      },
      {
        $project: {
          n: { $size: "$downline" },
        },
      },
    ],
    aggOpts
  );

  return Number(rows[0]?.n ?? 0);
};

/**
 * Migrates legacy `claimedSalaryStages` into salaryProgress once.
 * Sets lastClaimedAt when inferring stages so onwards only fresh recruits count for the next claim.
 */
export const migrateSalaryProgressFields = async (userId, session = null) => {
  let user = await User.findById(userId)
    .select("salaryProgress claimedSalaryStages rewardBalance totalEarnings salaryStage")
    .session(session ?? undefined);

  if (!user) return null;

  const claimedLegacy = [...(user.claimedSalaryStages ?? [])]
    .map(Number)
    .filter((n) => Number.isFinite(n));
  let lastClaimedStage = Number(user.salaryProgress?.lastClaimedStage ?? 0);
  let lastClaimedAtRaw = user.salaryProgress?.lastClaimedAt ?? null;

  const maxLegacy = claimedLegacy.length ? Math.max(...claimedLegacy, 0) : 0;
  const needsMigrateFromLegacy = lastClaimedStage === 0 && maxLegacy > 0;

  if (needsMigrateFromLegacy) {
    lastClaimedStage = maxLegacy;
    const lastClaimedAt =
      lastClaimedAtRaw != null ? new Date(lastClaimedAtRaw) : new Date();

    await User.updateOne(
      { _id: userId },
      {
        $set: {
          "salaryProgress.lastClaimedStage": lastClaimedStage,
          "salaryProgress.lastClaimedAt": lastClaimedAt,
          salaryStage: lastClaimedStage,
        },
      },
      { session: session ?? undefined }
    );

    user = await User.findById(userId)
      .select("salaryProgress claimedSalaryStages rewardBalance totalEarnings salaryStage")
      .session(session ?? undefined);
  }

  return user;
};

/** Fresh recruits only — resets after last salary claim timestamp */
export const getFreshCounts = async (user, session = null) => {
  const lastClaimRaw = user.salaryProgress?.lastClaimedAt;
  let lastClaim = null;

  if (lastClaimRaw != null) {
    const d =
      lastClaimRaw instanceof Date
        ? lastClaimRaw
        : new Date(lastClaimRaw);

    lastClaim = !Number.isNaN(d.getTime()) ? d : null;
  }

  const filter = lastClaim ? { createdAt: { $gt: lastClaim } } : {};

  let directQ = User.countDocuments({
    referredBy: user._id,
    ...filter,
  });
  if (session != null) {
    directQ = directQ.session(session);
  }
  const direct = await directQ;

  const team = await countFreshTeam(user._id, lastClaim ?? undefined, session);

  return { direct, team };
};

const ruleByStage = (stageNum) =>
  SALARY_RULES.find((r) => Number(r.stage) === Number(stageNum)) ?? null;

/**
 * Builds GET /api/user/salary-progress payload.
 */
export const buildSalaryProgressPayload = async (userId) => {
  const migrated = await migrateSalaryProgressFields(userId);
  if (!migrated) return null;

  const maxStageNum = SALARY_RULES.reduce((m, r) => Math.max(m, r.stage), 0);

  let lastClaimedStage = Number(migrated.salaryProgress?.lastClaimedStage ?? 0);
  lastClaimedStage = Math.min(lastClaimedStage, maxStageNum);

  const { direct, team } = await getFreshCounts(migrated, null);

  const complete = lastClaimedStage >= maxStageNum;

  /** Milestone you're working toward (next claim); when finished, repeats last rule index for convenience */
  const nextStageNum = complete ? maxStageNum : lastClaimedStage + 1;
  const rule = ruleByStage(nextStageNum);

  const eligible =
    !complete &&
    rule &&
    direct >= Number(rule.directCount ?? 0) &&
    team >= Number(rule.teamCount ?? 0);

  return {
    stage: complete ? maxStageNum : nextStageNum,
    direct,
    team,
    claimableStage: eligible ? nextStageNum : 0,
    lastClaimedStage,
    lastClaimedAt: migrated.salaryProgress?.lastClaimedAt ?? null,
    salaryComplete: complete,
    claimedSalaryStages: [...(migrated.claimedSalaryStages ?? [])].map(Number),
    rules: SALARY_RULES,
  };
};

export const claimSalary = async (userId) => {
  const session = await mongoose.startSession();

  try {
    let result = null;

    await session.withTransaction(async () => {
      let user = await migrateSalaryProgressFields(userId, session);
      if (!user) {
        throw new Error("User not found");
      }

      const maxStageNum = SALARY_RULES.reduce((m, r) => Math.max(m, r.stage), 0);
      let prevStage = Number(user.salaryProgress?.lastClaimedStage ?? 0);
      prevStage = Math.min(prevStage, maxStageNum);

      if (prevStage >= maxStageNum) {
        throw new Error("All salary stages claimed");
      }

      const nextStage = prevStage + 1;
      const rule = ruleByStage(nextStage);

      if (!rule || rule.stage !== nextStage) {
        throw new Error("Invalid salary stage");
      }

      const { direct, team } = await getFreshCounts(user, session);

      if (
        direct < Number(rule.directCount) ||
        team < Number(rule.teamCount)
      ) {
        throw new Error("Salary stage not reached");
      }

      const claimFilter =
        prevStage === 0
          ? {
              _id: userId,
              $or: [
                { "salaryProgress.lastClaimedStage": 0 },
                { "salaryProgress.lastClaimedStage": { $exists: false } },
                { salaryProgress: { $exists: false } },
              ],
            }
          : {
              _id: userId,
              "salaryProgress.lastClaimedStage": prevStage,
            };

      const updatedUser = await User.findOneAndUpdate(
        claimFilter,
        {
          $inc: {
            rewardBalance: rule.amount,
            totalEarnings: rule.amount,
          },
          $set: {
            "salaryProgress.lastClaimedStage": nextStage,
            "salaryProgress.lastClaimedAt": new Date(),
            salaryStage: nextStage,
          },
          $addToSet: {
            claimedSalaryStages: nextStage,
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
              stage: nextStage,
              directCountFresh: direct,
              teamCountFresh: team,
            },
          },
        ],
        session
      );

      result = {
        stage: nextStage,
        amount: rule.amount,
      };
    });

    return result;
  } finally {
    session.endSession();
  }
};

/** Salary UI block on hybrid dashboard */
export const getSalaryUiMeta = async (userId) => {
  const payload = await buildSalaryProgressPayload(
    typeof userId === "object" && userId?._id != null ? userId._id : userId
  );

  if (!payload) {
    return {
      claimableStage: 0,
      claimableAmount: 0,
      nextStage: null,
      nextDirectNeed: null,
      nextTeamNeed: null,
      nextReward: null,
      directCount: 0,
      teamCount: 0,
      claimedSalaryStages: [],
    };
  }

  const nextRule = payload.salaryComplete
    ? null
    : SALARY_RULES.find((r) => r.stage === payload.lastClaimedStage + 1) ?? null;

  const claimRule = SALARY_RULES.find((r) => r.stage === payload.claimableStage);

  return {
    claimableStage: payload.claimableStage,
    claimableAmount: claimRule?.amount ?? 0,
    nextStage: nextRule?.stage ?? null,
    nextDirectNeed: nextRule?.directCount ?? null,
    nextTeamNeed: nextRule?.teamCount ?? null,
    nextReward: nextRule?.amount ?? null,
    directCount: payload.direct,
    teamCount: payload.team,
    claimedSalaryStages: payload.claimedSalaryStages ?? [],
  };
};

export const refreshSalaryStage = async (userId, session = null) =>
  migrateSalaryProgressFields(userId, session);
