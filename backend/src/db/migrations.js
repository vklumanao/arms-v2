import fs from "node:fs/promises";
import { config } from "../config/index.js";
import { encryptSecret } from "../security/crypto.js";
import { query } from "./client.js";

/**
 * Returns the current timestamp in ISO-8601 format.
 *
 * Used as a fallback timestamp source when importing legacy users that
 * do not contain complete date fields.
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Applies schema migrations required by the backend.
 *
 * System flow:
 * - Ensure required PostgreSQL extension exists.
 * - Create core tables when missing.
 * - Apply additive column updates for backward compatibility.
 * - Add integrity constraints and indexes for query performance.
 *
 * Edge case handling:
 * - This migration set is rerunnable by design (`IF NOT EXISTS`) so startup
 *   can safely call it on every process boot.
 *
 * Dependencies:
 * - All database writes are executed via `query` from `db/client.js`.
 */
export async function runMigrations() {
  // Keep migrations rerunnable on every boot because deployment targets may be ephemeral.
  await query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  // Primary user table consumed by auth, admin, profile, and integration modules.
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student','faculty','admin')),
      department TEXT,
      ckan_org_id TEXT,
      ckan_group_id TEXT,
      ckan_username TEXT,
      ckan_user_id TEXT,
      ckan_api_token TEXT,
      ckan_api_token_created_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_users_ckan_username ON users (ckan_username)`,
  );

  // Additive user-profile columns introduced after initial table rollout.
  await query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_scholar_link TEXT`,
  );
  await query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_status TEXT`,
  );
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS designation TEXT`);
  await query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_gs_faculty BOOLEAN NOT NULL DEFAULT FALSE`,
  );
  await query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS publication_count INTEGER NOT NULL DEFAULT 0`,
  );
  await query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS research_project_count INTEGER NOT NULL DEFAULT 0`,
  );
  await query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS creative_work_count INTEGER NOT NULL DEFAULT 0`,
  );
  await query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS awards_count INTEGER NOT NULL DEFAULT 0`,
  );
  await query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS ip_count INTEGER NOT NULL DEFAULT 0`,
  );

  await query(
    `
    -- CHECK constraints do not have IF NOT EXISTS syntax, so a guarded DO block is used.
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_publication_count_nonnegative'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_publication_count_nonnegative CHECK (publication_count >= 0);
      END IF;
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_research_project_count_nonnegative'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_research_project_count_nonnegative CHECK (research_project_count >= 0);
      END IF;
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_creative_work_count_nonnegative'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_creative_work_count_nonnegative CHECK (creative_work_count >= 0);
      END IF;
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_awards_count_nonnegative'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_awards_count_nonnegative CHECK (awards_count >= 0);
      END IF;
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_ip_count_nonnegative'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_ip_count_nonnegative CHECK (ip_count >= 0);
      END IF;
    END
    $$;
    `,
  );

  // Reset token table is used by auth password recovery flow.
  await query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(
    `CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens (token_hash)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens (user_id)`,
  );

  // Audit table tracks security and admin activity for traceability.
  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs (event_type)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC)`,
  );

  // Generic key/value settings used for one-time bootstrap markers and system flags.
  await query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * Imports legacy JSON users into PostgreSQL during bootstrap.
 *
 * System flow:
 * - Exit when users table already contains records.
 * - Read legacy JSON from `config.dataFile`.
 * - Parse and validate rows.
 * - Normalize values and insert users with conflict protection.
 *
 * Data transformation:
 * - Email is trimmed + lowercased.
 * - Role is normalized to `student|faculty|admin`.
 * - CKAN API token is encrypted before persistence.
 * - Missing timestamps fall back to `nowIso()`.
 *
 * Edge case handling:
 * - Missing file, invalid JSON, and empty input are reported via reason codes.
 * - Invalid rows are skipped rather than failing the entire import.
 *
 * Dependencies:
 * - Reads source path from config.
 * - Uses `encryptSecret` for token storage compatibility with current security model.
 */
export async function importLegacyUsersJsonIfNeeded() {
  // Import is bootstrap-only to avoid mixing stale JSON data into active environments.
  const countResult = await query(`SELECT COUNT(*)::int AS count FROM users`);
  const rowCount = Number(countResult.rows?.[0]?.count || 0);
  // Database becomes the single source of truth after first successful population.
  if (rowCount > 0)
    return { imported: 0, skipped: 0, reason: "users_table_not_empty" };

  let raw = "[]";
  try {
    raw = await fs.readFile(config.dataFile, "utf-8");
  } catch {
    // Legacy file is optional in fresh environments.
    return { imported: 0, skipped: 0, reason: "legacy_file_missing" };
  }

  let list = [];
  try {
    const parsed = JSON.parse(raw || "[]");
    // The legacy payload is expected to be an array of user-like objects.
    list = Array.isArray(parsed) ? parsed : [];
  } catch {
    return { imported: 0, skipped: 0, reason: "legacy_file_invalid_json" };
  }

  if (list.length === 0) {
    return { imported: 0, skipped: 0, reason: "legacy_file_empty" };
  }

  let imported = 0;
  let skipped = 0;

  for (const user of list) {
    // Normalize incoming fields before validation and persistence.
    const id = String(user?.id || "").trim();
    const email = String(user?.email || "")
      .trim()
      .toLowerCase();
    const fullName = String(user?.full_name || "").trim();
    const passwordHash = String(user?.password_hash || "").trim();
    const role = String(user?.role || "student").toLowerCase();

    if (!id || !email || !fullName || !passwordHash) {
      // Skip malformed rows to preserve progress for valid rows.
      skipped += 1;
      continue;
    }

    // Restrict imported roles to currently supported enum values.
    const cleanRole =
      role === "faculty" ? "faculty" : role === "admin" ? "admin" : "student";

    await query(
      `
      INSERT INTO users (
        id, full_name, email, password_hash, role, department,
        ckan_org_id, ckan_group_id, ckan_username, ckan_user_id,
        ckan_api_token, ckan_api_token_created_at, is_active, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,
        $11,$12,$13,$14,$15
      )
      ON CONFLICT (email) DO NOTHING
      `,
      [
        id,
        fullName,
        email,
        passwordHash,
        cleanRole,
        user?.department || null,
        user?.ckan_org_id || null,
        user?.ckan_group_id || null,
        user?.ckan_username || null,
        user?.ckan_user_id || null,
        encryptSecret(user?.ckan_api_token || null),
        user?.ckan_api_token_created_at || null,
        user?.is_active !== false,
        user?.created_at || nowIso(),
        user?.updated_at || nowIso(),
      ],
    );

    // Keep return summary aligned with processed source rows.
    imported += 1;
  }

  return { imported, skipped, reason: "ok" };
}
