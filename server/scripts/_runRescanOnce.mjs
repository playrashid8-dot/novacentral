import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const FROM = 95479800;
const TO = 95554000;

const main = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI missing");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 30000 });
  const { rescanDeposits } = await import("../src/hybrid/services/depositListener.js");
  const result = await rescanDeposits(FROM, TO);
  console.log("rescanDeposits finished:", JSON.stringify(result, null, 2));
};

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
