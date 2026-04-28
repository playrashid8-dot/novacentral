/**
 * Optional SMTP validation (no UI, no DB).
 * Usage from server/: npm run test:email
 * Requires .env with SMTP_* or EMAIL_* creds.
 * Set SMTP_TEST_TO=your@email.com to send a test message after verify.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import {
  isMailConfigured,
  verifyMailConnection,
  sendEmail,
} from "../utils/mailService.js";

async function main() {
  if (!isMailConfigured()) {
    console.error(
      "Mail not configured: set SMTP_USER+SMTP_PASS (or EMAIL_USER+EMAIL_PASS)"
    );
    process.exit(1);
  }

  await verifyMailConnection();

  const testTo = String(process.env.SMTP_TEST_TO || "").trim();
  if (testTo) {
    await sendEmail(testTo, "Test Email", "Email working ✅");
    console.log("Test email sent to", testTo);
  } else {
    console.log(
      "Verify OK. Set SMTP_TEST_TO=recipient@example.com to send a test message."
    );
  }
}

main().catch((e) => {
  console.error("❌ EMAIL ERROR:", e.message);
  process.exit(1);
});
