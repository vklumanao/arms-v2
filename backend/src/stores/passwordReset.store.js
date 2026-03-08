import crypto from "node:crypto";
import { query } from "../db/client.js";

/**
 * Hashes a raw reset token using SHA-256.
 *
 * Security model:
 * - Raw reset tokens are never stored directly in DB.
 * - Verification compares hashes so DB compromise does not immediately reveal
 *   active reset tokens.
 */
function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

/**
 * Creates and persists a password reset token for a user.
 *
 * System flow:
 * - Generate cryptographically random token.
 * - Hash token before persistence.
 * - Insert token row with expiration derived from `ttlMinutes`.
 *
 * Database dependency:
 * - Writes to `password_reset_tokens` table via `query`.
 *
 * Return value:
 * - Returns the raw token for delivery to the caller (email/API response).
 */
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

/**
 * Consumes a password reset token exactly once.
 *
 * System flow:
 * - Hash incoming token.
 * - Atomically mark latest valid matching token as used.
 * - Return consumed row for downstream user lookup.
 *
 * Edge cases:
 * - Expired tokens and already-used tokens are ignored.
 * - If no token is consumed, returns `null`.
 */
export async function consumePasswordResetToken(rawToken) {
  const tokenHash = hashToken(rawToken);

  const result = await query(
    `
    -- Atomic update guarantees one-time use even under concurrent requests.
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
