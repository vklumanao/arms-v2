import crypto from "node:crypto";
import { config } from "./config.js";

const algorithm = "aes-256-gcm";
const key = Buffer.from(config.encryptionKeyHex, "hex");

function b64urlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlDecode(value) {
  let s = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  while (s.length % 4 !== 0) s += "=";
  return Buffer.from(s, "base64");
}

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

export function decryptSecret(payload) {
  const value = String(payload || "").trim();
  if (!value) return null;

  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
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
