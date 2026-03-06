import { apiFetch } from "@/shared/api/httpClient";

export async function fetchAffiliateRegistry() {
  return apiFetch("/admin/affiliates");
}

export async function updateAffiliateProfile(userId, payload) {
  return apiFetch(`/admin/affiliates/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

