import { query } from "../../db/client.js";

function asTrimmedString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeRole(role) {
  const value = String(role || "student").trim().toLowerCase();
  if (value === "admin") return "admin";
  if (value === "faculty") return "faculty";
  return "student";
}

function roleToCkanOrgRole(role) {
  const normalized = normalizeRole(role);
  if (normalized === "admin") return "admin";
  if (normalized === "faculty") return "editor";
  return "member";
}

function getExtraByKey(extras, key) {
  const rows = Array.isArray(extras) ? extras : [];
  const match = rows.find(
    (item) =>
      String(item?.key || "")
        .trim()
        .toLowerCase() ===
      String(key || "")
        .trim()
        .toLowerCase(),
  );
  return match?.value ?? null;
}

function isDatasetOwnedByUser(dataset, user) {
  const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
  const submittedByUserId = asTrimmedString(
    getExtraByKey(extras, "submitted_by_user_id"),
  );
  const submittedByEmail = asTrimmedString(
    getExtraByKey(extras, "submitted_by_email"),
  ).toLowerCase();
  const submittedBy = asTrimmedString(getExtraByKey(extras, "submitted_by"));
  const userId = asTrimmedString(user?.id);
  const userEmail = asTrimmedString(user?.email).toLowerCase();

  if (submittedByUserId && userId && submittedByUserId === userId) return true;
  if (submittedByEmail && userEmail && submittedByEmail === userEmail) {
    return true;
  }
  if (submittedBy && userId && submittedBy === userId) return true;
  if (
    asTrimmedString(dataset?.author_email).toLowerCase() === userEmail &&
    userEmail
  ) {
    return true;
  }
  return false;
}

async function getActiveAdminCount() {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND is_active = TRUE`,
  );
  return Number(result.rows?.[0]?.count || 0);
}

async function findUserByIdRaw(userId) {
  const result = await query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [
    String(userId || ""),
  ]);
  return result.rows?.[0] || null;
}

function toAdminUserRow(row) {
  return {
    id: row.id,
    full_name: row.full_name || null,
    email: row.email || null,
    role: row.role || "student",
    department: row.department || null,
    ckan_org_id: row.ckan_org_id || null,
    ckan_group_id: row.ckan_group_id || null,
    ckan_username: row.ckan_username || null,
    ckan_user_id: row.ckan_user_id || null,
    is_active: row.is_active !== false,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    last_sign_in_at: null,
    email_confirmed_at: null,
  };
}

export async function listAdminUsers() {
  const result = await query(
    `
    SELECT
      id,
      full_name,
      email,
      role,
      department,
      ckan_org_id,
      ckan_group_id,
      ckan_username,
      ckan_user_id,
      is_active,
      created_at,
      updated_at
    FROM users
    ORDER BY created_at DESC, email ASC
    `,
  );
  return (result.rows || []).map(toAdminUserRow);
}

async function listOwnedDatasetsForUser(user, listDatasets) {
  const role = String(user?.role || "").toLowerCase();
  const orgId =
    role === "admin" ? "" : asTrimmedString(user?.ckan_org_id || "");
  if (role !== "admin" && !orgId) return [];

  const rows = [];
  const limit = 100;
  let page = 1;

  while (page <= 20) {
    const result = await listDatasets({ orgId, page, limit });
    const datasets = Array.isArray(result?.datasets) ? result.datasets : [];
    if (!datasets.length) break;

    rows.push(...datasets.filter((dataset) => isDatasetOwnedByUser(dataset, user)));
    const total = Number(result?.count || 0);
    if (datasets.length < limit || (page * limit >= total && total > 0)) break;
    page += 1;
  }

  return rows;
}

async function loadRoleAudit(userId) {
  const result = await query(
    `
    SELECT id, actor_user_id, event_type, details, created_at
    FROM audit_logs
    WHERE
      event_type IN ('admin.user.role_updated')
      AND COALESCE(details->>'target_user_id', '') = $1
    ORDER BY created_at DESC
    LIMIT 100
    `,
    [String(userId || "")],
  );

  const rows = result.rows || [];
  const actorIds = [
    ...new Set(
      rows
        .map((row) => (row?.actor_user_id ? String(row.actor_user_id) : ""))
        .filter(Boolean),
    ),
  ];
  const roleAuditActorMap = {};
  if (actorIds.length > 0) {
    const namesResult = await query(
      `
      SELECT id, full_name, email
      FROM users
      WHERE id = ANY($1::uuid[])
      `,
      [actorIds],
    );
    for (const row of namesResult.rows || []) {
      roleAuditActorMap[row.id] = row.full_name || row.email || row.id;
    }
  }

  const roleAudit = rows.map((row) => ({
    id: row.id,
    old_role: row?.details?.old_role || null,
    new_role: row?.details?.new_role || null,
    changed_by: row.actor_user_id || null,
    changed_at: row.created_at || null,
  }));

  return { roleAudit, roleAuditActorMap };
}

export async function getAdminUserDetail(userId, { listDatasets }) {
  const user = await findUserByIdRaw(userId);
  if (!user) return null;

  const datasets = await listOwnedDatasetsForUser(user, listDatasets);
  const statusCounts = {
    proposal: 0,
    ongoing: 0,
    completed: 0,
    rejected: 0,
  };
  const projects = [];

  for (const dataset of datasets) {
    const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
    const status = String(
      getExtraByKey(extras, "project_status") ||
        getExtraByKey(extras, "status") ||
        "proposal",
    )
      .trim()
      .toLowerCase();

    if (statusCounts[status] == null) {
      statusCounts.proposal += 1;
    } else {
      statusCounts[status] += 1;
    }

    projects.push({
      id: dataset?.id || dataset?.name || null,
      title: dataset?.title || dataset?.name || "Untitled project",
      status,
      updated_at: dataset?.metadata_modified || dataset?.metadata_created || null,
    });
  }

  projects.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  const currentProjectsCount = statusCounts.proposal + statusCounts.ongoing;

  const { roleAudit, roleAuditActorMap } = await loadRoleAudit(user.id);

  return {
    user: toAdminUserRow(user),
    detail: {
      submissionsCount: datasets.length,
      currentProjectsCount,
      statusCounts,
      projects: projects.slice(0, 15),
      statusHistory: [],
      roleAudit,
      roleAuditActorMap,
    },
  };
}

export async function updateAdminUserRole(
  { actorUserId, targetUserId, role },
  { updateUser, setOrganizationMemberRole, logAuditEvent },
) {
  const target = await findUserByIdRaw(targetUserId);
  if (!target) return { error: "User not found.", status: 404 };

  const nextRole = normalizeRole(role);
  const currentRole = normalizeRole(target.role);
  if (nextRole === currentRole) {
    return { data: toAdminUserRow(target) };
  }

  if (currentRole === "admin" && nextRole !== "admin" && target.is_active) {
    const activeAdminCount = await getActiveAdminCount();
    if (activeAdminCount <= 1) {
      return {
        error: "Cannot remove the last active admin account.",
        status: 400,
      };
    }
  }

  let ckanSyncError = null;
  const orgId = asTrimmedString(target.ckan_org_id);
  const username = asTrimmedString(target.ckan_username);
  if (orgId && username) {
    try {
      await setOrganizationMemberRole({
        orgId,
        username,
        role: roleToCkanOrgRole(nextRole),
      });
    } catch (error) {
      ckanSyncError = String(error?.message || "CKAN role sync failed.");
    }
  }

  const updated = await updateUser(target.id, { role: nextRole });
  await logAuditEvent({
    actorUserId,
    eventType: "admin.user.role_updated",
    details: {
      target_user_id: target.id,
      target_email: target.email,
      old_role: currentRole,
      new_role: nextRole,
      ckan_sync_ok: !ckanSyncError,
      ckan_sync_error: ckanSyncError,
    },
  });

  return { data: toAdminUserRow(updated || target) };
}

export async function updateAdminUserStatus(
  { actorUserId, targetUserId, isActive },
  { updateUser, logAuditEvent },
) {
  const target = await findUserByIdRaw(targetUserId);
  if (!target) return { error: "User not found.", status: 404 };

  const nextActive = Boolean(isActive);
  const currentActive = target.is_active !== false;
  if (nextActive === currentActive) {
    return { data: toAdminUserRow(target) };
  }

  if (target.role === "admin" && !nextActive) {
    const activeAdminCount = await getActiveAdminCount();
    if (activeAdminCount <= 1) {
      return {
        error: "Cannot deactivate the last active admin account.",
        status: 400,
      };
    }
  }

  if (String(actorUserId || "") === String(target.id || "") && !nextActive) {
    return {
      error: "You cannot deactivate your own account.",
      status: 400,
    };
  }

  const updated = await updateUser(target.id, { is_active: nextActive });
  await logAuditEvent({
    actorUserId,
    eventType: "admin.user.status_updated",
    details: {
      target_user_id: target.id,
      target_email: target.email,
      old_is_active: currentActive,
      new_is_active: nextActive,
    },
  });

  return { data: toAdminUserRow(updated || target) };
}
