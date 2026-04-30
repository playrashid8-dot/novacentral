/**
 * Apply critical production indexes (idempotent). Does not run full syncIndexes()
 * (which can fail if legacy data violates other unique indexes, e.g. duplicate username).
 *
 * Run from server/: npm run db:ensure-indexes
 * Verify in mongosh: db.users.getIndexes(); db.hybridwithdrawals.getIndexes();
 */
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

/** Must match HybridWithdrawal schema (unique only when txHash is a BSON string). */
const TXHASH_PARTIAL_FILTER = { txHash: { $type: "string" } };

const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI missing");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  const db = mongoose.connection.db;

  // Required before unique partial index on walletAddress (empty string counts as string and collides).
  const emptyWalletCleanup = await db.collection("users").updateMany(
    { walletAddress: "" },
    { $unset: { walletAddress: "" } }
  );
  if (emptyWalletCleanup.modifiedCount > 0) {
    console.log(
      JSON.stringify({ step: "emptyWalletAddressCleanup", ...emptyWalletCleanup }, null, 2)
    );
  }

  const usersIdx = await db.collection("users").createIndex(
    { walletAddress: 1 },
    {
      unique: true,
      partialFilterExpression: { walletAddress: { $type: "string" } },
    }
  );

  const withdrawalsColl = db.collection("hybridwithdrawals");

  // Null / "" txHash values are all "equal" under a naive unique index — unset so the field is absent.
  const pendingTxCleanup = await withdrawalsColl.updateMany(
    { $or: [{ txHash: null }, { txHash: "" }] },
    { $unset: { txHash: "" } }
  );
  if (pendingTxCleanup.modifiedCount > 0) {
    console.log(
      JSON.stringify({ step: "unsetNullOrEmptyTxHash", ...pendingTxCleanup }, null, 2)
    );
  }

  const withdrawalIndexes = await withdrawalsColl.indexes();
  const txHashIdx = withdrawalIndexes.find((idx) => idx.name === "txHash_1");
  const partialOk =
    txHashIdx?.partialFilterExpression &&
    JSON.stringify(txHashIdx.partialFilterExpression) ===
      JSON.stringify(TXHASH_PARTIAL_FILTER);
  const txHashIdxOk = txHashIdx?.unique && partialOk;
  if (txHashIdx && !txHashIdxOk) {
    await withdrawalsColl.dropIndex("txHash_1");
  }

  const withdrawIdx = await withdrawalsColl.createIndex(
    { txHash: 1 },
    {
      unique: true,
      partialFilterExpression: TXHASH_PARTIAL_FILTER,
    }
  );

  console.log(
    JSON.stringify(
      {
        users_walletAddress_index: usersIdx,
        hybridwithdrawals_txHash_index: withdrawIdx,
      },
      null,
      2
    )
  );
  console.log("Critical production indexes ensured");
};

main()
  .catch((error) => {
    console.error("ensureProductionIndexes failed:", error?.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
