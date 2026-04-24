import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // 🔐 AUTH
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    // 💰 WALLET
    balance: {
      type: Number,
      default: 0,
    },

    totalInvested: {
      type: Number,
      default: 0,
    },

    totalWithdraw: {
      type: Number,
      default: 0,
    },

    totalEarnings: {
      type: Number,
      default: 0,
    },

    todayProfit: {
      type: Number,
      default: 0,
    },

    // 👥 REFERRAL SYSTEM
    referralCode: {
      type: String,
      unique: true,
    },

    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    directCount: {
      type: Number,
      default: 0,
    },

    teamCount: {
      type: Number,
      default: 0,
    },

    teamVolume: {
      type: Number,
      default: 0,
    },

    // 🏆 VIP / LEVEL SYSTEM
    vipLevel: {
      type: Number,
      default: 0,
    },

    // 📍 WALLET ADDRESS (future blockchain use)
    walletAddress: {
      type: String,
      default: "",
    },

    // 🔐 SECURITY
    isBlocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// 🔥 INDEXES (PERFORMANCE)
userSchema.index({ email: 1 });
userSchema.index({ referralCode: 1 });

export default mongoose.model("User", userSchema);