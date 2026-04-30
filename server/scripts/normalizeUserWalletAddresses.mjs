/**
 * One-shot: lowercase all stored User.walletAddress values (Mongo aggregation pipeline).
 *
 * Usage (from server/): node scripts/normalizeUserWalletAddresses.mjs
 *
 * Equivalent intent: UPDATE users SET walletAddress = lower(trim(walletAddress))
 *
 * See also: scripts/walletNormalizationFix.mjs (audit + diagnostics)
 */
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../src/config/db.js";
import User from "../src/models/User.js";

await connectDB();

const filter = { walletAddress: { $type: "string" } };
const pipeline = [
  {
    $set: {
      walletAddress: {
        $toLower: {
          $trim: { input: { $ifNull: ["$walletAddress", ""] } },
        },
      },
    },
  },
];

const beforeOdd = await User.countDocuments({
  ...filter,
  $expr: {
    $ne: ["$walletAddress", { $toLower: { $trim: { input: "$walletAddress" } } }],
  },
});

console.log("[normalizeUserWalletAddresses] rows with non-canonical casing:", beforeOdd);

const r = await User.updateMany(filter, pipeline, {
  updatePipeline: true,
}).catch(async (err) => {
  console.error("updateMany failed:", err?.message || String(err));
  await mongoose.disconnect();
  process.exit(1);
});

console.log(
  "[normalizeUserWalletAddresses] matched:",
  r.matchedCount,
  "modified:",
  typeof r.modifiedCount === "number"
    ? r.modifiedCount
    : r.modified ?? 0
);

await mongoose.disconnect();
console.log("[normalizeUserWalletAddresses] done");
