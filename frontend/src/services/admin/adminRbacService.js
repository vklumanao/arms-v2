import { apiFetch } from "@/services/httpClient";

export async function fetchRoles(search = "") {
  const query = new URLSearchParams();
  if (String(search || "").trim()) query.set("search", String(search).trim());
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const payload = await apiFetch(`/roles${suffix}`);
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function fetchPermissions(filters = {}) {
  const query = new URLSearchParams();
  const search = String(filters?.search || "").trim();
  const module = String(filters?.module || "").trim();
  const action = String(filters?.action || "").trim();
  if (search) query.set("search", search);
  if (module) query.set("module", module);
  if (action) query.set("action", action);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const payload = await apiFetch(`/permissions${suffix}`);
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function fetchRolePermissions(roleId) {
  const payload = await apiFetch(
    `/roles/${encodeURIComponent(roleId)}/permissions`,
  );
  return payload?.data || { role_id: roleId, permission_keys: [] };
}

export async function saveRolePermissions(roleId, permissionKeys = []) {
  const payload = await apiFetch(
    `/roles/${encodeURIComponent(roleId)}/permissions`,
    {
      method: "POST",
      body: JSON.stringify({ permission_keys: permissionKeys }),
    },
  );
  return payload?.data || null;
}

export async function createAdminRole(input = {}) {
  const payload = await apiFetch("/admin/rbac/roles", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload?.data || null;
}

export async function updateAdminRole(roleId, input = {}) {
  const payload = await apiFetch(
    `/admin/rbac/roles/${encodeURIComponent(roleId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
  return payload?.data || null;
}

export async function deleteAdminRole(roleId) {
  const payload = await apiFetch(
    `/admin/rbac/roles/${encodeURIComponent(roleId)}`,
    {
      method: "DELETE",
    },
  );
  return payload?.data || null;
}
