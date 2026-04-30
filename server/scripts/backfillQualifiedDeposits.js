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
    serverSelectionTimeoutMS: 5000,
  });
};

const main = async () => {
  await connect();

  const userIds = await HybridDeposit.distinct("userId", {
    status: { $in: ["credited", "swept"] },
  });

  const result = userIds.length
    ? await User.updateMany(
        {
          _id: { $in: userIds },
          hasQualifiedDeposit: { $ne: true },
        },
        {
          $set: { hasQualifiedDeposit: true },
        }
      )
    : { matchedCount: 0, modifiedCount: 0 };

  console.log(
    JSON.stringify(
      {
        qualifiedUsersFound: userIds.length,
        matchedUsers: result.matchedCount || 0,
        modifiedUsers: result.modifiedCount || 0,
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error("Qualified deposit backfill failed:", error?.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
