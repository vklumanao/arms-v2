import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import dotenv from "dotenv";

function readEnv(name, fallback = "") {
  const value = process.env[name];
  return value == null || String(value).trim() === ""
    ? fallback
    : String(value);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        try {
          resolve({
            status: res.statusCode || 0,
            json: body ? JSON.parse(body) : null,
            raw: body,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
  });
}

async function waitForHealth({ baseUrl, timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const result = await httpGetJson(`${baseUrl}/api/health`);
      if (
        result.status === 200 &&
        result.json &&
        result.json.ok === true &&
        result.json.service === "arms-backend"
      ) {
        return;
      }
      lastError = new Error(
        `Unexpected health response: ${result.status} ${result.raw}`,
      );
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw lastError || new Error("Health check timed out.");
}

const backendRoot = fileURLToPath(new URL("../", import.meta.url));
const dotenvPath = fileURLToPath(new URL("../.env", import.meta.url));
if (readEnv("SMOKE_SKIP_DOTENV", "false").toLowerCase() !== "true") {
  if (fs.existsSync(dotenvPath)) {
    dotenv.config({ path: dotenvPath });
  }
}

const port = Number(readEnv("PORT", "4000"));
const baseUrl = readEnv("SMOKE_BASE_URL", `http://127.0.0.1:${port}`);
const timeoutMs = Number(readEnv("SMOKE_TIMEOUT_MS", "30000"));

const databaseUrl = readEnv("DATABASE_URL");
if (!databaseUrl) {
  console.error("[smoke] DATABASE_URL is required.");
  process.exit(2);
}

const serverEnv = {
  ...process.env,
  NODE_ENV: readEnv("NODE_ENV", "test"),
  PORT: String(port),
  DATABASE_URL: databaseUrl,
  DB_SSL: readEnv("DB_SSL", "false"),
  CORS_ORIGINS: readEnv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
  ),
  ARMS_JWT_SECRET: readEnv(
    "ARMS_JWT_SECRET",
    "ci-smoke-not-a-secret-change-me",
  ),
  ARMS_ENCRYPTION_KEY: readEnv(
    "ARMS_ENCRYPTION_KEY",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  ),
  ARMS_EXPOSE_RESET_TOKEN_IN_RESPONSE: readEnv(
    "ARMS_EXPOSE_RESET_TOKEN_IN_RESPONSE",
    "false",
  ),
  CKAN_BASE_URL: readEnv("CKAN_BASE_URL", "https://example.invalid"),
  CKAN_API_KEY: readEnv("CKAN_API_KEY", "ci-smoke"),
  CKAN_VERIFY_TLS: readEnv("CKAN_VERIFY_TLS", "false"),
};

console.log(`[smoke] Starting backend on ${baseUrl}...`);
const child = spawn("node", ["src/server.js"], {
  cwd: backendRoot,
  env: serverEnv,
  stdio: "inherit",
});

let exited = false;
child.on("exit", (code, signal) => {
  exited = true;
  if (code != null && code !== 0) {
    console.error(`[smoke] Backend exited early with code ${code}.`);
  } else if (signal) {
    console.error(`[smoke] Backend exited early with signal ${signal}.`);
  }
});

try {
  await waitForHealth({ baseUrl, timeoutMs });
  console.log("[smoke] /api/health OK");
} finally {
  if (!exited) {
    child.kill();
  }
}
