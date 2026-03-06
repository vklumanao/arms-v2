import crypto from "node:crypto";
import { query } from "./db.js";

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

export async function createPasswordResetToken(userId, ttlMinutes) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  await query(
    `
    INSERT INTO password_reset_tokens (
      id, user_id, token_hash, expires_at, created_at
    ) VALUES (
      gen_random_uuid(),
      $1,
      $2,
      NOW() + ($3::text || ' minutes')::interval,
      NOW()
    )
    `,
    [userId, tokenHash, String(ttlMinutes)],
  );

  return token;
}

export async function consumePasswordResetToken(rawToken) {
  const tokenHash = hashToken(rawToken);

  const result = await query(
    `
    UPDATE password_reset_tokens
    SET used_at = NOW()
    WHERE id = (
      SELECT id
      FROM password_reset_tokens
      WHERE token_hash = $1
        AND used_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    )
    RETURNING *
    `,
    [tokenHash],
  );

  return result.rows?.[0] || null;
}
