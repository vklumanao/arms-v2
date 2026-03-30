import { google } from "googleapis";
import { config } from "../../config/index.js";

let gmailClient = null;

function getGmailClient() {
  if (gmailClient) return gmailClient;

  const oauth2Client = new google.auth.OAuth2(
    config.gmailClientId,
    config.gmailClientSecret,
    config.gmailRedirectUri,
  );
  oauth2Client.setCredentials({ refresh_token: config.gmailRefreshToken });

  gmailClient = google.gmail({ version: "v1", auth: oauth2Client });
  return gmailClient;
}

function base64UrlEncode(value) {
  return Buffer.from(String(value || ""))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildRawMessage({ to, subject, html, text }) {
  const from = config.gmailSender;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
  ];

  if (html && text) {
    const boundary = `arms-multipart-${Date.now()}`;
    headers.push(`Content-Type: multipart/alternative; boundary=${boundary}`);
    const body = [
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      text,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "",
      html,
      `--${boundary}--`,
      "",
    ].join("\r\n");
    return base64UrlEncode(`${headers.join("\r\n")}\r\n\r\n${body}`);
  }

  if (html) {
    headers.push('Content-Type: text/html; charset="UTF-8"');
    return base64UrlEncode(`${headers.join("\r\n")}\r\n\r\n${html}`);
  }

  headers.push('Content-Type: text/plain; charset="UTF-8"');
  return base64UrlEncode(`${headers.join("\r\n")}\r\n\r\n${text || ""}`);
}

export async function sendEmail({ to, subject, html, text }) {
  if (!config.gmailSender) {
    throw new Error("GMAIL_SENDER is not configured.");
  }
  const gmail = getGmailClient();
  const raw = buildRawMessage({ to, subject, html, text });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}
