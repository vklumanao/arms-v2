import fs from "node:fs/promises";
import { config } from "../config/index.js";
import { encryptSecret } from "../security/crypto.js";
import { query } from "./client.js";

function nowIso() {
  return new Date().toISOString();
}

export async function runMigrations() {
  await query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

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
}

export async function importLegacyUsersJsonIfNeeded() {
  const countResult = await query(`SELECT COUNT(*)::int AS count FROM users`);
  const rowCount = Number(countResult.rows?.[0]?.count || 0);
  if (rowCount > 0)
    return { imported: 0, skipped: 0, reason: "users_table_not_empty" };

  let raw = "[]";
  try {
    raw = await fs.readFile(config.dataFile, "utf-8");
  } catch {
    return { imported: 0, skipped: 0, reason: "legacy_file_missing" };
  }

  let list = [];
  try {
    const parsed = JSON.parse(raw || "[]");
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
    const id = String(user?.id || "").trim();
    const email = String(user?.email || "")
      .trim()
      .toLowerCase();
    const fullName = String(user?.full_name || "").trim();
    const passwordHash = String(user?.password_hash || "").trim();
    const role = String(user?.role || "student").toLowerCase();

    if (!id || !email || !fullName || !passwordHash) {
      skipped += 1;
      continue;
    }

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

    imported += 1;
  }

  return { imported, skipped, reason: "ok" };
}
