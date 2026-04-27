import User from "../../models/User.js";
import { REFERRAL_RATES } from "../utils/constants.js";
import { addHybridLedgerEntries } from "./ledgerService.js";
import { updateUserLevel } from "./levelService.js";
import { refreshSalaryStage } from "./salaryService.js";

const getParentId = (user) => user?.referrer || user?.referredBy || null;

export const distributeHybridReferralRewards = async (
  userId,
  depositAmount,
  session = null,
  options = {}
) => {
  const sourceUser = await User.findById(userId)
    .select("referredBy referrer")
    .session(session);

  if (!sourceUser) {
    return [];
  }

  const isFirstQualifiedDeposit = options.isFirstQualifiedDeposit === true;
  const appliedRewards = [];
  const salaryTouchedIds = new Set();
  const levelTouchedIds = new Set();

  let currentParentId = getParentId(sourceUser);
  let depth = 1;

  while (currentParentId && depth <= REFERRAL_RATES.length) {
    const parent = await User.findById(currentParentId)
      .select("_id referredBy referrer")
      .session(session);

    if (!parent) {
      break;
    }

    const rule = REFERRAL_RATES.find((item) => item.depth === depth);

    if (rule) {
      const reward = Number((Number(depositAmount) * rule.rate).toFixed(8));

      if (reward > 0) {
        await User.findByIdAndUpdate(
          parent._id,
          {
            $inc: {
              rewardBalance: reward,
              referralEarnings: reward,
              totalEarnings: reward,
              teamVolume: Number(depositAmount || 0),
            },
          },
          {
            session,
          }
        );

        appliedRewards.push({
          userId: parent._id,
          amount: reward,
          depth,
        });
        levelTouchedIds.add(String(parent._id));
      }
    }

    if (isFirstQualifiedDeposit) {
      const counterUpdate =
        depth === 1
          ? { salaryDirectCount: 1, salaryTeamCount: 1 }
          : { salaryTeamCount: 1 };

      await User.findByIdAndUpdate(
        parent._id,
        {
          $inc: counterUpdate,
        },
        {
          session,
        }
      );

      salaryTouchedIds.add(String(parent._id));
      levelTouchedIds.add(String(parent._id));
    }

    currentParentId = getParentId(parent);
    depth += 1;
  }

  if (appliedRewards.length > 0) {
    await addHybridLedgerEntries(
      appliedRewards.map((item) => ({
        userId: item.userId,
        entryType: "credit",
        balanceType: "rewardBalance",
        amount: item.amount,
        source: "referral_bonus",
        meta: {
          depth: item.depth,
          fromUserId: String(userId),
        },
      })),
      session
    );
  }

  for (const touchedId of salaryTouchedIds) {
    await refreshSalaryStage(touchedId, session);
  }

  for (const touchedId of levelTouchedIds) {
    await updateUserLevel(touchedId, session);
  }

  return appliedRewards;
};
