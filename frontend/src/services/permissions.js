import { apiFetch } from "@/services/httpClient";

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  AFFILIATE_PROFILE_VIEW: "affiliate_profile.view",
  PROJECTS_VIEW: "projects.view",
  PROJECTS_CREATE: "projects.create",
  PROJECTS_EDIT: "projects.edit",
  PROJECTS_DELETE: "projects.delete",
  OUTPUTS_VIEW: "outputs.view",
  OUTPUTS_CREATE: "outputs.create",
  OUTPUTS_EDIT: "outputs.edit",
  OUTPUTS_DELETE: "outputs.delete",
  AWARDS_VIEW: "awards.view",
  AWARDS_CREATE: "awards.create",
  AWARDS_EDIT: "awards.edit",
  AWARDS_DELETE: "awards.delete",
  AFFILIATES_VIEW: "affiliates.view",
  AFFILIATES_EDIT: "affiliates.edit",
  ADMIN_CONTROLS_MANAGE: "admin.controls.manage",
  ADMIN_USERS_MANAGE: "admin.users.manage",
  ADMIN_AFFILIATES_MANAGE: "admin.affiliates.manage",
  ADMIN_RBAC_MANAGE: "admin.rbac.manage",
  // Backward-compatible aliases for legacy checks.
  AFFILIATIONS_MANAGE: "affiliations.manage",
  RESEARCH_OUTPUTS_VIEW: "research_outputs.view",
  AWARDS_RECOGNITION_VIEW: "awards_recognition.view",
};

export const PERMISSION_LABELS = {
  [PERMISSIONS.DASHBOARD_VIEW]: "Dashboard: View",
  [PERMISSIONS.AFFILIATE_PROFILE_VIEW]: "My Profile: View",
  [PERMISSIONS.PROJECTS_VIEW]: "Research Projects: View",
  [PERMISSIONS.PROJECTS_CREATE]: "Research Projects: Create",
  [PERMISSIONS.PROJECTS_EDIT]: "Research Projects: Edit",
  [PERMISSIONS.PROJECTS_DELETE]: "Research Projects: Delete",
  [PERMISSIONS.OUTPUTS_VIEW]: "Research Outputs: View",
  [PERMISSIONS.OUTPUTS_CREATE]: "Research Outputs: Create",
  [PERMISSIONS.OUTPUTS_EDIT]: "Research Outputs: Edit",
  [PERMISSIONS.OUTPUTS_DELETE]: "Research Outputs: Delete",
  [PERMISSIONS.AWARDS_VIEW]: "Awards and Recognition: View",
  [PERMISSIONS.AWARDS_CREATE]: "Awards and Recognition: Create",
  [PERMISSIONS.AWARDS_EDIT]: "Awards and Recognition: Edit",
  [PERMISSIONS.AWARDS_DELETE]: "Awards and Recognition: Delete",
  [PERMISSIONS.AFFILIATES_VIEW]: "Affiliates: View",
  [PERMISSIONS.AFFILIATES_EDIT]: "Affiliates: Edit",
  [PERMISSIONS.AFFILIATIONS_MANAGE]: "Affiliations: Manage",
  [PERMISSIONS.RESEARCH_OUTPUTS_VIEW]: "Research Outputs: View",
  [PERMISSIONS.AWARDS_RECOGNITION_VIEW]: "Awards and Recognition: View",
  [PERMISSIONS.ADMIN_CONTROLS_MANAGE]: "Admin Controls: Manage",
  [PERMISSIONS.ADMIN_USERS_MANAGE]: "Admin Users: Manage",
  [PERMISSIONS.ADMIN_AFFILIATES_MANAGE]: "Admin Affiliates: Manage",
  [PERMISSIONS.ADMIN_RBAC_MANAGE]: "Access Control (RBAC): Manage",
};

export const ROLE_LABELS = {
  student: "Student",
  faculty: "Faculty",
  admin: "Admin",
};

const STUDENT_PERMISSIONS = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.AFFILIATE_PROFILE_VIEW,
  PERMISSIONS.PROJECTS_VIEW,
  PERMISSIONS.PROJECTS_CREATE,
  PERMISSIONS.PROJECTS_EDIT,
  PERMISSIONS.OUTPUTS_VIEW,
  PERMISSIONS.OUTPUTS_CREATE,
  PERMISSIONS.OUTPUTS_EDIT,
  PERMISSIONS.AWARDS_VIEW,
  PERMISSIONS.AWARDS_CREATE,
  PERMISSIONS.AWARDS_EDIT,
  PERMISSIONS.AFFILIATIONS_MANAGE,
  PERMISSIONS.RESEARCH_OUTPUTS_VIEW,
  PERMISSIONS.AWARDS_RECOGNITION_VIEW,
];

const FACULTY_PERMISSIONS = [...STUDENT_PERMISSIONS];

const ADMIN_PERMISSIONS = [
  ...new Set([
    ...STUDENT_PERMISSIONS,
    PERMISSIONS.ADMIN_CONTROLS_MANAGE,
    PERMISSIONS.ADMIN_USERS_MANAGE,
    PERMISSIONS.ADMIN_AFFILIATES_MANAGE,
    PERMISSIONS.ADMIN_RBAC_MANAGE,
    PERMISSIONS.AFFILIATES_VIEW,
    PERMISSIONS.AFFILIATES_EDIT,
    PERMISSIONS.PROJECTS_DELETE,
    PERMISSIONS.OUTPUTS_DELETE,
    PERMISSIONS.AWARDS_DELETE,
  ]),
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
  const source = roleMap && typeof roleMap === "object" ? roleMap : {};
  return Object.keys(source).reduce((acc, role) => {
    acc[role] = [...(source[role] || [])];
    return acc;
  }, {});
}

function normalizePermissionList(list) {
  return [
    ...new Set(
      (Array.isArray(list) ? list : [])
        .map((permission) => String(permission || "").trim())
        .filter(Boolean),
    ),
  ];
}

function normalizeRolePermissionMap(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const roles = [
    ...new Set([...Object.keys(ROLE_PERMISSIONS), ...Object.keys(input)]),
  ];
  const next = {};

  roles.forEach((role) => {
    const key = String(role || "")
      .trim()
      .toLowerCase();
    if (!key) return;
    const fallback = ROLE_PERMISSIONS[key] || [];
    next[key] = normalizePermissionList(input?.[key] || fallback);
  });

  if (!Array.isArray(next.admin)) next.admin = [];
  if (!next.admin.includes(PERMISSIONS.ADMIN_CONTROLS_MANAGE)) {
    next.admin.push(PERMISSIONS.ADMIN_CONTROLS_MANAGE);
  }
  if (!next.admin.includes(PERMISSIONS.ADMIN_RBAC_MANAGE)) {
    next.admin.push(PERMISSIONS.ADMIN_RBAC_MANAGE);
  }

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

export function getPermissionsForRoles(roles) {
  const values = Array.isArray(roles) ? roles : [roles];
  const set = new Set();
  values.forEach((role) => {
    getPermissionsForRole(role).forEach((permission) => set.add(permission));
  });
  return Array.from(set);
}

export function hasPermission(roleOrRoles, permission, directPermissions = []) {
  if (!permission) return true;
  const directSet = new Set(
    (Array.isArray(directPermissions) ? directPermissions : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );
  if (directSet.has(permission)) return true;
  const permissions = getPermissionsForRoles(roleOrRoles);
  return permissions.includes(permission);
}

export function getRolePermissionMap() {
  return cloneRoleMap(rolePermissionCache);
}

export async function syncRolePermissionMapFromServer() {
  if (!isBrowser()) return getRolePermissionMap();
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    const payload = await apiFetch("/permissions/role-map", {
      allowUnauthorized: true,
    });
    const nextMap = normalizeRolePermissionMap(payload?.map || {});
    const hasAny = Object.values(nextMap).some(
      (permissions) => Array.isArray(permissions) && permissions.length > 0,
    );
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
  const payload = await apiFetch("/permissions/role-map", {
    method: "PUT",
    body: JSON.stringify({
      map: normalized,
    }),
  });
  setRolePermissionCache(payload?.map || normalized);
  return getRolePermissionMap();
}

export async function resetRolePermissionMapToDefaults() {
  const payload = await apiFetch("/permissions/role-map/reset", {
    method: "POST",
  });
  setRolePermissionCache(payload?.map || ROLE_PERMISSIONS);
  return getRolePermissionMap();
}
