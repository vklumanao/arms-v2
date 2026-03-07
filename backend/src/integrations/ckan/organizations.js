import { ckanAction } from "./http/ckanAction.js";
import { addMember, removeMember } from "./memberships.js";

export async function listOrganizations() {
  return ckanAction("organization_list", {
    all_fields: true,
    include_extras: true,
  });
}

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

export async function assignUserToOrganizationEditor({ orgId, username }) {
  await addMember("organization_member_create", {
    id: orgId,
    username,
    role: "editor",
  });
}

export async function assignUserToOrganizationAdmin({ orgId, username }) {
  await addMember("organization_member_create", {
    id: orgId,
    username,
    role: "admin",
  });
}

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

export async function createOrganization(payload) {
  return ckanAction("organization_create", payload || {});
}

export async function deleteOrganization(orgId) {
  const id = String(orgId || "").trim();
  if (!id) return;
  await ckanAction("organization_delete", { id });
}

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
    return await ckanAction("organization_patch", payload);
  } catch {
    return ckanAction("organization_update", payload);
  }
}
