import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

// Derive a secure 32-byte key from the environment secret
function getKey() {
  const secret = import.meta.env.SECRET_KEY || 'default_local_dev_secret_key_123';
  return crypto.scryptSync(secret, 'salt', 32);
}

export function encryptData(data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptData(encryptedData) {
  try {
    const [ivHex, authTagHex, encryptedText] = encryptedData.split(":");
    if (!ivHex || !authTagHex || !encryptedText) return null;

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted);
  } catch (error) {
    console.error("Decryption failed:", error.message);
    return null;
  }
}
