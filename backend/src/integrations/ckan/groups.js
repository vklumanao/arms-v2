import { ckanAction } from "./http/ckanAction.js";
import { addMember, removeMember } from "./memberships.js";

/**
 * Lists CKAN groups with full fields and extras.
 */
export async function listGroups() {
  return ckanAction("group_list", {
    all_fields: true,
    include_extras: true,
  });
}

/**
 * Lists users who are members of a CKAN group.
 *
 * Edge case:
 * - Returns empty array when group id is missing.
 */
export async function listGroupMembers(groupId) {
  const id = String(groupId || "").trim();
  if (!id) return [];
  const result = await ckanAction("group_show", {
    id,
    include_users: true,
    include_groups: false,
    include_tags: false,
    include_extras: false,
    include_followers: false,
    include_datasets: false,
  });
  return Array.isArray(result?.users) ? result.users : [];
}

/**
 * Grants CKAN group `editor` role to a user.
 */
export async function assignUserToGroupEditor({ groupId, username }) {
  await addMember("group_member_create", {
    id: groupId,
    username,
    role: "editor",
  });
}

/**
 * Removes a user from a CKAN group.
 *
 * Idempotency:
 * - Missing membership is treated as success by `removeMember`.
 */
export async function removeUserFromGroup({ groupId, username }) {
  await removeMember("group_member_delete", {
    id: groupId,
    username,
  });
}
