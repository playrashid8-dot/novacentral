/**
 * Set hasQualifiedDeposit for users who already had a qualifying deposit so they
 * cannot trigger first-deposit referral rewards again on a later deposit.
 *
 * Sources:
 * - HybridDeposit records (credited / swept) — primary source of truth
 * - Legacy-shaped users: depositBalance > 0 or optional totalDeposits / deposits[]
 *   (fields may be absent on current schema; query is harmless)
 *
 * Run: node scripts/backfillReferral.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import HybridDeposit from "../src/hybrid/models/HybridDeposit.js";

dotenv.config();

const connect = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI missing");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
};

const main = async () => {
  await connect();

  const userIdsFromDeposits = await HybridDeposit.distinct("userId", {
    status: { $in: ["credited", "swept"] },
  });

  const fromHybridDeposits = userIdsFromDeposits.length
    ? await User.updateMany(
        {
          _id: { $in: userIdsFromDeposits },
          hasQualifiedDeposit: { $ne: true },
        },
        { $set: { hasQualifiedDeposit: true } }
      )
    : { matchedCount: 0, modifiedCount: 0 };

  const fromLegacyShape = await User.updateMany(
    {
      hasQualifiedDeposit: { $ne: true },
      $or: [
        { depositBalance: { $gt: 0 } },
        { totalDeposits: { $gt: 0 } },
        { "deposits.0": { $exists: true } },
      ],
    },
    { $set: { hasQualifiedDeposit: true } }
  );

  console.log(
    JSON.stringify(
      {
        qualifiedDepositUserIds: userIdsFromDeposits.length,
        hybridDepositBackfill: {
          matched: fromHybridDeposits.matchedCount ?? 0,
          modified: fromHybridDeposits.modifiedCount ?? 0,
        },
        legacyOrBackfill: {
          matched: fromLegacyShape.matchedCount ?? 0,
          modified: fromLegacyShape.modifiedCount ?? 0,
        },
      },
      null,
      2
    )
  );

  console.log("Referral backfill done");
};

main()
  .catch((error) => {
    console.error("backfillReferral failed:", error?.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
