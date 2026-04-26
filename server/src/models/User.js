import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // 🔐 AUTH
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 20,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email"],
    },

    password: {
      type: String,
      required: true,
      select: false,
    },
    number: {
      type: String,
      default: "",
      trim: true,
    },

    // 💰 WALLET
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalInvested: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalWithdraw: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },

    todayProfit: {
      type: Number,
      default: 0,
      min: 0,
    },

    // 💎 VIP SYSTEM
    vipLevel: {
      type: Number,
      default: 0,
      min: 0,
    },

    vipEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },

    claimedVIP: {
      type: [Number],
      default: [],
    },

    // 👥 REFERRAL SYSTEM
    referralCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },

    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    directCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    referralEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },

    teamCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    teamVolume: {
      type: Number,
      default: 0,
      min: 0,
    },

    // 📍 WALLET ADDRESS
    walletAddress: {
      type: String,
      default: "",
      trim: true,
    },

    // 🔐 SECURITY
    isBlocked: {
      type: Boolean,
      default: false,
    },

    lastLogin: {
      type: Date,
      default: null,
    },
    lastWithdrawalAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

//
// 🔥 SAFE RESPONSE
//
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

//
// 🔥 INDEXES (NO DUPLICATE)
//
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ referralCode: 1 });
userSchema.index({ createdAt: -1 });

export default mongoose.model("User", userSchema);