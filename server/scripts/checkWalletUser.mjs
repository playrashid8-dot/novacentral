/**
 * Verify a User document exists for a wallet using the same normalized match as hybrid (trim + lower).
 * Usage: node scripts/checkWalletUser.mjs [0x...]
 */
import dotenv from "dotenv";

dotenv.config();

import connectDB from "../src/config/db.js";
import User from "../src/models/User.js";

const TARGET =
  process.argv[2] ||
  "0xfd4c18718ba4c564295c893faf2e34c1c202621d";

const norm = String(TARGET).trim().toLowerCase();

await connectDB();

const user = await User.findOne({
  $expr: {
    $eq: [
      {
        $toLower: {
          $trim: { input: { $ifNull: ["$walletAddress", ""] } },
        },
      },
      norm,
    ],
  },
}).select("_id username email walletAddress");

if (user) {
  console.log("✅ User found for wallet", norm, {
    _id: String(user._id),
    username: user.username,
    storedWalletAddress: user.walletAddress,
  });
  process.exit(0);
}

console.log("❌ No user for wallet:", norm);
process.exit(1);
