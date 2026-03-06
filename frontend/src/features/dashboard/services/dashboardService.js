import { apiFetch } from "@/shared/api/httpClient";

export async function fetchDashboardProjects({ userId, role } = {}) {
  void userId;
  void role;
  try {
    const payload = await apiFetch("/dashboard/projects");
    return { data: payload?.data || [], error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function fetchDashboardProjectStatusHistory({ projectIds = [] }) {
  if (!projectIds.length) {
    return { data: [], error: null };
  }

  try {
    const query = new URLSearchParams({
      projectIds: projectIds.join(","),
    });
    const payload = await apiFetch(
      `/dashboard/status-history?${query.toString()}`,
    );
    return { data: payload?.data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
}

export async function notifyDashboardUpcomingDeadlines({ days = 14 } = {}) {
  try {
    const payload = await apiFetch("/dashboard/notify-upcoming-deadlines", {
      method: "POST",
      body: JSON.stringify({ days }),
    });
    return { data: payload?.data ?? null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}
