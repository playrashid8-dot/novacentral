import crypto from "crypto";

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const otpStore = new Map();

const normalizeEmail = (email = "") => String(email).trim().toLowerCase();

const clearExpiredOTP = (email) => {
  const record = otpStore.get(email);

  if (record && record.expiresAt <= Date.now()) {
    otpStore.delete(email);
    return true;
  }

  return false;
};

export const generateOTP = () => String(crypto.randomInt(100000, 1000000));

export const storeOTP = (email, otp) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !otp) {
    throw new Error("Email and OTP are required");
  }

  otpStore.set(normalizedEmail, {
    otp: String(otp),
    expiresAt: Date.now() + OTP_EXPIRY_MS,
  });

  return true;
};

export const verifyOTP = (email, otp) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !otp) {
    return false;
  }

  if (clearExpiredOTP(normalizedEmail)) {
    return false;
  }

  const record = otpStore.get(normalizedEmail);

  if (!record || record.otp !== String(otp)) {
    return false;
  }

  otpStore.delete(normalizedEmail);
  return true;
};
