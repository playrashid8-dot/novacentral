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
    forceApply: args.has("--force-apply"),
    legacyApply: args.has("--apply"),
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

const buildMismatches = (user, ledgerBalances) =>
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

const applyUserBalanceCorrection = async (user) => {
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
      const freshMismatches = buildMismatches(lockedUser, ledgerBalances);

      if (freshMismatches.length === 0) {
        return;
      }

      await User.updateOne(
        { _id: user._id },
        {
          $set: BALANCE_TYPES.reduce((acc, balanceType) => {
            acc[balanceType] = ledgerBalances[balanceType];
            return acc;
          }, {}),
        },
        { session }
      );
    });
  } finally {
    session.endSession();
  }
};

const main = async () => {
  const { forceApply, legacyApply, userId } = parseArgs();
  if (legacyApply && !forceApply) {
    console.error("--apply is ignored in strict mode. Use --force-apply for manual correction.");
  }

  await connect();

  const query = userId ? { _id: userId } : {};
  const users = await User.find(query)
    .select(`username email ${BALANCE_TYPES.join(" ")}`)
    .lean();

  const mismatches = [];

  for (const user of users) {
    const ledgerBalances = await getLedgerBalances(user._id);
    const mismatchedBalances = buildMismatches(user, ledgerBalances);

    if (mismatchedBalances.length === 0) {
      continue;
    }

    console.error("Ledger mismatch detected", {
      userId: String(user._id),
      username: user.username,
      mismatchedBalances,
    });

    mismatches.push({
      userId: String(user._id),
      username: user.username,
      mismatchedBalances,
    });

    if (forceApply) {
      await applyUserBalanceCorrection(user);
    }
  }

  console.log(
    JSON.stringify(
      {
        strictMode: !forceApply,
        forceApply,
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
