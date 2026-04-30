import mongoose from "mongoose";

const hybridLedgerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    entryType: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    balanceType: {
      type: String,
      enum: ["balance", "depositBalance", "rewardBalance", "pendingWithdraw"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.000001,
    },
    source: {
      type: String,
      required: true,
      trim: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

hybridLedgerSchema.index({ userId: 1, createdAt: -1 });
hybridLedgerSchema.index(
  { source: 1, "meta.depositTxHash": 1 },
  { sparse: true }
);
hybridLedgerSchema.index(
  { source: 1, "meta.fromUserId": 1 },
  { sparse: true }
);

const HybridLedger =
  mongoose.models.HybridLedger ||
  mongoose.model("HybridLedger", hybridLedgerSchema);

export default HybridLedger;
