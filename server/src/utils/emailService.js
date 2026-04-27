import nodemailer from "nodemailer";
import hybridConfig from "../config/hybridConfig.js";

const assertEmailConfig = () => {
  const { host, port, user, pass } = hybridConfig.emailConfig;

  if (!host || !port || !user || !pass) {
    throw new Error("SMTP email configuration is incomplete");
  }
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const createTransporter = () => {
  assertEmailConfig();

  const { host, port, user, pass, secure } = hybridConfig.emailConfig;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
};

export const sendOTP = async (email, otp) => {
  try {
    if (!email || !otp) {
      throw new Error("Email and OTP are required");
    }

    const transporter = createTransporter();
    const safeOtp = escapeHtml(otp);

    await transporter.sendMail({
      from: `"HybridEarn" <${hybridConfig.emailConfig.user}>`,
      to: email,
      subject: "Your HybridEarn OTP",
      html: `<p>Your HybridEarn OTP is: <strong>${safeOtp}</strong></p>`,
    });

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
};

export default sendOTP;
