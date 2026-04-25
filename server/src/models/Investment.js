import mongoose from "mongoose";

const investmentSchema = new mongoose.Schema(
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
      min: 10,
    },

    // 📊 DAILY ROI (%)
    dailyROI: {
      type: Number,
      required: true,
      min: 0,
    },

    // ⏳ DURATION (days)
    duration: {
      type: Number,
      required: true,
      min: 1,
    },

    // 💰 TOTAL EARNED
    totalEarned: {
      type: Number,
      default: 0,
      min: 0,
    },

    // 📅 START / END
    startDate: {
      type: Date,
      default: Date.now,
    },

    endDate: {
      type: Date,
      required: true,
      index: true,
    },

    // ⏱ LAST ROI CLAIM (IMPORTANT)
    lastClaim: {
      type: Date,
      default: null, // 🔥 FIX (important)
    },

    // 📊 DAYS COUNT (ANTI-BUG)
    daysClaimed: {
      type: Number,
      default: 0,
    },

    // 🔥 STATUS
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

//
// 🔥 INDEXES (PERFORMANCE)
//
investmentSchema.index({ userId: 1, status: 1 });
investmentSchema.index({ endDate: 1 });

//
// 🔥 SAFE JSON
//
investmentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  return obj;
};

export default mongoose.model("Investment", investmentSchema);