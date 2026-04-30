import User from "../../models/User.js";
import HybridDeposit from "../models/HybridDeposit.js";
import HybridLedger from "../models/HybridLedger.js";
import { REFERRAL_RATES } from "../utils/constants.js";
import { addHybridLedgerEntries } from "./ledgerService.js";
import { updateUserLevel } from "./levelService.js";

const getParentId = (user) => user?.referrer || user?.referredBy || null;

export const distributeHybridReferralRewards = async (
  userId,
  depositAmount,
  session = null,
  options = {}
) => {
  const { depositTxHash } = options || {};
  const sourceUser = await User.findById(userId)
    .select("referredBy referrer")
    .session(session);

  if (!sourceUser) {
    return [];
  }

  const qualifiedDepositCount = await HybridDeposit.countDocuments({
    userId,
    status: "credited",
  }).session(session);

  if (qualifiedDepositCount !== 1) {
    return [];
  }

  if (depositTxHash) {
    const existingReward = await HybridLedger.findOne({
      source: "referral_bonus",
      "meta.depositTxHash": depositTxHash,
    }).session(session);
    if (existingReward) {
      return [];
    }
  }

  const appliedRewards = [];
  const levelTouchedIds = new Set();
  const visited = new Set();

  let currentParentId = getParentId(sourceUser);
  let depth = 1;

  while (
    currentParentId &&
    depth <= REFERRAL_RATES.length &&
    !visited.has(String(currentParentId))
  ) {
    visited.add(String(currentParentId));
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
          depositTxHash,
        },
      })),
      session
    );
  }

  for (const touchedId of levelTouchedIds) {
    await updateUserLevel(touchedId, session);
  }

  return appliedRewards;
};
