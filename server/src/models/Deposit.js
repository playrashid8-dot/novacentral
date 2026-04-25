import mongoose from "mongoose";

const depositSchema = new mongoose.Schema(
  {
    // 🔗 USER LINK
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

    // 🔐 TX HASH (ANTI-DUPLICATE CORE)
    txHash: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    // 🔥 STATUS FLOW
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    // 📡 NETWORK
    network: {
      type: String,
      default: "BEP20",
      trim: true,
    },

    // 🧾 ADMIN NOTE
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    // ⏱ TIMINGS
    approvedAt: Date,
    rejectedAt: Date,
  },
  {
    timestamps: true,
  }
);

//
// 🔥 COMPOUND INDEX (ADMIN SPEED BOOST)
//
depositSchema.index({ userId: 1, status: 1 });
depositSchema.index({ createdAt: -1 });

//
// 🔥 SAFE JSON RESPONSE
//
depositSchema.methods.toJSON = function () {
  const obj = this.toObject();

  // future sensitive fields hide yahan kar sakte ho
  return obj;
};

//
// 🔥 PRE-SAVE CLEAN (IMPORTANT)
//
depositSchema.pre("save", function (next) {
  if (this.txHash) {
    this.txHash = this.txHash.toLowerCase().trim();
  }
  next();
});

export default mongoose.model("Deposit", depositSchema);