import { query } from "./db.js";

export async function logAuditEvent({
  actorUserId = null,
  eventType,
  details = {},
}) {
  await query(
    `
    INSERT INTO audit_logs (id, actor_user_id, event_type, details, created_at)
    VALUES (gen_random_uuid(), $1, $2, $3::jsonb, NOW())
    `,
    [actorUserId, eventType, JSON.stringify(details || {})],
  );
}
