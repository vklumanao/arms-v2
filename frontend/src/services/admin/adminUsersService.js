import { apiFetch } from "@/services/httpClient";
import { requestPasswordReset } from "@/services/authApi";

export async function fetchAdminUsers() {
  const payload = await apiFetch("/admin/users");
  return payload?.data || [];
}

export async function fetchAdminUserRoleOptions(search = "") {
  const query = new URLSearchParams();
  if (String(search || "").trim()) query.set("search", String(search).trim());
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const payload = await apiFetch(`/admin/users/role-options${suffix}`);
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function createAdminUser(payload) {
  const result = await apiFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
  return result?.data || null;
}

export async function updateAdminUserRole(userId, role) {
  const payload = await apiFetch(`/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
  return payload?.data || null;
}

export async function updateAdminUserStatus(userId, isActive) {
  const payload = await apiFetch(`/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
  return payload?.data || null;
}

export async function fetchAdminUserDetail(userId) {
  return apiFetch(`/admin/users/${userId}/detail`);
}

export async function sendAdminPasswordReset(email) {
  await requestPasswordReset(email);
}

export async function resendAdminUserInvite(userId) {
  await apiFetch(`/admin/users/${userId}/resend-invite`, {
    method: "POST",
  });
}
