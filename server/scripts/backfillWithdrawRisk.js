/**
 * One-time backfill: hybrid withdrawals missing riskScore / priority.
 * Heuristics (aligned with withdrawService deposit + account-age rules; omits live rapid-window count):
 * - grossAmount > depositsBaseline * 2 → +2 (depositsBaseline = max(totalInvested, depositBalance))
 * - depositsBaseline <= 0 && amount > 0 → +2
 * - account age at withdrawal time < 7 days → +1
 * - priority = riskScore >= 4 ? "high" : "normal"
 *
 * Run from repo: `npm run withdraw:backfill-risk` (cwd server) — or `cd server; node scripts/backfillWithdrawRisk.js`
 * Requires `MONGO_URI` in server/.env
 */
import dotenv from "dotenv";

dotenv.config();

import mongoose from "mongoose";
import connectDB from "../src/config/db.js";
import HybridWithdrawal from "../src/hybrid/models/HybridWithdrawal.js";
import User from "../src/models/User.js";

const MS_DAY = 24 * 60 * 60 * 1000;

function computeRiskForBackfill({
  grossAmount,
  depositsBaseline,
  userCreatedAt,
  withdrawalTime,
}) {
  let riskScore = 0;
  const amount = Number(grossAmount || 0);
  const baseline = Number(depositsBaseline || 0);

  if (baseline > 0 && amount > baseline * 2) {
    riskScore += 2;
  } else if (baseline <= 0 && amount > 0) {
    riskScore += 2;
  }

  const created = userCreatedAt ? new Date(userCreatedAt).getTime() : 0;
  const at = withdrawalTime ? new Date(withdrawalTime).getTime() : Date.now();
  const newUser =
    Number.isFinite(created) &&
    created > 0 &&
    Number.isFinite(at) &&
    at - created < 7 * MS_DAY;
  if (newUser) riskScore += 1;

  const priority = riskScore >= 4 ? "high" : "normal";
  return { riskScore, priority };
}

async function main() {
  await connectDB();

  const query = {
    $or: [
      { riskScore: { $exists: false } },
      { riskScore: null },
      { priority: { $exists: false } },
      { priority: null },
      { priority: "" },
    ],
  };

  const totalNeeding = await HybridWithdrawal.countDocuments(query);
  console.log(`Found ${totalNeeding} withdrawals to normalize (missing risk/priority).`);

  const cursor = HybridWithdrawal.find(query).cursor();
  let updated = 0;
  let skipped = 0;

  for await (const w of cursor) {
    const user = await User.findById(w.userId)
      .select("createdAt totalInvested depositBalance")
      .lean();
    if (!user) {
      skipped += 1;
      continue;
    }

    const depositsBaseline = Math.max(
      Number(user.totalInvested || 0),
      Number(user.depositBalance || 0)
    );

    const withdrawalTime = w.requestedAt || w.createdAt || new Date();

    const { riskScore, priority } = computeRiskForBackfill({
      grossAmount: w.grossAmount,
      depositsBaseline,
      userCreatedAt: user.createdAt,
      withdrawalTime,
    });

    await HybridWithdrawal.updateOne(
      { _id: w._id },
      {
        $set: {
          riskScore,
          priority,
        },
      }
    );
    updated += 1;
    if (updated % 500 === 0) {
      console.log(`… updated ${updated}`);
    }
  }

  console.log(`Done. Updated: ${updated}, skipped (no user): ${skipped}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
