import { query } from "../db/client.js";

/**
 * Persists an audit event for security/admin traceability.
 *
 * System flow:
 * - Accept caller-provided actor id, event type, and details payload.
 * - Insert a single immutable row into `audit_logs`.
 *
 * Data transformation:
 * - `details` is serialized to JSON and cast to `jsonb` for flexible querying.
 *
 * Edge cases:
 * - `actorUserId` may be `null` for system-triggered or anonymous events.
 *
 * Dependencies:
 * - Uses `query` from `db/client.js` for database writes.
 */
export async function logAuditEvent({
  actorUserId = null,
  eventType,
  details = {},
}) {
  // Keep audit payload schema flexible while still storing structured JSON.
  await query(
    `
    INSERT INTO audit_logs (id, actor_user_id, event_type, details, created_at)
    VALUES (gen_random_uuid(), $1, $2, $3::jsonb, NOW())
    `,
    [actorUserId, eventType, JSON.stringify(details || {})],
  );
}
