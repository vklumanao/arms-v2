import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load environment variables from .env before computing derived config values.
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "../..");

/**
 * Reads a boolean-like environment value.
 *
 * Data transformation:
 * - Only string `"true"` (case-insensitive) is treated as true.
 * - Missing values fall back to provided default.
 */
function readBool(value, fallback = false) {
  if (value == null) return fallback;
  return String(value).toLowerCase() === "true";
}

/**
 * Reads a positive numeric environment value.
 *
 * Edge case:
 * - Non-numeric or non-positive values resolve to fallback.
 */
function readNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Reads a comma-separated env value into a trimmed string array.
 *
 * Edge case:
 * - Empty input returns fallback list.
 */
function readCsv(value, fallback = []) {
  const raw = String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return raw.length > 0 ? raw : fallback;
}

function readString(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

// Central runtime configuration consumed across DB, auth, CKAN integration, and startup.
export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: String(process.env.DATABASE_URL || ""),
  dbSsl: readBool(process.env.DB_SSL, false),
  nodeEnv: String(process.env.NODE_ENV || "development"),
  corsOrigins: readCsv(process.env.CORS_ORIGINS, [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
  ]),
  jwtSecret: String(process.env.ARMS_JWT_SECRET || "change-me"),
  jwtExpiresIn: String(process.env.ARMS_JWT_EXPIRES_IN || "12h"),
  encryptionKeyHex: String(process.env.ARMS_ENCRYPTION_KEY || ""),
  resetTokenTtlMinutes: readNumber(
    process.env.ARMS_RESET_TOKEN_TTL_MINUTES,
    30,
  ),
  resetEmailCooldownSeconds: readNumber(
    process.env.ARMS_RESET_EMAIL_COOLDOWN_SECONDS,
    60,
  ),
  exposeResetTokenInResponse: readBool(
    process.env.ARMS_EXPOSE_RESET_TOKEN_IN_RESPONSE,
    false,
  ),
  dataFile: path.resolve(
    backendRoot,
    String(process.env.ARMS_DATA_FILE || "./data/users.json"),
  ),
  defaultAdminEmail: String(
    process.env.ARMS_DEFAULT_ADMIN_EMAIL || "admin@arms.local",
  ).toLowerCase(),
  defaultAdminName: String(
    process.env.ARMS_BOOTSTRAP_ADMIN_NAME || "ARMS Super Admin",
  ).trim(),
  defaultAdminPassword: String(
    process.env.ARMS_DEFAULT_ADMIN_PASSWORD || "admin123",
  ),
  ckanBaseUrl: String(process.env.CKAN_BASE_URL || "").replace(/\/$/, ""),
  ckanApiKey: String(process.env.CKAN_API_KEY || ""),
  ckanVerifyTls: readBool(process.env.CKAN_VERIFY_TLS, false),
  ckanTokenNamePrefix: String(process.env.CKAN_TOKEN_NAME_PREFIX || "arms"),
  serviceBotEmails: readCsv(process.env.ARMS_SERVICE_BOT_EMAILS, [
    "arms.service@example.com",
  ]).map((value) => value.toLowerCase()),
  serviceBotNames: readCsv(process.env.ARMS_SERVICE_BOT_NAMES, [
    "ARMS Service Bot",
  ]).map((value) => value.toLowerCase()),
  serviceBotIds: readCsv(process.env.ARMS_SERVICE_BOT_IDS, []).map((value) =>
    value.toLowerCase(),
  ),
  researchCenterSyncIntervalMinutes: readNumber(
    process.env.ARMS_RESEARCH_CENTER_SYNC_INTERVAL_MINUTES,
    0,
  ),
  authCookieName: readString(process.env.ARMS_AUTH_COOKIE_NAME, "arms_session"),
  authCookieSecure: readBool(
    process.env.ARMS_AUTH_COOKIE_SECURE,
    String(process.env.NODE_ENV || "development").toLowerCase() ===
      "production",
  ),
  emailVerificationEnabled: readBool(
    process.env.ARMS_EMAIL_VERIFICATION_ENABLED,
    true,
  ),
  emailVerifyTokenTtlMinutes: readNumber(
    process.env.ARMS_EMAIL_VERIFY_TTL_MINUTES,
    60 * 24,
  ),
  publicAppUrl: readString(process.env.ARMS_PUBLIC_APP_URL, ""),
  gmailClientId: readString(process.env.GMAIL_CLIENT_ID, ""),
  gmailClientSecret: readString(process.env.GMAIL_CLIENT_SECRET, ""),
  gmailRefreshToken: readString(process.env.GMAIL_REFRESH_TOKEN, ""),
  gmailSender: readString(process.env.GMAIL_SENDER, ""),
  gmailRedirectUri: readString(
    process.env.GMAIL_REDIRECT_URI,
    "https://developers.google.com/oauthplayground",
  ),
};

/**
 * Validates required runtime configuration and security prerequisites.
 *
 * System flow:
 * - Enforce required external dependencies (DB + CKAN).
 * - Warn on weak default JWT secret.
 * - Enforce 32-byte hex encryption key for secret at-rest encryption.
 */
export function assertConfig() {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }
  if (!config.ckanBaseUrl) {
    throw new Error("CKAN_BASE_URL is required.");
  }
  if (!config.ckanApiKey) {
    throw new Error("CKAN_API_KEY is required.");
  }
  if (config.jwtSecret === "change-me") {
    console.warn("[WARN] ARMS_JWT_SECRET is using the default value.");
  }

  if (String(config.nodeEnv).toLowerCase() === "production") {
    const jwtSecret = String(config.jwtSecret || "").trim();
    if (
      !jwtSecret ||
      /^change-me$/i.test(jwtSecret) ||
      /^change_me$/i.test(jwtSecret)
    ) {
      throw new Error(
        "ARMS_JWT_SECRET must be set to a strong random value in production.",
      );
    }

    const defaultAdminPassword = String(
      config.defaultAdminPassword || "",
    ).trim();
    if (
      !defaultAdminPassword ||
      /^admin123$/i.test(defaultAdminPassword) ||
      /^change-me$/i.test(defaultAdminPassword) ||
      /^change_me$/i.test(defaultAdminPassword)
    ) {
      throw new Error(
        "ARMS_DEFAULT_ADMIN_PASSWORD must be changed in production.",
      );
    }
  }
  if (!/^[a-fA-F0-9]{64}$/.test(config.encryptionKeyHex)) {
    throw new Error(
      "ARMS_ENCRYPTION_KEY must be a 64-char hex string (32-byte key).",
    );
  }

  if (config.emailVerificationEnabled) {
    const missing = [];
    if (!config.publicAppUrl) missing.push("ARMS_PUBLIC_APP_URL");
    if (!config.gmailClientId) missing.push("GMAIL_CLIENT_ID");
    if (!config.gmailClientSecret) missing.push("GMAIL_CLIENT_SECRET");
    if (!config.gmailRefreshToken) missing.push("GMAIL_REFRESH_TOKEN");
    if (!config.gmailSender) missing.push("GMAIL_SENDER");
    if (missing.length > 0) {
      throw new Error(
        `Email verification requires: ${missing.join(", ")}.`,
      );
    }
  }
}
