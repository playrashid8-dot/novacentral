import mongoose from "mongoose";
import User from "../../models/User.js";
import { SALARY_RULES } from "../utils/constants.js";
import { addHybridLedgerEntries } from "./ledgerService.js";

/** Max ObjectIds per recursive tier query ($in batches) — keeps queries bounded. */
const FRONTIER_IN_CHUNK = 5000;

/**
 * Recursive fresh-downline count matching former $graphLookup + restrictSearchWithMatch
 * semantics, without loading the entire subtree into Mongoose BSON memory (<graphLookup>.
 * Only nodes matching freshness participate; wave BFS from root excludes root from tally.
 */
const countFreshTeam = async (rootId, lastClaimDate, session = null) => {
  const oid =
    rootId instanceof mongoose.Types.ObjectId
      ? rootId
      : new mongoose.Types.ObjectId(rootId);

  const freshness =
    lastClaimDate instanceof Date && !Number.isNaN(lastClaimDate.getTime())
      ? { createdAt: { $gt: lastClaimDate } }
      : {};

  let frontier = [oid];
  let total = 0;

  /** Hard cap avoids pathological depths locking the event loop. */
  const MAX_WAVES = 4096;

  for (let wave = 0; wave < MAX_WAVES && frontier.length > 0; wave += 1) {
    const next = [];

    for (let i = 0; i < frontier.length; i += FRONTIER_IN_CHUNK) {
      const chunk = frontier.slice(i, i + FRONTIER_IN_CHUNK);
      const finder = User.find({
        referredBy: { $in: chunk },
        ...freshness,
      })
        .select("_id")
        .lean();

      if (session) finder.session(session);
      const rows = await finder.exec();

      total += rows.length;
      for (const r of rows) {
        next.push(r._id);
      }
    }

    frontier = next;
  }

  return total;
};

/**
 * Migrates legacy `claimedSalaryStages` into salaryProgress once.
 * Sets lastClaimedAt when inferring stages so onwards only fresh recruits count for the next claim.
 */
export const migrateSalaryProgressFields = async (userId, session = null) => {
  let user = await User.findById(userId)
    .select("salaryProgress claimedSalaryStages rewardBalance totalEarnings salaryStage salaryHistory")
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
      .select("salaryProgress claimedSalaryStages rewardBalance totalEarnings salaryStage salaryHistory")
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

/** Mongo filter for anchored lastClaimedAt (prevents claim races / mismatched freshness window). */
const anchorLastClaimedAtCondition = (raw) => {
  if (
    raw != null &&
    (raw instanceof Date || typeof raw === "string" || typeof raw === "number")
  ) {
    const asDate =
      raw instanceof Date ? raw : new Date(raw);
    if (!Number.isNaN(asDate.getTime())) {
      return { "salaryProgress.lastClaimedAt": asDate };
    }
  }
  return {
    $or: [
      { "salaryProgress.lastClaimedAt": { $exists: false } },
      { "salaryProgress.lastClaimedAt": null },
    ],
  };
};

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

  const historyRaw = Array.isArray(migrated.salaryHistory) ? migrated.salaryHistory : [];

  const salaryHistory = [...historyRaw]
    .slice(-100)
    .map((h) => ({
      stage: Number(h.stage),
      amount: Number(h.amount ?? 0),
      claimedAt: h.claimedAt != null ? h.claimedAt : null,
    }))
    .sort((a, b) => {
      const ta = new Date(a.claimedAt || 0).getTime();
      const tb = new Date(b.claimedAt || 0).getTime();
      return tb - ta;
    });

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
    salaryHistory,
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

      const anchorCond = anchorLastClaimedAtCondition(user.salaryProgress?.lastClaimedAt);

      const { direct, team } = await getFreshCounts(user, session);

      if (
        direct < Number(rule.directCount) ||
        team < Number(rule.teamCount)
      ) {
        throw new Error("Salary stage not reached");
      }

      /** Single atomic instant for persisted claim boundary (fixes split-ms exploit). */
      const now = new Date();

      const stageCond =
        prevStage === 0
          ? {
              $or: [
                { "salaryProgress.lastClaimedStage": 0 },
                { "salaryProgress.lastClaimedStage": { $exists: false } },
                { salaryProgress: { $exists: false } },
              ],
            }
          : { "salaryProgress.lastClaimedStage": prevStage };

      const claimFilter = {
        _id: userId,
        $and: [stageCond, anchorCond],
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
            "salaryProgress.lastClaimedAt": now,
            salaryStage: nextStage,
          },
          $addToSet: {
            claimedSalaryStages: nextStage,
          },
          $push: {
            salaryHistory: {
              stage: nextStage,
              amount: rule.amount,
              claimedAt: now,
            },
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
