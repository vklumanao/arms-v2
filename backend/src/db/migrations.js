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
      role TEXT NOT NULL,
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
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE`,
  );
  await query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`,
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

  await query(`
    DO $$
    DECLARE
      rec RECORD;
    BEGIN
      -- Allow flexible/custom role keys by removing legacy enum-like role CHECK constraints.
      -- Handles both default generated name (users_role_check) and any custom equivalent.
      FOR rec IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = CURRENT_SCHEMA()
          AND t.relname = 'users'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%role%'
          AND pg_get_constraintdef(c.oid) ILIKE '%student%'
          AND pg_get_constraintdef(c.oid) ILIKE '%faculty%'
          AND pg_get_constraintdef(c.oid) ILIKE '%admin%'
      LOOP
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', rec.conname);
      END LOOP;
    END
    $$;
  `);

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

  // Email verification tokens enable one-time email confirmation for new accounts.
  await query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(
    `CREATE INDEX IF NOT EXISTS idx_email_verification_token_hash ON email_verification_tokens (token_hash)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_email_verification_user_id ON email_verification_tokens (user_id)`,
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

  // RBAC core tables for role/permission management.
  await query(`
    CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_system BOOLEAN NOT NULL DEFAULT FALSE,
      is_critical BOOLEAN NOT NULL DEFAULT FALSE,
      legacy_role TEXT,
      parent_role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      module TEXT NOT NULL DEFAULT 'General',
      action TEXT NOT NULL DEFAULT 'manage',
      description TEXT,
      is_system BOOLEAN NOT NULL DEFAULT FALSE,
      is_critical BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(
    `ALTER TABLE permissions ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'manage'`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (role_id, permission_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, role_id)
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_roles_key ON roles (key)`);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_permissions_key ON permissions (key)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions (module)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_permissions_module_action ON permissions (module, action)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions (role_id)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions (permission_id)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id)`,
  );

  // Research-center scorecard system powers the RDISO balanced scorecard dashboard.
  await query(`
    CREATE TABLE IF NOT EXISTS research_centers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_research_centers_code ON research_centers (code)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_research_centers_is_active ON research_centers (is_active)`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS scorecard_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      version TEXT NOT NULL DEFAULT '1.0',
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_scorecard_templates_is_default ON scorecard_templates (is_default)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_scorecard_templates_is_active ON scorecard_templates (is_active)`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS scorecard_template_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID NOT NULL REFERENCES scorecard_templates(id) ON DELETE CASCADE,
      sheet_code INTEGER NOT NULL,
      deliverable TEXT NOT NULL,
      target_type TEXT NOT NULL DEFAULT 'count',
      default_target NUMERIC(12,3) NOT NULL DEFAULT 0,
      success_indicator TEXT,
      weight NUMERIC(12,3) NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (template_id, sheet_code)
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_scorecard_template_items_template_id ON scorecard_template_items (template_id)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_scorecard_template_items_sort_order ON scorecard_template_items (template_id, sort_order)`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS center_scorecards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      center_id UUID NOT NULL REFERENCES research_centers(id) ON DELETE CASCADE,
      template_id UUID REFERENCES scorecard_templates(id) ON DELETE SET NULL,
      year INTEGER NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
      approved_at TIMESTAMPTZ,
      locked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (center_id, year)
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_center_scorecards_center_year ON center_scorecards (center_id, year)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_center_scorecards_status ON center_scorecards (status)`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS center_scorecard_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      center_scorecard_id UUID NOT NULL REFERENCES center_scorecards(id) ON DELETE CASCADE,
      template_item_id UUID REFERENCES scorecard_template_items(id) ON DELETE SET NULL,
      sheet_code INTEGER NOT NULL,
      deliverable TEXT NOT NULL,
      target_type TEXT NOT NULL DEFAULT 'count',
      target NUMERIC(12,3) NOT NULL DEFAULT 0,
      success_indicator TEXT,
      weight NUMERIC(12,3) NOT NULL DEFAULT 1,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (center_scorecard_id, sheet_code)
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_center_scorecard_items_scorecard_id ON center_scorecard_items (center_scorecard_id)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_center_scorecard_items_sort_order ON center_scorecard_items (center_scorecard_id, sort_order)`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS scorecard_accomplishments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      center_scorecard_item_id UUID NOT NULL REFERENCES center_scorecard_items(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      source_id TEXT,
      actual_value NUMERIC(12,3) NOT NULL DEFAULT 0,
      evidence_url TEXT,
      evidence_file_id TEXT,
      remarks TEXT,
      recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_scorecard_accomplishments_item_id ON scorecard_accomplishments (center_scorecard_item_id)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_scorecard_accomplishments_source ON scorecard_accomplishments (source_type, source_id)`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS scorecard_sources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      center_scorecard_item_id UUID NOT NULL REFERENCES center_scorecard_items(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      evidence_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (center_scorecard_item_id, source_type, source_id)
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_scorecard_sources_item_id ON scorecard_sources (center_scorecard_item_id)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_scorecard_sources_lookup ON scorecard_sources (source_type, source_id)`,
  );

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'center_scorecards_status_allowed'
      ) THEN
        ALTER TABLE center_scorecards
          ADD CONSTRAINT center_scorecards_status_allowed
          CHECK (status IN ('draft', 'active', 'locked', 'archived'));
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'scorecard_template_items_target_type_allowed'
      ) THEN
        ALTER TABLE scorecard_template_items
          ADD CONSTRAINT scorecard_template_items_target_type_allowed
          CHECK (target_type IN ('count', 'percent', 'currency'));
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'center_scorecard_items_target_type_allowed'
      ) THEN
        ALTER TABLE center_scorecard_items
          ADD CONSTRAINT center_scorecard_items_target_type_allowed
          CHECK (target_type IN ('count', 'percent', 'currency'));
      END IF;
    END
    $$;
  `);

  // Seed the default RDISO scorecard template so new centers can clone it immediately.
  await query(`
    DO $$
    DECLARE
      default_template_id UUID;
    BEGIN
      SELECT id
      INTO default_template_id
      FROM scorecard_templates
      WHERE is_default = TRUE
      ORDER BY created_at ASC
      LIMIT 1;

      IF default_template_id IS NULL THEN
        INSERT INTO scorecard_templates (
          name,
          description,
          version,
          is_default,
          is_active
        ) VALUES (
          'RDISO Default Scorecard',
          'Default RDISO balanced scorecard template for research center yearly planning.',
          '1.0',
          TRUE,
          TRUE
        )
        RETURNING id INTO default_template_id;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM scorecard_template_items sti
        WHERE sti.template_id = default_template_id
      ) THEN
        INSERT INTO scorecard_template_items (
          template_id,
          sheet_code,
          deliverable,
          target_type,
          default_target,
          success_indicator,
          weight,
          sort_order,
          is_active
        ) VALUES
          (default_template_id, 1, 'Number of Scopus-indexed journal publication as either main or co-author (on top of the professorial rank)', 'count', 1, 'Published Paper', 1, 1, TRUE),
          (default_template_id, 2, 'Number of patent, utility model, industrial design, or other Intellectual Property (i.e. copyright) application', 'count', 1, 'Patent Applied', 1, 2, TRUE),
          (default_template_id, 3, 'Number of research collaborations established with other agencies and/or academic institutions and with active MOA/MOU', 'count', 1, 'Notarized MOA', 1, 3, TRUE),
          (default_template_id, 4, 'Number of Scopus-indexed journal article from an affiliated faculty member of the RDI Center with an international author.', 'count', 2, 'Published Paper', 1, 4, TRUE),
          (default_template_id, 5, 'Average utilization rate of allocated funds for research and development (for all funding: GAA, IGF and others, i.e. DOST, CHED)', 'percent', 90, 'Audited Financial Report / COS Contract', 1, 5, TRUE),
          (default_template_id, 6, 'Number of research outputs utilized by the industry or by other beneficiaries', 'count', 1, 'Certificate of Utilization', 1, 6, TRUE),
          (default_template_id, 7, 'Number of research outputs completed within the year (i.e. from either GAA or externally-funded projects; or students'' thesis projects packaged with scholarly work with project proposal registered at OVPRIE)', 'count', 10, 'Approved Scholarly Work and published paper(s)', 1, 7, TRUE),
          (default_template_id, 8, 'Number of creative research outputs registered as intellectual property, rights and utilized for commercial and industrial purposes.', 'count', 2, 'Patent Approval and Proof of Income', 1, 8, TRUE),
          (default_template_id, 9, 'Number of research creative outputs registered as intellectual property rights, but not utilized for commercial and industrial purposes.', 'count', 1, 'Patent Approval', 1, 9, TRUE),
          (default_template_id, 10, 'No. of research projects proposed, directed, mandated, or focused on CSU internal challenges or priorities, and implemented within the year.', 'count', 2, 'Certificate of Utilization', 1, 10, TRUE),
          (default_template_id, 11, 'No. of implemented research projects/programs pertaining to agri-food systems (combined target for all R&D Centers)', 'count', 0, 'Approved Scholarly Work and Notarized MOA', 1, 11, TRUE),
          (default_template_id, 12, 'Percentage of Research outputs published in internationally refereed or CHED recognized Journal within the year (combined target for all R&D Centers).', 'percent', 40, 'Published paper indexed in Scopus or Journals recognized by CHED', 1, 12, TRUE),
          (default_template_id, 13, 'Number of applied research.', 'count', 1, '', 1, 13, TRUE),
          (default_template_id, 14, 'Number of interdisciplinary outputs.', 'count', 1, '', 1, 14, TRUE),
          (default_template_id, 15, 'Number of knowledge products', 'count', 1, '', 1, 15, TRUE)
        ON CONFLICT (template_id, sheet_code) DO NOTHING;
      END IF;
    END
    $$;
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
