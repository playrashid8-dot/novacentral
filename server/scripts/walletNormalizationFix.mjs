/**
 * Audit + one-time fix: normalize all User.walletAddress to trim().toLowerCase()
 * (MongoDB update pipeline; no schema change). Reloads hybrid userMap afterward.
 *
 * Usage: node scripts/walletNormalizationFix.mjs [0xWalletToCheck...]
 */
import dotenv from "dotenv";

dotenv.config();

import mongoose from "mongoose";
import connectDB from "../src/config/db.js";
import User from "../src/models/User.js";
import { loadUsersIntoRealtimeMap } from "../src/hybrid/services/userMap.js";

const TARGET =
  process.argv[2] ||
  "0xfd4c18718ba4c564295c893faf2e34c1c202621d";

const canonical = String(TARGET).trim().toLowerCase();

function printReportHeader() {
  console.log("\n--- WALLET NORMALIZATION FIX ---\n");
}

async function findExact() {
  return User.findOne({ walletAddress: canonical })
    .select("_id username walletAddress")
    .lean();
}

async function findInsensitive() {
  return User.findOne({
    $expr: {
      $eq: [
        {
          $toLower: {
            $trim: { input: { $ifNull: ["$walletAddress", ""] } },
          },
        },
        canonical,
      ],
    },
  })
    .select("_id username walletAddress")
    .lean();
}

await connectDB();

printReportHeader();

let exactDoc = await findExact();
let ciDoc = await findInsensitive();

const exactOk = Boolean(exactDoc);
const ciOk = Boolean(ciDoc);

const caseIssue =
  ciOk &&
  !!ciDoc.walletAddress &&
  String(ciDoc.walletAddress) !== canonical;

console.log(
  "Wallet Found (Exact lowercase):",
  exactOk ? "✅" : "❌",
  exactOk && exactDoc ? `(stored="${exactDoc.walletAddress}")` : ""
);
console.log(
  "Wallet Found (Case-Insensitive):",
  ciOk ? "✅" : "❌",
  ciOk && ciDoc ? `(stored="${ciDoc.walletAddress}")` : ""
);
console.log("Case Issue Detected (CI=yes, stored≠canonical lowercase):", caseIssue ? "Yes" : "No");

const beforeOdd = await User.countDocuments({
  walletAddress: { $type: "string" },
  $expr: {
    $ne: [
      "$walletAddress",
      {
        $toLower: {
          $trim: { input: { $ifNull: ["$walletAddress", ""] } },
        },
      },
    ],
  },
});

console.log("\n📌 Users needing normalization (estimated):", beforeOdd);

const result = await User.updateMany({ walletAddress: { $type: "string" } }, [
    {
      $set: {
        walletAddress: {
          $toLower: {
            $trim: { input: { $ifNull: ["$walletAddress", ""] } },
          },
        },
      },
    },
  ], { updatePipeline: true }).catch(async (err) => {
  console.error("❌ updateMany failed:", err?.message || String(err));
  await mongoose.disconnect();
  process.exit(1);
});

const walletsFixed =
  typeof result.modifiedCount === "number"
    ? result.modifiedCount
    : typeof result.modified?.count === "number"
      ? result.modified.count
      : result.modified ?? 0;

console.log("\n✅ Bulk update matched:", result.matchedCount, "modified:", walletsFixed);

const walletMatchFixed = Boolean(await findExact());

console.log("\n📌 After fix — exact lowercase match:", walletMatchFixed ? "✅" : "❌");

await loadUsersIntoRealtimeMap();

await mongoose.disconnect();
console.log("\n--- DONE (DB disconnected) ---\n");
