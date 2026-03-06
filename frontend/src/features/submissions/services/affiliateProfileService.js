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
    await apiFetch("/affiliate-profile/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return { error: null };
  } catch (error) {
    return { error };
  }
}

