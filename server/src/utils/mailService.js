import nodemailer from "nodemailer";

const read = (key, fallback = "") => String(process.env[key] ?? fallback).trim();

const getSmtpSettings = () => {
  const host = read("SMTP_HOST") || read("EMAIL_HOST");
  const portRaw = read("SMTP_PORT") || read("EMAIL_PORT");
  const port = portRaw ? Number(portRaw) : null;
  const user = read("SMTP_USER") || read("EMAIL_USER");
  const pass = read("SMTP_PASS") || read("EMAIL_PASS");
  const from = read("SMTP_FROM") || read("EMAIL_FROM") || user;
  const tlsRejectUnauthorized =
    read("SMTP_TLS_REJECT_UNAUTHORIZED", "true").toLowerCase() !== "false";

  return { host, port, user, pass, from, tlsRejectUnauthorized };
};

export const isMailConfigured = () => {
  const { user, pass } = getSmtpSettings();
  return !!(user && pass);
};

let cachedTransporter = null;

export const createMailTransporter = () => {
  const { host, port, user, pass, tlsRejectUnauthorized } = getSmtpSettings();

  if (!user || !pass) {
    throw new Error("Email service not configured");
  }

  const finalHost = host || "smtp.gmail.com";
  const finalPort =
    port !== null && Number.isInteger(port) && port > 0 ? port : 587;
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

export const getMailTransporter = () => {
  if (!cachedTransporter) {
    cachedTransporter = createMailTransporter();
  }
  return cachedTransporter;
};

/** For tests or after env reload */
export const resetMailTransporterCache = () => {
  cachedTransporter = null;
};

export const verifyMailConnection = async () => {
  const transporter = getMailTransporter();
  await transporter.verify();
  console.log("✅ SMTP connected");
};

export const sendEmail = async (to, subject, text) => {
  if (!isMailConfigured()) {
    throw new Error("Email service not configured");
  }

  const { from } = getSmtpSettings();

  try {
    const transporter = getMailTransporter();
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
    });
  } catch (e) {
    console.error("❌ EMAIL ERROR:", e.message);
    throw e;
  }
};
