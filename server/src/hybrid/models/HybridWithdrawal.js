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
      lowercase: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "claimable", "claimed", "approved", "paid", "rejected"],
      default: "pending",
      index: true,
    },
    txHash: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    sourceRewardAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    sourceDepositAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
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
hybridWithdrawalSchema.index({ status: 1, createdAt: -1 });
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
