import { config } from "../../../config/index.js";

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

export async function ckanAction(action, body = {}) {
  const url = `${config.ckanBaseUrl}/api/3/action/${action}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: config.ckanApiKey,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const message = ckanErrorMessage(payload, `CKAN action failed: ${action}`);
    const error = new Error(message);
    error.status = response.status;
    error.action = action;
    error.payload = payload;
    throw error;
  }
  return payload.result;
}
