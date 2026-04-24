import mongoose from "mongoose";

const depositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  amount: Number,
  txHash: String,

  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },

}, { timestamps: true });

export default mongoose.model("Deposit", depositSchema);