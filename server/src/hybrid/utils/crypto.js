import crypto from "crypto";

const getSecret = () =>
  process.env.HYBRID_PRIVATE_KEY_ENCRYPTION_SECRET ||
  process.env.JWT_SECRET;

const getKey = () =>
  crypto.createHash("sha256").update(String(getSecret() || "")).digest();

const assertSecretConfigured = () => {
  if (!getSecret()) {
    throw new Error("Hybrid private key encryption secret missing");
  }
};

export const encryptText = (value = "") => {
  assertSecretConfigured();

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
};

export const decryptText = (payload = "") => {
  if (!payload) return "";
  assertSecretConfigured();

  const [ivHex, authTagHex, encryptedHex] = String(payload).split(":");

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted payload");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};
