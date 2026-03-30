function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/$/, "");
}

function buildLink(baseUrl, path, token) {
  const base = normalizeBaseUrl(baseUrl);
  const suffix = `${path}?token=${encodeURIComponent(String(token))}`;
  if (!base) return `/${suffix}`;
  return `${base}/${suffix}`;
}

export function buildVerificationLink(baseUrl, token) {
  return buildLink(baseUrl, "verify-email", token);
}

export function buildResetLink(baseUrl, token) {
  return buildLink(baseUrl, "reset-password", token);
}

export function buildVerificationEmailHtml({ fullName, link }) {
  const safeName = String(fullName || "there").trim() || "there";
  return `
      <div style="margin:0;padding:0;background:#f5f7fb;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:94%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
                <tr>
                  <td style="padding:20px 24px;background:linear-gradient(135deg,#0f4c81 0%,#2f7bbd 55%,#36b7a6 100%);color:#ffffff;">
                    <div style="font-family:Arial,sans-serif;font-size:14px;letter-spacing:1px;text-transform:uppercase;opacity:0.9;">ARMS</div>
                    <div style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;margin-top:6px;">Verify your email</div>
                    <div style="font-family:Arial,sans-serif;font-size:13px;opacity:0.9;margin-top:6px;">Activate your account in seconds</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 24px 12px 24px;font-family:Arial,sans-serif;color:#0f172a;">
                    <p style="margin:0 0 12px 0;font-size:16px;">Hi ${safeName},</p>
                    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;">
                      Welcome to ARMS. Please confirm your email to activate your account and start managing your research workflows.
                    </p>
                    <p style="margin:0 0 20px 0;">
                      <a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">
                        Verify Email
                      </a>
                    </p>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#475569;">
                      If the button does not work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:0 0 18px 0;font-size:12px;color:#0f4c81;word-break:break-all;">
                      ${link}
                    </p>
                    <div style="margin-top:8px;padding:12px 14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;font-size:12px;color:#475569;">
                      This verification link will expire soon for your security.
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px 24px 24px;font-family:Arial,sans-serif;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;">
                    If you did not create this account, you can ignore this email.
                  </td>
                </tr>
              </table>
              <div style="font-family:Arial,sans-serif;font-size:11px;color:#94a3b8;margin-top:12px;">
                ARMS Platform
              </div>
            </td>
          </tr>
        </table>
      </div>
    `;
}

export function buildResetPasswordEmailHtml({ fullName, link }) {
  const safeName = String(fullName || "there").trim() || "there";
  return `
      <div style="margin:0;padding:0;background:#f5f7fb;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:94%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
                <tr>
                  <td style="padding:20px 24px;background:linear-gradient(135deg,#0f4c81 0%,#2f7bbd 55%,#36b7a6 100%);color:#ffffff;">
                    <div style="font-family:Arial,sans-serif;font-size:14px;letter-spacing:1px;text-transform:uppercase;opacity:0.9;">ARMS</div>
                    <div style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;margin-top:6px;">Reset your password</div>
                    <div style="font-family:Arial,sans-serif;font-size:13px;opacity:0.9;margin-top:6px;">Secure access to your account</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 24px 12px 24px;font-family:Arial,sans-serif;color:#0f172a;">
                    <p style="margin:0 0 12px 0;font-size:16px;">Hi ${safeName},</p>
                    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;">
                      We received a request to reset your ARMS password. Click below to set a new one.
                    </p>
                    <p style="margin:0 0 20px 0;">
                      <a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">
                        Reset Password
                      </a>
                    </p>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#475569;">
                      If the button does not work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:0 0 18px 0;font-size:12px;color:#0f4c81;word-break:break-all;">
                      ${link}
                    </p>
                    <div style="margin-top:8px;padding:12px 14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;font-size:12px;color:#475569;">
                      If you did not request this, you can ignore this email.
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px 24px 24px;font-family:Arial,sans-serif;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;">
                    This reset link will expire soon for your security.
                  </td>
                </tr>
              </table>
              <div style="font-family:Arial,sans-serif;font-size:11px;color:#94a3b8;margin-top:12px;">
                ARMS Platform
              </div>
            </td>
          </tr>
        </table>
      </div>
    `;
}

export function buildResetPasswordEmailText({ fullName, link }) {
  const safeName = String(fullName || "there").trim() || "there";
  return [
    `Hi ${safeName},`,
    "",
    "We received a request to reset your ARMS password.",
    "Use the link below to set a new one:",
    link,
    "",
    "If you did not request this, you can ignore this email.",
    "This reset link will expire soon for your security.",
  ].join("\n");
}
