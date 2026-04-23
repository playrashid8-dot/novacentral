import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  referralCode: String,
  referredBy: String,
  balance: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

export default mongoose.model("User", userSchema);