import { apiFetch } from "@/shared/api/httpClient";

export async function fetchAffiliateProfile() {
  try {
    const payload = await apiFetch("/affiliate-profile/me");
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function updateAffiliateProfile(payload) {
  try {
    const data = await apiFetch("/affiliate-profile/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function changeMyPassword(payload) {
  try {
    const data = await apiFetch("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

