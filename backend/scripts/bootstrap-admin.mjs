import crypto from "node:crypto";
import { runMigrations } from "../src/db/migrations.js";
import { query } from "../src/db/client.js";
import {
  createUser,
  findUserByEmail,
  hashPassword,
  updateUser,
} from "../src/stores/user.store.js";

const BOOTSTRAP_MARKER_KEY = "bootstrap.admin.v1";

function asTrimmed(value) {
  return String(value || "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

async function isBootstrapDone() {
  const result = await query(
    `SELECT value FROM system_settings WHERE key = $1 LIMIT 1`,
    [BOOTSTRAP_MARKER_KEY],
  );
  return Boolean(result.rows?.[0]?.value);
}

async function markBootstrapDone(adminEmail) {
  await query(
    `
    INSERT INTO system_settings (key, value, updated_at)
    VALUES ($1, jsonb_build_object('admin_email', $2::text, 'completed_at', NOW()), NOW())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [BOOTSTRAP_MARKER_KEY, adminEmail],
  );
}

async function ensureBootstrapAdmin() {
  await runMigrations();

  if (await isBootstrapDone()) {
    console.log("[bootstrap-admin] Already completed, skipping.");
    return;
  }

  const adminEmail = asTrimmed(process.env.ARMS_BOOTSTRAP_ADMIN_EMAIL).toLowerCase();
  const adminPassword = asTrimmed(process.env.ARMS_BOOTSTRAP_ADMIN_PASSWORD);
  const adminName = asTrimmed(process.env.ARMS_BOOTSTRAP_ADMIN_NAME) || "ARMS Super Admin";
  const ckanUsername = asTrimmed(process.env.ARMS_BOOTSTRAP_ADMIN_CKAN_USERNAME) || null;
  const ckanUserId = asTrimmed(process.env.ARMS_BOOTSTRAP_ADMIN_CKAN_USER_ID) || null;

  if (!adminEmail) {
    throw new Error("ARMS_BOOTSTRAP_ADMIN_EMAIL is required.");
  }
  if (!adminPassword) {
    throw new Error("ARMS_BOOTSTRAP_ADMIN_PASSWORD is required.");
  }

  const existing = await findUserByEmail(adminEmail);
  if (!existing) {
    const passwordHash = await hashPassword(adminPassword);
    await createUser({
      id: crypto.randomUUID(),
      full_name: adminName,
      email: adminEmail,
      password_hash: passwordHash,
      role: "admin",
      department: null,
      ckan_org_id: null,
      ckan_group_id: null,
      ckan_username: ckanUsername,
      ckan_user_id: ckanUserId,
      ckan_api_token: null,
      ckan_api_token_created_at: null,
      is_active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    console.log(`[bootstrap-admin] Created ARMS admin: ${adminEmail}`);
  } else {
    const patch = {
      role: "admin",
      full_name: existing.full_name || adminName,
    };
    if (ckanUsername && !existing.ckan_username) patch.ckan_username = ckanUsername;
    if (ckanUserId && !existing.ckan_user_id) patch.ckan_user_id = ckanUserId;
    await updateUser(existing.id, patch);
    console.log(`[bootstrap-admin] Updated existing ARMS admin: ${adminEmail}`);
  }

  await markBootstrapDone(adminEmail);
  console.log("[bootstrap-admin] Bootstrap marker saved.");
}

ensureBootstrapAdmin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[bootstrap-admin] Failed:", error?.message || error);
    process.exit(1);
  });
