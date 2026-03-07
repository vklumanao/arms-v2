import { apiFetch } from "@/shared/api/httpClient";

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  AFFILIATE_PROFILE_VIEW: "affiliate_profile.view",
  AFFILIATIONS_MANAGE: "affiliations.manage",
  RESEARCH_OUTPUTS_VIEW: "research_outputs.view",
  AWARDS_RECOGNITION_VIEW: "awards_recognition.view",
  MY_SUBMISSIONS_VIEW: "my_submissions.view",
  PUBLICATIONS_MANAGE: "publications.manage",
  PROGRAM_DASHBOARD_VIEW: "program_dashboard.view",
  ADMIN_REVIEW_QUEUE_MANAGE: "admin.review_queue.manage",
  ADMIN_CONTROLS_MANAGE: "admin.controls.manage",
  ADMIN_USERS_MANAGE: "admin.users.manage",
  ADMIN_AFFILIATES_MANAGE: "admin.affiliates.manage",
  ADMIN_REPORTS_VIEW: "admin.reports.view",
  ADMIN_AUDIT_VIEW: "admin.audit.view",
};

export const PERMISSION_LABELS = {
  [PERMISSIONS.DASHBOARD_VIEW]: "Dashboard: View",
  [PERMISSIONS.AFFILIATE_PROFILE_VIEW]: "Affiliate Profile: View",
  [PERMISSIONS.AFFILIATIONS_MANAGE]: "Affiliations: Manage",
  [PERMISSIONS.RESEARCH_OUTPUTS_VIEW]: "Research Outputs: View",
  [PERMISSIONS.AWARDS_RECOGNITION_VIEW]: "Awards and Recognition: View",
  [PERMISSIONS.MY_SUBMISSIONS_VIEW]: "My Submissions: View",
  [PERMISSIONS.PUBLICATIONS_MANAGE]: "Publications: Manage",
  [PERMISSIONS.PROGRAM_DASHBOARD_VIEW]: "Program Dashboards: View",
  [PERMISSIONS.ADMIN_REVIEW_QUEUE_MANAGE]: "Admin Review Queue: Manage",
  [PERMISSIONS.ADMIN_CONTROLS_MANAGE]: "Admin Controls: Manage",
  [PERMISSIONS.ADMIN_USERS_MANAGE]: "Admin Users: Manage",
  [PERMISSIONS.ADMIN_AFFILIATES_MANAGE]: "Admin Affiliates: Manage",
  [PERMISSIONS.ADMIN_REPORTS_VIEW]: "Admin Reports: View",
  [PERMISSIONS.ADMIN_AUDIT_VIEW]: "Admin Audit: View",
};

export const ROLE_LABELS = {
  student: "Student",
  faculty: "Faculty",
  admin: "Admin",
};

const STUDENT_PERMISSIONS = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.AFFILIATE_PROFILE_VIEW,
  PERMISSIONS.AFFILIATIONS_MANAGE,
  PERMISSIONS.RESEARCH_OUTPUTS_VIEW,
  PERMISSIONS.AWARDS_RECOGNITION_VIEW,
  PERMISSIONS.MY_SUBMISSIONS_VIEW,
  PERMISSIONS.PUBLICATIONS_MANAGE,
  PERMISSIONS.PROGRAM_DASHBOARD_VIEW,
];

const FACULTY_PERMISSIONS = [...STUDENT_PERMISSIONS];

const ADMIN_PERMISSIONS = [
  ...STUDENT_PERMISSIONS,
  PERMISSIONS.ADMIN_REVIEW_QUEUE_MANAGE,
  PERMISSIONS.ADMIN_CONTROLS_MANAGE,
  PERMISSIONS.ADMIN_USERS_MANAGE,
  PERMISSIONS.ADMIN_AFFILIATES_MANAGE,
  PERMISSIONS.ADMIN_REPORTS_VIEW,
  PERMISSIONS.ADMIN_AUDIT_VIEW,
];

export const ROLE_PERMISSIONS = {
  student: STUDENT_PERMISSIONS,
  faculty: FACULTY_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
};

export const PERMISSIONS_UPDATED_EVENT = "arms:permissions-updated";

function isBrowser() {
  return typeof window !== "undefined";
}

function cloneRoleMap(roleMap) {
  return Object.keys(ROLE_PERMISSIONS).reduce((acc, role) => {
    acc[role] = [...(roleMap[role] || [])];
    return acc;
  }, {});
}

function normalizePermissionList(list) {
  const validPermissions = new Set(Object.values(PERMISSIONS));
  return [
    ...new Set(
      (list || []).filter(
        (permission) =>
          typeof permission === "string" && validPermissions.has(permission),
      ),
    ),
  ];
}

function normalizeRolePermissionMap(raw) {
  const next = {};
  Object.keys(ROLE_PERMISSIONS).forEach((role) => {
    next[role] = normalizePermissionList(raw?.[role] || []);
  });
  return next;
}

function emitPermissionsUpdated() {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(PERMISSIONS_UPDATED_EVENT));
}

let rolePermissionCache = cloneRoleMap(ROLE_PERMISSIONS);
let syncPromise = null;

function setRolePermissionCache(nextMap, emitEvent = true) {
  rolePermissionCache = normalizeRolePermissionMap(nextMap);
  if (emitEvent) emitPermissionsUpdated();
}

export function getPermissionsForRole(role) {
  const normalizedRole = String(role || "").toLowerCase();
  return rolePermissionCache[normalizedRole] || [];
}

export function hasPermission(role, permission) {
  if (!permission) return true;
  return getPermissionsForRole(role).includes(permission);
}

export function getRolePermissionMap() {
  return cloneRoleMap(rolePermissionCache);
}

export async function syncRolePermissionMapFromServer() {
  if (!isBrowser()) return getRolePermissionMap();
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    const payload = await apiFetch("/permissions/role-map");
    const nextMap = normalizeRolePermissionMap(payload?.map || {});
    const hasAny =
      nextMap.student.length > 0 ||
      nextMap.faculty.length > 0 ||
      nextMap.admin.length > 0;
    setRolePermissionCache(hasAny ? nextMap : ROLE_PERMISSIONS);
    return getRolePermissionMap();
  })();

  try {
    return await syncPromise;
  } finally {
    syncPromise = null;
  }
}

export async function saveRolePermissionMap(nextMap) {
  const normalized = normalizeRolePermissionMap(nextMap);
  await apiFetch("/permissions/role-map", {
    method: "PUT",
    body: JSON.stringify({
      map: normalized,
    }),
  });
  setRolePermissionCache(normalized);
  return getRolePermissionMap();
}

export async function resetRolePermissionMapToDefaults() {
  await apiFetch("/permissions/role-map/reset", {
    method: "POST",
  });
  setRolePermissionCache(ROLE_PERMISSIONS);
  return getRolePermissionMap();
}

