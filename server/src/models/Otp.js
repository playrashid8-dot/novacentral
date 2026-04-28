import mongoose from "mongoose";

export const OTP_PURPOSE = {
  SIGNUP: "signup",
  WITHDRAW: "withdraw",
};

const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true, lowercase: true, trim: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    purpose: {
      type: String,
      required: true,
      enum: [OTP_PURPOSE.SIGNUP, OTP_PURPOSE.WITHDRAW],
      index: true,
    },
  },
  { timestamps: true }
);

otpSchema.index({ email: 1, purpose: 1 });

export default mongoose.model("Otp", otpSchema);
