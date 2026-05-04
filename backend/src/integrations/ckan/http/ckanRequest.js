import http from "node:http";
import https from "node:https";
import { config } from "../../../config/index.js";

function requestBodyToBuffer(body) {
  if (body == null) return Promise.resolve(null);
  if (Buffer.isBuffer(body)) return Promise.resolve(body);
  if (typeof body === "string") return Promise.resolve(Buffer.from(body));
  return Promise.resolve(Buffer.from(String(body)));
}

async function normalizeRequestBody(url, method, headers, body) {
  if (body == null || Buffer.isBuffer(body) || typeof body === "string") {
    const payload = await requestBodyToBuffer(body);
    const nextHeaders = { ...(headers || {}) };
    if (payload) {
      nextHeaders["Content-Length"] = String(payload.length);
    }
    return {
      headers: nextHeaders,
      body: payload,
    };
  }

  const request = new Request(url, {
    method,
    headers,
    body,
  });

  const payload = Buffer.from(await request.arrayBuffer());
  const nextHeaders = Object.fromEntries(request.headers.entries());
  if (payload.length > 0) {
    nextHeaders["content-length"] = String(payload.length);
  }

  return {
    headers: nextHeaders,
    body: payload,
  };
}

export async function ckanRequest(
  pathname,
  { method = "POST", headers = {}, body = null } = {},
) {
  const url = new URL(pathname, `${config.ckanBaseUrl}/`);
  const transport = url.protocol === "https:" ? https : http;
  const normalized = await normalizeRequestBody(url, method, headers, body);

  const requestOptions = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || (url.protocol === "https:" ? 443 : 80),
    path: `${url.pathname}${url.search}`,
    method,
    // Disable socket pooling so sequential CKAN calls do not reuse a socket
    // that the upstream uWSGI/nginx side has already closed.
    agent: false,
    headers: {
      Accept: "application/json",
      Connection: "close",
      ...(normalized.headers || {}),
    },
  };

  if (url.protocol === "https:") {
    requestOptions.rejectUnauthorized = config.ckanVerifyTls;
  }

  return new Promise((resolve, reject) => {
    const req = transport.request(requestOptions, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers || {},
          bodyText: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });

    req.on("error", reject);

    if (normalized.body?.length) {
      req.write(normalized.body);
    }
    req.end();
  });
}
