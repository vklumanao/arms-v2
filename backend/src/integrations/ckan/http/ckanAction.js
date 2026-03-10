import { config } from "../../../config/index.js";
import { ckanRequest } from "./ckanRequest.js";

/**
 * Builds a readable error message from CKAN error payload structure.
 *
 * Important logic:
 * - Handles multiple CKAN error shapes (`string`, `__type`, object trees).
 * - Falls back to caller-provided default when payload is missing/unknown.
 */
function ckanErrorMessage(payload, fallback) {
  const err = payload?.error;
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (Array.isArray(err?.__type)) return err.__type.join(" | ");
  if (err?.message) return String(err.message);
  if (typeof err === "object") {
    const entries = Object.entries(err)
      .map(([key, value]) => {
        if (Array.isArray(value)) return `${key}: ${value.join(", ")}`;
        if (value && typeof value === "object") {
          return `${key}: ${JSON.stringify(value)}`;
        }
        return `${key}: ${String(value)}`;
      })
      .filter(Boolean);
    if (entries.length > 0) return entries.join(" | ");
  }
  return fallback;
}

function parseJsonSafely(text) {
  try {
    return JSON.parse(text || "null");
  } catch {
    return null;
  }
}

/**
 * Executes a CKAN action endpoint request.
 *
 * System flow:
 * - Compose action URL from configured CKAN base URL.
 * - Send authenticated JSON POST request.
 * - Parse CKAN payload and validate `success` contract.
 * - Throw enriched Error on transport or CKAN-level failures.
 *
 * Dependencies:
 * - Uses `config.ckanApiKey` for Authorization header.
 */
export async function ckanAction(action, body = {}) {
  const response = await ckanRequest(`/api/3/action/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: config.ckanApiKey,
    },
    body: JSON.stringify(body),
  });

  const payload = parseJsonSafely(response.bodyText);
  if (response.status < 200 || response.status >= 300 || !payload?.success) {
    const message = ckanErrorMessage(payload, `CKAN action failed: ${action}`);
    const error = new Error(message);
    error.status = response.status;
    error.action = action;
    error.payload = payload;
    throw error;
  }
  return payload.result;
}

/**
 * Executes a CKAN action endpoint request with multipart/form-data.
 *
 * Used for APIs such as `resource_create` when uploading binary files.
 */
export async function ckanMultipartAction(action, formData) {
  const response = await ckanRequest(`/api/3/action/${action}`, {
    method: "POST",
    headers: {
      Authorization: config.ckanApiKey,
    },
    body: formData,
  });

  const payload = parseJsonSafely(response.bodyText);
  if (response.status < 200 || response.status >= 300 || !payload?.success) {
    const message = ckanErrorMessage(payload, `CKAN action failed: ${action}`);
    const error = new Error(message);
    error.status = response.status;
    error.action = action;
    error.payload = payload;
    throw error;
  }
  return payload.result;
}
