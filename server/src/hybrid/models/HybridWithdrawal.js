import mongoose from "mongoose";

const hybridWithdrawalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    grossAmount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    feeAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    walletAddress: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "claimable", "claimed", "rejected"],
      default: "pending",
      index: true,
    },
    availableAt: {
      type: Date,
      required: true,
      index: true,
    },
    requestedAt: {
      type: Date,
      required: true,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    monthKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      default: null,
      trim: true,
    },
    idempotencyResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

hybridWithdrawalSchema.index({ userId: 1, createdAt: -1 });
hybridWithdrawalSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  }
);

const HybridWithdrawal =
  mongoose.models.HybridWithdrawal ||
  mongoose.model("HybridWithdrawal", hybridWithdrawalSchema);

export default HybridWithdrawal;
