import { ckanAction } from "./http/ckanAction.js";

/**
 * Adds CKAN member relationship with compatibility and idempotency handling.
 *
 * Important logic:
 * - Retries payload shape when CKAN expects `role` instead of `capacity`.
 * - Treats "already a member" responses as success.
 */
export async function addMember(action, body) {
  try {
    await ckanAction(action, body);
  } catch (error) {
    const msg = String(error?.message || "").toLowerCase();
    // Some CKAN versions use "capacity" while others require "role".
    if (msg.includes("missing value") && msg.includes("role")) {
      const fallbackBody = { ...body };
      if (fallbackBody.capacity && !fallbackBody.role) {
        fallbackBody.role = fallbackBody.capacity;
      }
      delete fallbackBody.capacity;
      await ckanAction(action, fallbackBody);
      return;
    }
    // Membership operations should be idempotent for repeated sync calls.
    if (msg.includes("already") && msg.includes("member")) return;
    throw error;
  }
}

/**
 * Removes CKAN member relationship with tolerant error handling.
 *
 * Important logic:
 * - Ignores "member not found" style errors so role-sync flows remain idempotent.
 */
export async function removeMember(action, body) {
  try {
    await ckanAction(action, body);
  } catch (error) {
    const msg = String(error?.message || "").toLowerCase();
    // Treat missing-membership errors as success to keep role-sync flows resilient.
    const ignorable =
      msg.includes("not a member") ||
      msg.includes("not member") ||
      msg.includes("does not exist") ||
      msg.includes("cannot find");
    if (ignorable) return;
    throw error;
  }
}
