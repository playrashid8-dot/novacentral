import nodemailer from "nodemailer";
import hybridConfig from "../config/hybridConfig.js";

const SMTP_CONNECTION_MS = 20000;
const SEND_MAIL_RACE_MS = 25000;

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
    connectionTimeout: SMTP_CONNECTION_MS,
    greetingTimeout: SMTP_CONNECTION_MS,
    socketTimeout: SMTP_CONNECTION_MS,
  };

  if (!tlsRejectUnauthorized) {
    transportOptions.tls = {
      rejectUnauthorized: false,
    };
  }

  return nodemailer.createTransport(transportOptions);
};

let hybridVerifiedTransporter = null;
let hybridInitPromise = null;

const sendMailWithTimeout = async (transporter, mailOptions) =>
  Promise.race([
    transporter.sendMail(mailOptions),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Email send timeout")),
        SEND_MAIL_RACE_MS
      )
    ),
  ]);

async function getVerifiedHybridTransporter() {
  if (hybridVerifiedTransporter) return hybridVerifiedTransporter;

  if (!hybridInitPromise) {
    hybridInitPromise = (async () => {
      const t = createTransporter();
      await t.verify();
      console.log("✅ SMTP connected");
      hybridVerifiedTransporter = t;
    })();
  }

  try {
    await hybridInitPromise;
  } catch (e) {
    hybridInitPromise = null;
    throw e;
  }

  return hybridVerifiedTransporter;
}

export const sendOTP = async (email, otp) => {
  try {
    if (!email || !otp) {
      throw new Error("Email and OTP are required");
    }

    const transporter = await getVerifiedHybridTransporter();
    const safeOtp = escapeHtml(otp);

    const displayFrom =
      hybridConfig.emailConfig.from || hybridConfig.emailConfig.user;

    console.log("📧 Sending email...");
    await sendMailWithTimeout(transporter, {
      from: `"HybridEarn" <${displayFrom}>`,
      to: email,
      subject: "Your HybridEarn OTP",
      html: `<p>Your HybridEarn OTP is: <strong>${safeOtp}</strong></p>`,
    });
    console.log("✅ Email sent");

    return { success: true };
  } catch (error) {
    console.error("❌ EMAIL ERROR:", error.message);
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
};

export default sendOTP;
