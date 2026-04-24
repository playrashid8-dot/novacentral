import mongoose from "mongoose";

const depositSchema = new mongoose.Schema(
  {
    // 🔗 USER LINK
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 💰 AMOUNT
    amount: {
      type: Number,
      required: true,
      min: 10, // minimum deposit
    },

    // 🔐 TX HASH (IMPORTANT)
    txHash: {
      type: String,
      required: true,
      unique: true, // ❌ duplicate block
      trim: true,
    },

    // 🔥 STATUS FLOW
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // 📡 NETWORK INFO (future use)
    network: {
      type: String,
      default: "BEP20",
    },

    // 🧾 ADMIN NOTE (optional)
    note: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// 🔥 INDEX (FAST SEARCH)
depositSchema.index({ userId: 1 });
depositSchema.index({ txHash: 1 });

export default mongoose.model("Deposit", depositSchema);