import { apiFetch } from "@/shared/api/httpClient";
import { requestPasswordReset } from "@/shared/api/authApi";

export async function fetchAdminUsers() {
  const payload = await apiFetch("/admin/users");
  return payload?.data || [];
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

