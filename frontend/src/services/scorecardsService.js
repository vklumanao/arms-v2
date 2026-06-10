import { apiFetch } from "@/services/httpClient";

export async function fetchDefaultScorecardTemplate() {
  try {
    const payload = await apiFetch("/scorecards/templates/default");
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function createCenterScorecard({ centerId, year }) {
  try {
    const payload = await apiFetch(
      `/scorecards/centers/${encodeURIComponent(String(centerId || "").trim())}/years/${encodeURIComponent(String(year || "").trim())}`,
      { method: "POST" },
    );
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function fetchCenterScorecard({ centerId, year }) {
  try {
    const payload = await apiFetch(
      `/scorecards/centers/${encodeURIComponent(String(centerId || "").trim())}/years/${encodeURIComponent(String(year || "").trim())}`,
    );
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function updateCenterScorecard({ centerId, year, payload }) {
  try {
    const response = await apiFetch(
      `/scorecards/centers/${encodeURIComponent(String(centerId || "").trim())}/years/${encodeURIComponent(String(year || "").trim())}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload || {}),
      },
    );
    return { data: response?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}
