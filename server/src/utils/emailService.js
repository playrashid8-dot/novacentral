import nodemailer from "nodemailer";
import hybridConfig from "../config/hybridConfig.js";

const assertEmailConfig = () => {
  const { user, pass } = hybridConfig.emailConfig;

  if (!user || !pass) {
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

  const { host, port, user, pass, tlsRejectUnauthorized } =
    hybridConfig.emailConfig;

  const finalHost = host || "smtp.gmail.com";
  const finalPort = port && port > 0 ? port : 587;
  const secure = finalPort === 465;

  const transportOptions = {
    host: finalHost,
    port: finalPort,
    secure,
    auth: {
      user,
      pass,
    },
  };

  if (!tlsRejectUnauthorized) {
    transportOptions.tls = {
      rejectUnauthorized: false,
    };
  }

  return nodemailer.createTransport(transportOptions);
};

export const sendOTP = async (email, otp) => {
  try {
    if (!email || !otp) {
      throw new Error("Email and OTP are required");
    }

    const transporter = createTransporter();
    const safeOtp = escapeHtml(otp);

    const displayFrom =
      hybridConfig.emailConfig.from || hybridConfig.emailConfig.user;

    await transporter.sendMail({
      from: `"HybridEarn" <${displayFrom}>`,
      to: email,
      subject: "Your HybridEarn OTP",
      html: `<p>Your HybridEarn OTP is: <strong>${safeOtp}</strong></p>`,
    });

    return { success: true };
  } catch (error) {
    console.error("❌ EMAIL ERROR:", error.message);
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
};

export default sendOTP;
