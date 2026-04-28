import nodemailer from "nodemailer";

export const isMailConfigured = () =>
  Boolean(
    process.env.EMAIL_USER &&
      String(process.env.EMAIL_USER).trim() &&
      process.env.EMAIL_PASS &&
      String(process.env.EMAIL_PASS).trim()
  );

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async (to, subject, text) => {
  if (!isMailConfigured()) {
    throw new Error("Email service is not configured");
  }

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  });
};
