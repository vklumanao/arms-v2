import crypto from "node:crypto";
import { config } from "./config.js";

function safeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function ckanErrorMessage(payload, fallback) {
  const err = payload?.error;
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (Array.isArray(err?.__type)) return err.__type.join(" | ");
  if (err?.message) return String(err.message);
  if (typeof err === "object") {
    const entries = Object.entries(err)
      .map(([key, value]) => {
        if (Array.isArray(value)) return `${key}: ${value.join(", ")}`;
        if (value && typeof value === "object")
          return `${key}: ${JSON.stringify(value)}`;
        return `${key}: ${String(value)}`;
      })
      .filter(Boolean);
    if (entries.length > 0) return entries.join(" | ");
  }
  return fallback;
}

async function ckanAction(action, body = {}) {
  const url = `${config.ckanBaseUrl}/api/3/action/${action}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: config.ckanApiKey,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const message = ckanErrorMessage(payload, `CKAN action failed: ${action}`);
    const error = new Error(message);
    error.status = response.status;
    error.action = action;
    error.payload = payload;
    throw error;
  }
  return payload.result;
}

function toText(value) {
  if (value == null) return "";
  return String(value).trim();
}

export async function listOrganizations() {
  return ckanAction("organization_list", {
    all_fields: true,
    include_extras: true,
  });
}

export async function listGroups() {
  return ckanAction("group_list", {
    all_fields: true,
    include_extras: true,
  });
}

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

export async function listUsers() {
  return ckanAction("user_list", {
    all_fields: true,
    include_site_user: true,
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
    const shouldInclude = allowedAgendaKeys.has(normalizedKey);
    if (!shouldInclude) continue;

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

export async function listDatasets({
  orgId = "",
  q = "",
  page = 1,
  limit = 100,
} = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const safePage = Math.max(1, Number(page) || 1);
  const start = (safePage - 1) * safeLimit;
  const fqParts = [];
  const cleanOrgId = String(orgId || "").trim();
  if (cleanOrgId) fqParts.push(`organization:${cleanOrgId}`);

  const result = await ckanAction("package_search", {
    q: String(q || "").trim() || "*:*",
    fq: fqParts.join(" AND "),
    include_private: true,
    rows: safeLimit,
    start,
    sort: "metadata_modified desc",
  });

  return {
    count: Number(result?.count || 0),
    datasets: Array.isArray(result?.results) ? result.results : [],
    page: safePage,
    limit: safeLimit,
  };
}

async function getUserByName(username) {
  try {
    return await ckanAction("user_show", { id: username });
  } catch {
    return null;
  }
}

async function getUserByEmail(email) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  try {
    const users = await ckanAction("user_list", {
      all_fields: true,
      include_site_user: true,
    });
    const list = Array.isArray(users) ? users : [];
    return (
      list.find(
        (user) =>
          String(user?.email || "")
            .trim()
            .toLowerCase() === normalized,
      ) || null
    );
  } catch {
    return null;
  }
}

function usernameFromEmail(email) {
  const [local] = String(email || "")
    .toLowerCase()
    .split("@");
  return safeSlug(local || "user");
}

export async function createOrGetUser({ email, fullName, password }) {
  const existingByEmail = await getUserByEmail(email);
  if (existingByEmail?.name) {
    return existingByEmail;
  }

  const base = usernameFromEmail(email);
  const candidates = [
    base,
    `${base}-${crypto.randomBytes(2).toString("hex")}`,
    `${base}-${crypto.randomBytes(3).toString("hex")}`,
  ];

  for (const candidate of candidates) {
    const existing = await getUserByName(candidate);
    if (existing?.name === candidate) {
      continue;
    }

    try {
      const created = await ckanAction("user_create", {
        name: candidate,
        email,
        fullname: fullName,
        password,
      });
      return created;
    } catch (error) {
      const msg = String(error?.message || "").toLowerCase();
      const recoverable =
        msg.includes("not available") ||
        msg.includes("already exists") ||
        msg.includes("already in use");
      if (msg.includes("email") && msg.includes("already")) {
        const user = await getUserByEmail(email);
        if (user?.name) return user;
      }
      if (!recoverable) throw error;
    }
  }

  throw new Error("Unable to create CKAN user with a unique username.");
}

async function addMember(action, body) {
  try {
    await ckanAction(action, body);
  } catch (error) {
    const msg = String(error?.message || "").toLowerCase();
    if (msg.includes("missing value") && msg.includes("role")) {
      const fallbackBody = { ...body };
      if (fallbackBody.capacity && !fallbackBody.role) {
        fallbackBody.role = fallbackBody.capacity;
      }
      delete fallbackBody.capacity;
      await ckanAction(action, fallbackBody);
      return;
    }
    if (msg.includes("already") && msg.includes("member")) return;
    throw error;
  }
}

async function removeMember(action, body) {
  try {
    await ckanAction(action, body);
  } catch (error) {
    const msg = String(error?.message || "").toLowerCase();
    const ignorable =
      msg.includes("not a member") ||
      msg.includes("not member") ||
      msg.includes("does not exist") ||
      msg.includes("cannot find");
    if (ignorable) return;
    throw error;
  }
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

export async function assignUserToGroupEditor({ groupId, username }) {
  await addMember("group_member_create", {
    id: groupId,
    username,
    role: "editor",
  });
}

export async function createApiTokenForUser(username) {
  const tokenName = `${config.ckanTokenNamePrefix}-${Date.now()}`;
  const result = await ckanAction("api_token_create", {
    user: username,
    name: tokenName,
  });

  return {
    token: result?.token,
    id: result?.id || null,
    name: tokenName,
  };
}

export async function updateCkanUserPassword(username, password) {
  await ckanAction("user_update", {
    id: username,
    password,
  });
}

export async function createDataset(payload) {
  return ckanAction("package_create", payload || {});
}

export async function updateDataset(payload) {
  return ckanAction("package_update", payload || {});
}

export async function deleteDataset(datasetId) {
  const id = toText(datasetId);
  if (!id) return;
  await ckanAction("package_delete", { id });
}

export async function createDatasetResource(payload) {
  return ckanAction("resource_create", payload || {});
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
