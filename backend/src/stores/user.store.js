import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { config } from "../config/index.js";
import { decryptSecret, encryptSecret } from "../security/crypto.js";
import { query } from "../db/client.js";

function nowIso() {
  return new Date().toISOString();
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isAuthenticated: true,
  };
}

function sanitizeProfile(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active !== false,
    department: user.department || null,
    ckan_org_id: user.ckan_org_id || null,
    ckan_group_id: user.ckan_group_id || null,
    ckan_username: user.ckan_username || null,
    google_scholar_link: user.google_scholar_link || null,
    employment_status: user.employment_status || null,
    designation: user.designation || null,
    is_gs_faculty: Boolean(user.is_gs_faculty),
    publication_count: Number(user.publication_count || 0),
    research_project_count: Number(user.research_project_count || 0),
    creative_work_count: Number(user.creative_work_count || 0),
    awards_count: Number(user.awards_count || 0),
    ip_count: Number(user.ip_count || 0),
  };
}

function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    password_hash: row.password_hash,
    role: row.role,
    department: row.department,
    ckan_org_id: row.ckan_org_id,
    ckan_group_id: row.ckan_group_id,
    ckan_username: row.ckan_username,
    ckan_user_id: row.ckan_user_id,
    ckan_api_token: decryptSecret(row.ckan_api_token),
    ckan_api_token_created_at: row.ckan_api_token_created_at,
    google_scholar_link: row.google_scholar_link,
    employment_status: row.employment_status,
    designation: row.designation,
    is_gs_faculty: row.is_gs_faculty,
    publication_count: row.publication_count,
    research_project_count: row.research_project_count,
    creative_work_count: row.creative_work_count,
    awards_count: row.awards_count,
    ip_count: row.ip_count,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function ensureDefaultAdmin() {
  const existing = await findUserByEmail(config.defaultAdminEmail);
  if (existing) return;

  const password_hash = await bcrypt.hash(config.defaultAdminPassword, 10);
  await createUser({
    id: crypto.randomUUID(),
    full_name: "ARMS Admin",
    email: config.defaultAdminEmail,
    password_hash,
    role: "admin",
    department: null,
    ckan_org_id: null,
    ckan_group_id: null,
    ckan_username: null,
    ckan_user_id: null,
    ckan_api_token: null,
    ckan_api_token_created_at: null,
    is_active: true,
    created_at: nowIso(),
    updated_at: nowIso(),
  });
}

export async function findUserByEmail(email) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  const result = await query(`SELECT * FROM users WHERE email = $1 LIMIT 1`, [
    normalized,
  ]);
  return mapUserRow(result.rows?.[0] || null);
}

export async function findUserById(id) {
  const result = await query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [
    String(id || ""),
  ]);
  return mapUserRow(result.rows?.[0] || null);
}

export async function createUser(input) {
  const user = {
    id: input.id || crypto.randomUUID(),
    full_name: String(input.full_name || "").trim(),
    email: String(input.email || "")
      .trim()
      .toLowerCase(),
    password_hash: String(input.password_hash || "").trim(),
    role: String(input.role || "student").toLowerCase(),
    department: input.department || null,
    ckan_org_id: input.ckan_org_id || null,
    ckan_group_id: input.ckan_group_id || null,
    ckan_username: input.ckan_username || null,
    ckan_user_id: input.ckan_user_id || null,
    ckan_api_token: input.ckan_api_token || null,
    ckan_api_token_created_at: input.ckan_api_token_created_at || null,
    google_scholar_link: input.google_scholar_link || null,
    employment_status: input.employment_status || null,
    designation: input.designation || null,
    is_gs_faculty: input.is_gs_faculty === true,
    publication_count: Math.max(0, Number(input.publication_count || 0) || 0),
    research_project_count: Math.max(
      0,
      Number(input.research_project_count || 0) || 0,
    ),
    creative_work_count: Math.max(
      0,
      Number(input.creative_work_count || 0) || 0,
    ),
    awards_count: Math.max(0, Number(input.awards_count || 0) || 0),
    ip_count: Math.max(0, Number(input.ip_count || 0) || 0),
    is_active: input.is_active !== false,
    created_at: input.created_at || nowIso(),
    updated_at: input.updated_at || nowIso(),
  };

  const result = await query(
    `
    INSERT INTO users (
      id, full_name, email, password_hash, role, department,
      ckan_org_id, ckan_group_id, ckan_username, ckan_user_id,
      ckan_api_token, ckan_api_token_created_at,
      google_scholar_link, employment_status, designation, is_gs_faculty,
      publication_count, research_project_count, creative_work_count, awards_count, ip_count,
      is_active, created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,
      $7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,
      $17,$18,$19,$20,$21,
      $22,$23,$24
    )
    RETURNING *
    `,
    [
      user.id,
      user.full_name,
      user.email,
      user.password_hash,
      user.role,
      user.department,
      user.ckan_org_id,
      user.ckan_group_id,
      user.ckan_username,
      user.ckan_user_id,
      encryptSecret(user.ckan_api_token),
      user.ckan_api_token_created_at,
      user.google_scholar_link,
      user.employment_status,
      user.designation,
      user.is_gs_faculty,
      user.publication_count,
      user.research_project_count,
      user.creative_work_count,
      user.awards_count,
      user.ip_count,
      user.is_active,
      user.created_at,
      user.updated_at,
    ],
  );

  return mapUserRow(result.rows?.[0] || null);
}

export async function updateUser(id, patch) {
  const allowed = new Set([
    "full_name",
    "email",
    "password_hash",
    "role",
    "department",
    "ckan_org_id",
    "ckan_group_id",
    "ckan_username",
    "ckan_user_id",
    "ckan_api_token",
    "ckan_api_token_created_at",
    "google_scholar_link",
    "employment_status",
    "designation",
    "is_gs_faculty",
    "publication_count",
    "research_project_count",
    "creative_work_count",
    "awards_count",
    "ip_count",
    "is_active",
  ]);

  const entries = Object.entries(patch || {}).filter(([key]) =>
    allowed.has(key),
  );
  if (entries.length === 0) return findUserById(id);

  const sets = [];
  const values = [];

  for (const [key, value] of entries) {
    const column = key === "email" ? "email" : key;
    let nextValue =
      key === "email"
        ? String(value || "")
            .trim()
            .toLowerCase()
        : value;
    if (
      key === "google_scholar_link" ||
      key === "employment_status" ||
      key === "designation"
    ) {
      const trimmed = String(value || "").trim();
      nextValue = trimmed || null;
    }
    if (key === "is_gs_faculty") {
      nextValue = Boolean(value);
    }
    if (
      key === "publication_count" ||
      key === "research_project_count" ||
      key === "creative_work_count" ||
      key === "awards_count" ||
      key === "ip_count"
    ) {
      nextValue = Math.max(0, Number(value || 0) || 0);
    }
    if (key === "ckan_api_token") {
      nextValue = encryptSecret(value);
    }
    values.push(nextValue);
    sets.push(`${column} = $${values.length}`);
  }

  values.push(nowIso());
  sets.push(`updated_at = $${values.length}`);
  values.push(String(id || ""));

  const result = await query(
    `UPDATE users SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values,
  );

  return mapUserRow(result.rows?.[0] || null);
}

export async function verifyPassword(user, plainPassword) {
  return bcrypt.compare(String(plainPassword || ""), user.password_hash);
}

export async function hashPassword(plainPassword) {
  return bcrypt.hash(String(plainPassword || ""), 10);
}

export function toAuthPayload(user, token) {
  return {
    token,
    user: sanitizeUser(user),
    profile: sanitizeProfile(user),
  };
}

