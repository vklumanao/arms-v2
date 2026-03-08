import crypto from "node:crypto";
import { config } from "../config/index.js";

const algorithm = "aes-256-gcm";
const key = Buffer.from(config.encryptionKeyHex, "hex");

/**
 * Encodes binary data into base64url (URL-safe base64 without padding).
 *
 * This helper is used so encrypted payload segments can be stored/transmitted
 * safely without introducing `/`, `+`, or trailing `=` characters.
 */
function b64urlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Decodes a base64url-encoded string back into a Buffer.
 *
 * Data transformation:
 * - Converts URL-safe alphabet back to standard base64.
 * - Restores missing `=` padding required by Node's base64 decoder.
 */
function b64urlDecode(value) {
  let s = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  while (s.length % 4 !== 0) s += "=";
  return Buffer.from(s, "base64");
}

/**
 * Encrypts sensitive text values using AES-256-GCM.
 *
 * System flow:
 * - Normalize input to string.
 * - Generate random IV for semantic security.
 * - Encrypt and collect authentication tag.
 * - Return versioned compact payload (`v1.iv.tag.ciphertext`).
 *
 * Edge case:
 * - Empty input returns `null` so optional secrets can remain nullable in DB.
 */
export function encryptSecret(plainText) {
  const text = String(plainText || "");
  if (!text) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `v1.${b64urlEncode(iv)}.${b64urlEncode(tag)}.${b64urlEncode(encrypted)}`;
}

/**
 * Decrypts payloads produced by `encryptSecret`.
 *
 * System flow:
 * - Parse and validate versioned payload shape.
 * - Decode IV/tag/ciphertext segments.
 * - Decrypt with AES-256-GCM and verify auth tag integrity.
 *
 * Edge case:
 * - Non-versioned values are returned as-is to preserve compatibility with
 *   legacy plaintext records stored before encryption was introduced.
 *
 * Dependency:
 * - Must use the same `algorithm` and `key` as `encryptSecret`.
 */
export function decryptSecret(payload) {
  const value = String(payload || "").trim();
  if (!value) return null;

  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    // Preserve legacy plaintext tokens instead of breaking old records at read time.
    return value;
  }

  const iv = b64urlDecode(parts[1]);
  const tag = b64urlDecode(parts[2]);
  const encrypted = b64urlDecode(parts[3]);

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString("utf8");
}
