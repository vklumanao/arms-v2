import { query } from "../db/client.js";

export const DEFAULT_PERMISSION_CATALOG = [
  {
    key: "dashboard.view",
    label: "Dashboard: View",
    module: "Dashboard",
    action: "view",
    description: "Access dashboard metrics and summaries.",
    is_system: true,
  },
  {
    key: "affiliate_profile.view",
    label: "My Profile: View",
    module: "Profile",
    action: "view",
    description: "View affiliate profile records.",
    is_system: true,
  },
  {
    key: "affiliations.manage",
    label: "Affiliations: Manage",
    module: "Submissions",
    action: "edit",
    description: "Create and edit affiliation-based project records.",
    is_system: true,
  },
  {
    key: "research_outputs.view",
    label: "Research Outputs: View",
    module: "Submissions",
    action: "view",
    description: "View research output listings.",
    is_system: true,
  },
  {
    key: "awards_recognition.view",
    label: "Awards and Recognition: View",
    module: "Submissions",
    action: "view",
    description: "View awards and recognition records.",
    is_system: true,
  },
  {
    key: "admin.controls.manage",
    label: "Admin Controls: Manage",
    module: "Administration",
    action: "manage",
    description: "Access administrative controls and secure settings.",
    is_system: true,
    is_critical: true,
  },
  {
    key: "admin.users.manage",
    label: "Admin Users: Manage",
    module: "User Management",
    action: "manage",
    description: "Manage user accounts and account status.",
    is_system: true,
  },
  {
    key: "admin.affiliates.manage",
    label: "Admin Affiliates: Manage",
    module: "Administration",
    action: "manage",
    description: "Manage affiliate assignment and directory records.",
    is_system: true,
  },
  {
    key: "admin.rbac.manage",
    label: "RBAC: Manage",
    module: "Access Control",
    action: "manage",
    description: "Manage roles, permissions, and role assignments.",
    is_system: true,
    is_critical: true,
  },
  {
    key: "create_user",
    label: "Create User",
    module: "User Management",
    action: "create",
    description: "Create new users.",
    is_system: true,
  },
  {
    key: "edit_user",
    label: "Edit User",
    module: "User Management",
    action: "edit",
    description: "Edit existing users.",
    is_system: true,
  },
  {
    key: "delete_user",
    label: "Delete User",
    module: "User Management",
    action: "delete",
    description: "Delete users.",
    is_system: true,
  },
  {
    key: "view_reports",
    label: "View Reports",
    module: "Reports",
    action: "view",
    description: "View generated reports.",
    is_system: true,
  },
  {
    key: "settings.manage",
    label: "Settings: Manage",
    module: "Settings",
    action: "manage",
    description: "Manage system-level settings.",
    is_system: true,
  },
];

export const DEFAULT_ROLE_CATALOG = [
  {
    key: "admin",
    name: "Admin",
    description: "Full system administration access.",
    sort_order: 100,
    is_system: true,
    is_critical: true,
    legacy_role: "admin",
  },
  {
    key: "faculty",
    name: "Faculty",
    description: "Faculty contributor role.",
    sort_order: 50,
    is_system: true,
    is_critical: false,
    legacy_role: "faculty",
  },
  {
    key: "student",
    name: "Student",
    description: "Student contributor role.",
    sort_order: 30,
    is_system: true,
    is_critical: false,
    legacy_role: "student",
  },
];

export const DEFAULT_ROLE_PERMISSION_MAP = {
  student: [
    "dashboard.view",
    "affiliate_profile.view",
    "affiliations.manage",
    "research_outputs.view",
    "awards_recognition.view",
  ],
  faculty: [
    "dashboard.view",
    "affiliate_profile.view",
    "affiliations.manage",
    "research_outputs.view",
    "awards_recognition.view",
  ],
  admin: DEFAULT_PERMISSION_CATALOG.map((permission) => permission.key),
};

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeUniqueList(values) {
  const seen = new Set();
  const list = [];
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeKey(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    list.push(normalized);
  }
  return list;
}

function inferPermissionAction(permission) {
  const explicit = String(permission?.action || "")
    .trim()
    .toLowerCase();
  if (explicit) return explicit;

  const key = String(permission?.key || "")
    .trim()
    .toLowerCase();
  if (key.startsWith("create_")) return "create";
  if (key.startsWith("view_")) return "view";
  if (key.startsWith("edit_")) return "edit";
  if (key.startsWith("delete_")) return "delete";
  if (key.endsWith(".view")) return "view";
  if (key.endsWith(".create")) return "create";
  if (key.endsWith(".edit") || key.endsWith(".update")) return "edit";
  if (key.endsWith(".delete") || key.endsWith(".remove")) return "delete";
  if (key.endsWith(".manage")) return "manage";
  return "manage";
}

function deriveLegacyRoleFromAssignedRoles(roleRows, fallbackRole) {
  const keys = new Set(
    (Array.isArray(roleRows) ? roleRows : []).map((row) =>
      String(row?.key || "").trim().toLowerCase(),
    ),
  );
  if (keys.has("admin")) return "admin";
  if (keys.has("faculty")) return "faculty";
  if (keys.has("student")) return "student";

  const normalizedFallback = String(fallbackRole || "")
    .trim()
    .toLowerCase();
  if (["admin", "faculty", "student"].includes(normalizedFallback)) {
    return normalizedFallback;
  }
  return "student";
}

async function getRoleIdMapByKey() {
  const result = await query(`SELECT id, key FROM roles`);
  const map = new Map();
  for (const row of result.rows || []) {
    const key = String(row?.key || "").trim().toLowerCase();
    if (!key) continue;
    map.set(key, row.id);
  }
  return map;
}

async function getPermissionIdMapByKey() {
  const result = await query(`SELECT id, key FROM permissions`);
  const map = new Map();
  for (const row of result.rows || []) {
    const key = String(row?.key || "").trim().toLowerCase();
    if (!key) continue;
    map.set(key, row.id);
  }
  return map;
}

async function runLegacyRoleCleanupOnce() {
  const settingKey = "rbac.legacy_role_cleanup_v1_applied";
  const marker = await query(
    `SELECT key FROM system_settings WHERE key = $1 LIMIT 1`,
    [settingKey],
  );
  if (marker.rows?.[0]) return;

  const deprecatedRoleKeys = ["manager", "staff", "viewer"];
  await query(
    `
    UPDATE users
    SET role = 'student', updated_at = NOW()
    WHERE LOWER(TRIM(COALESCE(role, ''))) = ANY($1::text[])
    `,
    [deprecatedRoleKeys],
  );
  await query(
    `
    DELETE FROM roles
    WHERE key = ANY($1::text[])
    `,
    [deprecatedRoleKeys],
  );
  await query(
    `
    INSERT INTO system_settings (key, value, updated_at)
    VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [
      settingKey,
      JSON.stringify({
        applied_at: new Date().toISOString(),
        deprecated_roles: deprecatedRoleKeys,
      }),
    ],
  );
}

export async function ensureRbacSeedData() {
  for (const permission of DEFAULT_PERMISSION_CATALOG) {
    await query(
      `
      INSERT INTO permissions (key, label, module, action, description, is_system, is_critical)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (key) DO UPDATE
        SET
          label = EXCLUDED.label,
          module = EXCLUDED.module,
          action = EXCLUDED.action,
          description = EXCLUDED.description,
          is_system = EXCLUDED.is_system,
          is_critical = EXCLUDED.is_critical,
          updated_at = NOW()
      `,
      [
        permission.key,
        permission.label,
        permission.module,
        inferPermissionAction(permission),
        permission.description || null,
        permission.is_system === true,
        permission.is_critical === true,
      ],
    );
  }

  for (const role of DEFAULT_ROLE_CATALOG) {
    await query(
      `
      INSERT INTO roles (key, name, description, sort_order, is_system, is_critical, legacy_role)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (key) DO UPDATE
        SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          sort_order = EXCLUDED.sort_order,
          is_system = EXCLUDED.is_system,
          is_critical = EXCLUDED.is_critical,
          legacy_role = EXCLUDED.legacy_role,
          updated_at = NOW()
      `,
      [
        role.key,
        role.name,
        role.description || null,
        Number(role.sort_order || 0),
        role.is_system === true,
        role.is_critical === true,
        role.legacy_role || null,
      ],
    );
  }

  // Cleanup legacy templates once; avoid deleting roles repeatedly on every boot.
  await runLegacyRoleCleanupOnce();

  const roleIdMap = await getRoleIdMapByKey();
  const permissionIdMap = await getPermissionIdMapByKey();

  for (const [roleKey, defaultKeys] of Object.entries(DEFAULT_ROLE_PERMISSION_MAP)) {
    const roleId = roleIdMap.get(String(roleKey || "").toLowerCase());
    if (!roleId) continue;

    if (roleKey === "admin") {
      for (const permissionId of permissionIdMap.values()) {
        await query(
          `
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, permission_id) DO NOTHING
          `,
          [roleId, permissionId],
        );
      }
      continue;
    }

    const countResult = await query(
      `SELECT COUNT(*)::int AS count FROM role_permissions WHERE role_id = $1`,
      [roleId],
    );
    const hasAssignments = Number(countResult.rows?.[0]?.count || 0) > 0;
    if (hasAssignments) continue;

    const permissionKeys = normalizeUniqueList(defaultKeys);
    for (const permissionKey of permissionKeys) {
      const permissionId = permissionIdMap.get(permissionKey);
      if (!permissionId) continue;
      await query(
        `
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT (role_id, permission_id) DO NOTHING
        `,
        [roleId, permissionId],
      );
    }
  }

  await query(
    `
    INSERT INTO user_roles (user_id, role_id)
    SELECT u.id, r.id
    FROM users u
    JOIN roles r ON r.key = LOWER(TRIM(COALESCE(u.role, 'student')))
    ON CONFLICT (user_id, role_id) DO NOTHING
    `,
  );
}

export async function listRoles({ search = "" } = {}) {
  const keyword = String(search || "").trim().toLowerCase();
  const result = await query(
    `
    SELECT
      r.id,
      r.key,
      r.name,
      r.description,
      r.sort_order,
      r.is_system,
      r.is_critical,
      r.legacy_role,
      r.parent_role_id,
      r.created_at,
      r.updated_at,
      COUNT(DISTINCT ur.user_id)::int AS assigned_user_count,
      COUNT(DISTINCT rp.permission_id)::int AS permission_count
    FROM roles r
    LEFT JOIN user_roles ur ON ur.role_id = r.id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    WHERE
      $1 = '' OR
      LOWER(r.key) LIKE ('%' || $1 || '%') OR
      LOWER(r.name) LIKE ('%' || $1 || '%')
    GROUP BY r.id
    ORDER BY r.sort_order DESC, r.name ASC
    `,
    [keyword],
  );

  return (result.rows || []).map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description || null,
    sort_order: Number(row.sort_order || 0),
    is_system: row.is_system === true,
    is_critical: row.is_critical === true,
    legacy_role: row.legacy_role || null,
    parent_role_id: row.parent_role_id || null,
    assigned_user_count: Number(row.assigned_user_count || 0),
    permission_count: Number(row.permission_count || 0),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  }));
}

export async function listPermissions({ search = "", module = "", action = "" } = {}) {
  const keyword = String(search || "").trim().toLowerCase();
  const moduleFilter = String(module || "").trim().toLowerCase();
  const actionFilter = String(action || "").trim().toLowerCase();
  const result = await query(
    `
    SELECT
      p.id,
      p.key,
      p.label,
      p.module,
      p.action,
      p.description,
      p.is_system,
      p.is_critical,
      p.created_at,
      p.updated_at
    FROM permissions p
    WHERE
      ($1 = '' OR LOWER(p.key) LIKE ('%' || $1 || '%') OR LOWER(p.label) LIKE ('%' || $1 || '%'))
      AND ($2 = '' OR LOWER(p.module) = $2)
      AND ($3 = '' OR LOWER(p.action) = $3)
    ORDER BY p.module ASC, p.action ASC, p.label ASC, p.key ASC
    `,
    [keyword, moduleFilter, actionFilter],
  );

  return (result.rows || []).map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    module: row.module || "General",
    action: String(row.action || "manage")
      .trim()
      .toLowerCase(),
    description: row.description || null,
    is_system: row.is_system === true,
    is_critical: row.is_critical === true,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  }));
}

export async function listRolePermissionMap() {
  const result = await query(
    `
    SELECT
      r.key AS role_key,
      p.key AS permission_key
    FROM roles r
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    ORDER BY r.sort_order DESC, r.name ASC, p.module ASC, p.key ASC
    `,
  );

  const map = {};
  for (const row of result.rows || []) {
    const roleKey = String(row?.role_key || "").trim().toLowerCase();
    if (!roleKey) continue;
    if (!Array.isArray(map[roleKey])) map[roleKey] = [];
    const permissionKey = String(row?.permission_key || "").trim();
    if (permissionKey) map[roleKey].push(permissionKey);
  }

  return map;
}

export async function listRolePermissions(identifier) {
  const role = await findRoleByIdentifier(identifier);
  if (!role) return { error: "Role not found.", status: 404 };

  const result = await query(
    `
    SELECT p.key
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = $1
    ORDER BY p.key ASC
    `,
    [role.id],
  );

  return {
    data: {
      role_id: role.id,
      role_key: role.key,
      permission_keys: (result.rows || [])
        .map((row) => String(row?.key || "").trim())
        .filter(Boolean),
    },
  };
}

async function findRoleByIdentifier(identifier) {
  const value = String(identifier || "").trim();
  if (!value) return null;

  const byId = await query(`SELECT * FROM roles WHERE id::text = $1 LIMIT 1`, [value]);
  if (byId.rows?.[0]) return byId.rows[0];

  const byKey = await query(`SELECT * FROM roles WHERE key = $1 LIMIT 1`, [
    value.toLowerCase(),
  ]);
  return byKey.rows?.[0] || null;
}

export async function createRole(input = {}) {
  const key = normalizeKey(input.key || input.name);
  const name = String(input.name || "").trim();
  if (!key) {
    return { error: "Role key is required.", status: 400 };
  }
  if (!name) {
    return { error: "Role name is required.", status: 400 };
  }

  const existing = await query(`SELECT id FROM roles WHERE key = $1 LIMIT 1`, [key]);
  if (existing.rows?.[0]) {
    return { error: "Role key already exists.", status: 409 };
  }

  let parentRoleId = null;
  if (input.parent_role_id) {
    const parent = await findRoleByIdentifier(input.parent_role_id);
    if (!parent) return { error: "Parent role was not found.", status: 400 };
    parentRoleId = parent.id;
  }

  const result = await query(
    `
    INSERT INTO roles (key, name, description, sort_order, parent_role_id, is_system, is_critical, legacy_role)
    VALUES ($1, $2, $3, $4, $5, false, false, NULL)
    RETURNING *
    `,
    [
      key,
      name,
      String(input.description || "").trim() || null,
      Number(input.sort_order || 0),
      parentRoleId,
    ],
  );

  return { data: result.rows?.[0] || null };
}

export async function updateRole(identifier, input = {}) {
  const existing = await findRoleByIdentifier(identifier);
  if (!existing) return { error: "Role not found.", status: 404 };

  const nextName = String(input.name || existing.name || "").trim();
  if (!nextName) return { error: "Role name is required.", status: 400 };

  let nextKey = existing.key;
  if (!existing.is_system && input.key) {
    const proposedKey = normalizeKey(input.key);
    if (!proposedKey) return { error: "Role key is invalid.", status: 400 };
    const duplicate = await query(
      `SELECT id FROM roles WHERE key = $1 AND id <> $2 LIMIT 1`,
      [proposedKey, existing.id],
    );
    if (duplicate.rows?.[0]) {
      return { error: "Role key already exists.", status: 409 };
    }
    nextKey = proposedKey;
  }

  let parentRoleId = existing.parent_role_id || null;
  if (Object.prototype.hasOwnProperty.call(input, "parent_role_id")) {
    if (!input.parent_role_id) {
      parentRoleId = null;
    } else {
      const parent = await findRoleByIdentifier(input.parent_role_id);
      if (!parent) return { error: "Parent role was not found.", status: 400 };
      if (parent.id === existing.id) {
        return { error: "Role cannot be its own parent.", status: 400 };
      }
      parentRoleId = parent.id;
    }
  }

  const result = await query(
    `
    UPDATE roles
    SET
      key = $2,
      name = $3,
      description = $4,
      sort_order = $5,
      parent_role_id = $6,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      existing.id,
      nextKey,
      nextName,
      Object.prototype.hasOwnProperty.call(input, "description")
        ? String(input.description || "").trim() || null
        : existing.description || null,
      Object.prototype.hasOwnProperty.call(input, "sort_order")
        ? Number(input.sort_order || 0)
        : Number(existing.sort_order || 0),
      parentRoleId,
    ],
  );

  return { data: result.rows?.[0] || null };
}

export async function deleteRole(identifier) {
  const existing = await findRoleByIdentifier(identifier);
  if (!existing) return { error: "Role not found.", status: 404 };
  if (existing.is_critical) {
    return { error: "Critical roles cannot be deleted.", status: 409 };
  }

  const usage = await query(
    `SELECT COUNT(*)::int AS count FROM user_roles WHERE role_id = $1`,
    [existing.id],
  );
  if (Number(usage.rows?.[0]?.count || 0) > 0) {
    return {
      error: "Role is currently assigned to one or more users.",
      status: 409,
    };
  }

  await query(`DELETE FROM roles WHERE id = $1`, [existing.id]);
  return { data: { id: existing.id, key: existing.key, deleted: true } };
}

export async function setRolePermissions(identifier, permissionKeys = []) {
  const role = await findRoleByIdentifier(identifier);
  if (!role) return { error: "Role not found.", status: 404 };

  const normalizedPermissionKeys = normalizeUniqueList(permissionKeys);
  const permissionRows = await query(
    `
    SELECT id, key, is_critical
    FROM permissions
    WHERE key = ANY($1::text[])
    `,
    [normalizedPermissionKeys],
  );

  const foundKeys = new Set(
    (permissionRows.rows || []).map((row) =>
      String(row?.key || "").trim().toLowerCase(),
    ),
  );

  const missing = normalizedPermissionKeys.filter((key) => !foundKeys.has(key));
  if (missing.length > 0) {
    return {
      error: `Unknown permission key(s): ${missing.join(", ")}`,
      status: 400,
    };
  }

  if (role.is_critical) {
    const mustHave = new Set(["admin.controls.manage", "admin.rbac.manage"]);
    for (const key of mustHave) {
      if (!foundKeys.has(key)) {
        return {
          error: `Critical role must include '${key}'.`,
          status: 400,
        };
      }
    }
  }

  await query(`DELETE FROM role_permissions WHERE role_id = $1`, [role.id]);

  for (const row of permissionRows.rows || []) {
    await query(
      `
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES ($1, $2)
      ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [role.id, row.id],
    );
  }

  if (String(role.key || "").trim().toLowerCase() === "admin") {
    const criticalPermissions = await query(
      `SELECT id FROM permissions WHERE key IN ('admin.controls.manage', 'admin.rbac.manage')`,
    );
    for (const row of criticalPermissions.rows || []) {
      await query(
        `
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT (role_id, permission_id) DO NOTHING
        `,
        [role.id, row.id],
      );
    }
  }

  return { data: { role_id: role.id, role_key: role.key } };
}

export async function listUsersWithRoles({ search = "", limit = 500 } = {}) {
  const keyword = String(search || "").trim().toLowerCase();
  const safeLimit = Math.min(1000, Math.max(1, Number(limit || 500) || 500));

  const result = await query(
    `
    SELECT
      u.id,
      u.full_name,
      u.email,
      u.role,
      u.is_active,
      u.created_at,
      COALESCE(
        JSON_AGG(
          DISTINCT JSONB_BUILD_OBJECT(
            'id', r.id,
            'key', r.key,
            'name', r.name,
            'is_system', r.is_system,
            'is_critical', r.is_critical,
            'sort_order', r.sort_order
          )
        ) FILTER (WHERE r.id IS NOT NULL),
        '[]'::json
      ) AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE
      $1 = '' OR
      LOWER(u.full_name) LIKE ('%' || $1 || '%') OR
      LOWER(u.email) LIKE ('%' || $1 || '%')
    GROUP BY u.id
    ORDER BY u.full_name ASC, u.email ASC
    LIMIT $2
    `,
    [keyword, safeLimit],
  );

  return (result.rows || []).map((row) => ({
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    is_active: row.is_active !== false,
    created_at: row.created_at || null,
    roles: Array.isArray(row.roles)
      ? row.roles
      : typeof row.roles === "string"
        ? JSON.parse(row.roles || "[]")
        : [],
  }));
}

export async function setUserRoles({
  userId,
  roleIds = [],
  roleKeys = [],
}) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return { error: "User id is required.", status: 400 };
  }

  const userResult = await query(
    `SELECT id, role FROM users WHERE id = $1 LIMIT 1`,
    [normalizedUserId],
  );
  const user = userResult.rows?.[0] || null;
  if (!user) return { error: "User not found.", status: 404 };

  const normalizedRoleIds = normalizeUniqueList(roleIds);
  const normalizedRoleKeys = normalizeUniqueList(roleKeys);

  let targetRoles = [];
  if (normalizedRoleIds.length > 0) {
    const byId = await query(
      `SELECT id, key FROM roles WHERE id::text = ANY($1::text[])`,
      [normalizedRoleIds],
    );
    targetRoles = byId.rows || [];
  }
  if (normalizedRoleKeys.length > 0) {
    const byKey = await query(`SELECT id, key FROM roles WHERE key = ANY($1::text[])`, [
      normalizedRoleKeys,
    ]);
    const seen = new Set(targetRoles.map((row) => String(row.id)));
    for (const row of byKey.rows || []) {
      if (seen.has(String(row.id))) continue;
      targetRoles.push(row);
      seen.add(String(row.id));
    }
  }

  const expectedTotal = normalizedRoleIds.length + normalizedRoleKeys.length;
  if (expectedTotal > 0 && targetRoles.length === 0) {
    return { error: "No valid roles were provided.", status: 400 };
  }

  const keys = new Set(targetRoles.map((row) => String(row.key || "").toLowerCase()));
  if (!keys.has("admin") && keys.size === 0) {
    return { error: "At least one role must be assigned.", status: 400 };
  }

  await query(`DELETE FROM user_roles WHERE user_id = $1`, [normalizedUserId]);

  for (const role of targetRoles) {
    await query(
      `
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      [normalizedUserId, role.id],
    );
  }

  const nextLegacyRole = deriveLegacyRoleFromAssignedRoles(
    targetRoles.map((role) => ({ key: role.key })),
    user.role,
  );
  await query(`UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1`, [
    normalizedUserId,
    nextLegacyRole,
  ]);

  const context = await getUserAuthContext(normalizedUserId, nextLegacyRole);
  return {
    data: {
      user_id: normalizedUserId,
      roles: context.roles,
      permissions: context.permissions,
      role: nextLegacyRole,
    },
  };
}

export async function getUserAuthContext(userId, fallbackRole = "student") {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return { roles: [], permissions: [], legacy_role: "student" };
  }

  const roleResult = await query(
    `
    SELECT r.id, r.key, r.name, r.sort_order
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = $1
    ORDER BY r.sort_order DESC, r.name ASC
    `,
    [normalizedUserId],
  );

  const roleRows = roleResult.rows || [];
  const roles = roleRows.map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    sort_order: Number(row.sort_order || 0),
  }));

  const permissionResult = await query(
    `
    SELECT DISTINCT p.key
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = $1
    ORDER BY p.key ASC
    `,
    [normalizedUserId],
  );

  const permissions = (permissionResult.rows || [])
    .map((row) => String(row?.key || "").trim())
    .filter(Boolean);

  const legacy_role = deriveLegacyRoleFromAssignedRoles(roleRows, fallbackRole);

  return {
    roles,
    permissions,
    legacy_role,
  };
}

export function userHasPermission(user, permission) {
  const permissionKey = String(permission || "").trim();
  if (!permissionKey) return true;
  const userPermissions = new Set(
    (Array.isArray(user?.permissions) ? user.permissions : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );
  if (userPermissions.has(permissionKey)) return true;

  const legacyRole = String(user?.role || "").trim().toLowerCase();
  const fallback = DEFAULT_ROLE_PERMISSION_MAP[legacyRole] || [];
  return fallback.includes(permissionKey);
}

export async function saveRolePermissionMap(map = {}) {
  const roleMap = map && typeof map === "object" ? map : {};
  for (const [roleKey, permissions] of Object.entries(roleMap)) {
    await setRolePermissions(String(roleKey || "").trim().toLowerCase(), permissions);
  }
  return listRolePermissionMap();
}

export async function resetRolePermissionMapToDefaults() {
  const roleIdMap = await getRoleIdMapByKey();
  const permissionIdMap = await getPermissionIdMapByKey();

  for (const [roleKey, defaultPermissionKeys] of Object.entries(
    DEFAULT_ROLE_PERMISSION_MAP,
  )) {
    const roleId = roleIdMap.get(String(roleKey || "").toLowerCase());
    if (!roleId) continue;

    await query(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);

    const keys =
      roleKey === "admin"
        ? Array.from(permissionIdMap.keys())
        : normalizeUniqueList(defaultPermissionKeys);

    for (const permissionKey of keys) {
      const permissionId = permissionIdMap.get(permissionKey);
      if (!permissionId) continue;
      await query(
        `
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT (role_id, permission_id) DO NOTHING
        `,
        [roleId, permissionId],
      );
    }
  }

  return listRolePermissionMap();
}
