import mongoose from "mongoose";

const withdrawalSchema = new mongoose.Schema(
  {
    // 🔗 USER
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 💰 AMOUNT
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    // 📍 WALLET
    walletAddress: {
      type: String,
      required: true,
      trim: true,
    },

    // 🔥 STATUS FLOW
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    // ⏱ 96h DELAY
    releaseAt: {
      type: Date,
      required: true,
      index: true,
    },

    // 🧾 ADMIN NOTE
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    // ⏱ TIMESTAMPS
    approvedAt: Date,
    rejectedAt: Date,
  },
  {
    timestamps: true,
  }
);

//
// 🔥 INDEXES (FAST ADMIN PANEL)
//
withdrawalSchema.index({ userId: 1, status: 1 });
withdrawalSchema.index({ createdAt: -1 });

//
// 🔥 SAFE JSON
//
withdrawalSchema.methods.toJSON = function () {
  const obj = this.toObject();
  return obj;
};

export default mongoose.model("Withdrawal", withdrawalSchema);