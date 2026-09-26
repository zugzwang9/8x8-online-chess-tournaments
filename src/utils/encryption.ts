import crypto from "crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey() {
  const key = env.encryptionKey;
  if (!key || key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)");
  }
  return Buffer.from(key, "hex");
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag().toString("base64");

  return `${iv.toString("base64")}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  try {
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      // Graceful fallback for unencrypted tokens (e.g. legacy local tokens)
      return encryptedData;
    }

    const [ivStr, authTagStr, encryptedStr] = parts;
    const iv = Buffer.from(ivStr, "base64");
    const authTag = Buffer.from(authTagStr, "base64");
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedStr, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    // If decryption fails, it might be an unencrypted legacy token
    return encryptedData;
  }
}
