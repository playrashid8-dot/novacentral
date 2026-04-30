import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import HybridLedger from "../src/hybrid/models/HybridLedger.js";

dotenv.config();

const BALANCE_TYPES = ["depositBalance", "rewardBalance", "pendingWithdraw"];
const EPSILON = 0.000001;

const round8 = (value) => Number(Number(value || 0).toFixed(8));

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));
  return {
    apply: args.has("--apply"),
    userId: process.argv.find((arg) => arg.startsWith("--userId="))?.split("=")[1] || null,
  };
};

const connect = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI missing");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });
};

const getLedgerBalances = async (userId, session = null) => {
  const rows = await HybridLedger.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(String(userId)) } },
    {
      $group: {
        _id: "$balanceType",
        balance: {
          $sum: {
            $cond: [
              { $eq: ["$entryType", "credit"] },
              "$amount",
              { $multiply: ["$amount", -1] },
            ],
          },
        },
      },
    },
  ]).session(session);

  return BALANCE_TYPES.reduce((acc, type) => {
    acc[type] = round8(rows.find((row) => row._id === type)?.balance || 0);
    return acc;
  }, {});
};

const buildAdjustments = (user, ledgerBalances) =>
  BALANCE_TYPES.map((balanceType) => {
    const userBalance = round8(user[balanceType]);
    const ledgerBalance = round8(ledgerBalances[balanceType]);
    const diff = round8(userBalance - ledgerBalance);

    return {
      balanceType,
      userBalance,
      ledgerBalance,
      diff,
    };
  }).filter((item) => Math.abs(item.diff) > EPSILON);

const applyLedgerAdjustments = async (user, adjustments) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const lockedUser = await User.findById(user._id)
        .select(BALANCE_TYPES.join(" "))
        .session(session)
        .lean();

      if (!lockedUser) {
        throw new Error(`User not found during reconciliation: ${user._id}`);
      }

      const ledgerBalances = await getLedgerBalances(user._id, session);
      const freshAdjustments = buildAdjustments(lockedUser, ledgerBalances);

      if (freshAdjustments.length === 0) {
        return;
      }

      await HybridLedger.insertMany(
        freshAdjustments.map((item) => ({
          userId: user._id,
          entryType: item.diff > 0 ? "credit" : "debit",
          balanceType: item.balanceType,
          amount: Math.abs(item.diff),
          source: "ledger_reconciliation",
          meta: {
            previousLedgerBalance: item.ledgerBalance,
            observedUserBalance: item.userBalance,
            reason: "Align ledger with existing user balance after audit mismatch",
          },
        })),
        { ordered: true, session }
      );
    });
  } finally {
    session.endSession();
  }
};

const main = async () => {
  const { apply, userId } = parseArgs();
  await connect();

  const query = userId ? { _id: userId } : {};
  const users = await User.find(query)
    .select(`username email ${BALANCE_TYPES.join(" ")}`)
    .lean();

  const mismatches = [];

  for (const user of users) {
    const ledgerBalances = await getLedgerBalances(user._id);
    const adjustments = buildAdjustments(user, ledgerBalances);

    if (adjustments.length === 0) {
      continue;
    }

    mismatches.push({
      userId: String(user._id),
      username: user.username,
      adjustments,
    });

    if (apply) {
      await applyLedgerAdjustments(user, adjustments);
    }
  }

  console.log(
    JSON.stringify(
      {
        apply,
        checkedUsers: users.length,
        mismatchedUsers: mismatches.length,
        mismatches,
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error("Ledger reconciliation failed:", error?.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
