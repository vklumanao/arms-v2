import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "../..");

function readBool(value, fallback = false) {
  if (value == null) return fallback;
  return String(value).toLowerCase() === "true";
}

function readNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function readCsv(value, fallback = []) {
  const raw = String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return raw.length > 0 ? raw : fallback;
}

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
  exposeResetTokenInResponse: readBool(
    process.env.ARMS_EXPOSE_RESET_TOKEN_IN_RESPONSE,
    true,
  ),
  dataFile: path.resolve(
    backendRoot,
    String(process.env.ARMS_DATA_FILE || "./data/users.json"),
  ),
  defaultAdminEmail: String(
    process.env.ARMS_DEFAULT_ADMIN_EMAIL || "admin@arms.local",
  ).toLowerCase(),
  defaultAdminPassword: String(
    process.env.ARMS_DEFAULT_ADMIN_PASSWORD || "admin123",
  ),
  ckanBaseUrl: String(process.env.CKAN_BASE_URL || "").replace(/\/$/, ""),
  ckanApiKey: String(process.env.CKAN_API_KEY || ""),
  ckanVerifyTls: readBool(process.env.CKAN_VERIFY_TLS, false),
  ckanTokenNamePrefix: String(process.env.CKAN_TOKEN_NAME_PREFIX || "arms"),
};

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
  if (!/^[a-fA-F0-9]{64}$/.test(config.encryptionKeyHex)) {
    throw new Error(
      "ARMS_ENCRYPTION_KEY must be a 64-char hex string (32-byte key).",
    );
  }
}

