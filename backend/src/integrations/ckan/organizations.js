import { ckanAction } from "./http/ckanAction.js";
import { addMember, removeMember } from "./memberships.js";

/**
 * Lists CKAN organizations with full fields and extras.
 *
 * Used as a reference-data source across registration and admin modules.
 */
export async function listOrganizations() {
  return ckanAction("organization_list", {
    all_fields: true,
    include_extras: true,
  });
}

/**
 * Loads a single organization by id/name.
 *
 * Edge case:
 * - Returns `null` when input id is empty.
 */
export async function getOrganization(orgId) {
  const id = String(orgId || "").trim();
  if (!id) return null;
  return ckanAction("organization_show", {
    id,
    include_extras: true,
    include_users: false,
    include_groups: false,
    include_tags: false,
    include_followers: false,
    include_datasets: false,
  });
}

/**
 * Lists members of a CKAN organization.
 *
 * Data source:
 * - Uses `organization_show` with `include_users: true`.
 */
export async function listOrganizationMembers(orgId) {
  const id = String(orgId || "").trim();
  if (!id) return [];
  const result = await ckanAction("organization_show", {
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
 * Extracts research agenda entries from organization extras.
 *
 * Important logic:
 * - Accepts multiple legacy agenda key variants.
 * - Supports arrays, JSON-encoded values, and delimiter-separated strings.
 * - Deduplicates values case-insensitively and returns `{ id, name }` rows.
 */
export async function listOrganizationAgendas(orgId) {
  const id = String(orgId || "").trim();
  if (!id) return [];
  const result = await ckanAction("organization_show", {
    id,
    include_extras: true,
    include_users: false,
    include_groups: false,
    include_tags: false,
    include_followers: false,
    include_datasets: false,
  });

  const extras = Array.isArray(result?.extras) ? result.extras : [];
  const agendaValues = [];
  // CKAN instances store agendas under inconsistent extra keys; accept common variants.
  const allowedAgendaKeys = new Set([
    "research_agenda",
    "research_agendas",
    "agenda",
    "agendas",
  ]);

  for (const item of extras) {
    const rawKey = String(item?.key || "").trim();
    if (!rawKey) continue;
    const normalizedKey = rawKey
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!allowedAgendaKeys.has(normalizedKey)) continue;

    const rawValue = item?.value;
    if (Array.isArray(rawValue)) {
      agendaValues.push(...rawValue);
      continue;
    }

    const asString = String(rawValue || "").trim();
    if (!asString) continue;

    // Some CKAN extras store JSON as plain strings.
    const looksLikeJsonArray =
      (asString.startsWith("[") && asString.endsWith("]")) ||
      (asString.startsWith("{") && asString.endsWith("}"));
    if (looksLikeJsonArray) {
      try {
        const parsed = JSON.parse(asString);
        if (Array.isArray(parsed)) {
          agendaValues.push(...parsed);
          continue;
        }
      } catch {
        // Fall back to delimiter-based parsing below.
      }
    }

    // Fallback for semicolon/comma/newline-delimited free-text extras.
    const splitValues = asString
      .split(/[,;\n]+/g)
      .map((value) => value.trim())
      .filter(Boolean);
    agendaValues.push(...splitValues);
  }

  const seen = new Set();
  return agendaValues
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((value) => {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return {
        id: slug || value,
        name: value,
      };
    });
}

/**
 * Grants organization `editor` role to a user.
 */
export async function assignUserToOrganizationEditor({ orgId, username }) {
  await addMember("organization_member_create", {
    id: orgId,
    username,
    role: "editor",
  });
}

/**
 * Removes a user from a CKAN organization.
 *
 * Idempotency:
 * - Missing membership is treated as success by `removeMember`.
 */
export async function removeUserFromOrganization({ orgId, username }) {
  await removeMember("organization_member_delete", {
    id: orgId,
    username,
  });
}

/**
 * Grants organization `admin` role to a user.
 */
export async function assignUserToOrganizationAdmin({ orgId, username }) {
  await addMember("organization_member_create", {
    id: orgId,
    username,
    role: "admin",
  });
}

/**
 * Reassigns organization membership role.
 *
 * System flow:
 * - Remove existing membership first.
 * - Recreate membership with target role.
 *
 * Dependency:
 * - Relies on idempotent behavior in `removeMember`/`addMember` helpers.
 */
export async function setOrganizationMemberRole({ orgId, username, role }) {
  const id = String(orgId || "").trim();
  const user = String(username || "").trim();
  const targetRole = String(role || "").trim().toLowerCase();
  if (!id || !user || !targetRole) return;

  await removeMember("organization_member_delete", {
    id,
    username: user,
  });
  await addMember("organization_member_create", {
    id,
    username: user,
    role: targetRole,
  });
}

/**
 * Creates a CKAN organization.
 */
export async function createOrganization(payload) {
  return ckanAction("organization_create", payload || {});
}

/**
 * Deletes a CKAN organization by id/name.
 *
 * Edge case:
 * - No-op when id is empty.
 */
export async function deleteOrganization(orgId) {
  const id = String(orgId || "").trim();
  if (!id) return;
  await ckanAction("organization_delete", { id });
}

/**
 * Updates organization title/extras metadata.
 *
 * System flow:
 * - Build normalized payload from incoming values.
 * - Attempt `organization_patch` first.
 * - Fallback to `organization_update` for CKAN versions lacking patch support.
 */
export async function updateOrganizationMetadata({
  orgId,
  title,
  extras = [],
}) {
  const id = String(orgId || "").trim();
  if (!id) throw new Error("Organization id is required.");

  const payload = {
    id,
    title: String(title || "").trim() || id,
    extras: Array.isArray(extras) ? extras : [],
  };

  try {
    // Prefer patch to avoid clobbering unrelated org fields on CKAN.
    return await ckanAction("organization_patch", payload);
  } catch {
    // Older CKAN setups may not expose organization_patch.
    return ckanAction("organization_update", payload);
  }
}
