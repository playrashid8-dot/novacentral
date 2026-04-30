/**
 * One-off / targeted repair: sync User hybrid balances from HybridLedger truth.
 * Default users: apimogrfhinu / apimogrgd1hu (override with --ids=id1,id2).
 *
 * Run: node scripts/fixLedgerMismatch.js
 * Then verify: npm run ledger:reconcile (expect mismatchedUsers: 0 for those users)
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import HybridLedger from "../src/hybrid/models/HybridLedger.js";

dotenv.config();

const DEFAULT_TARGET_IDS = [
  "69eef4cef25c5a625dfaa6b0",
  "69eef4f7986d039a72d3ff5d",
];

const BALANCE_TYPES = ["depositBalance", "rewardBalance", "pendingWithdraw"];

const round8 = (value) => Number(Number(value || 0).toFixed(8));

const getLedgerBalances = async (userId, session = null) => {
  const pipeline = [
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
  ];

  const rows = session
    ? await HybridLedger.aggregate(pipeline).session(session)
    : await HybridLedger.aggregate(pipeline);

  return BALANCE_TYPES.reduce((acc, type) => {
    acc[type] = round8(rows.find((row) => row._id === type)?.balance || 0);
    return acc;
  }, {});
};

const parseIds = () => {
  const fromArg = process.argv.find((arg) => arg.startsWith("--ids="))?.split("=")[1];
  if (fromArg) {
    return fromArg
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return DEFAULT_TARGET_IDS;
};

const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI missing");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  const idStrings = parseIds();
  const objectIds = idStrings.map((id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error(`Invalid ObjectId: ${id}`);
    }
    return new mongoose.Types.ObjectId(id);
  });

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      for (const oid of objectIds) {
        const user = await User.findById(oid).session(session).lean();
        if (!user) {
          console.warn("User not found, skipping:", String(oid));
          continue;
        }

        const ledger = await getLedgerBalances(oid, session);

        console.log("Fixing:", user.username || user.email, {
          before: {
            depositBalance: user.depositBalance,
            rewardBalance: user.rewardBalance,
            pendingWithdraw: user.pendingWithdraw,
          },
          ledger,
        });

        await User.updateOne(
          { _id: oid },
          {
            $set: {
              depositBalance: ledger.depositBalance,
              rewardBalance: ledger.rewardBalance,
              pendingWithdraw: ledger.pendingWithdraw,
            },
          },
          { session }
        );
      }
    });
  } finally {
    session.endSession();
  }

  console.log("Ledger fixed safely");
};

main()
  .catch((error) => {
    console.error("fixLedgerMismatch failed:", error?.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
