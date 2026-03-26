import { apiFetch } from "@/services/httpClient";

function buildQuery(filters = {}) {
  const query = new URLSearchParams();
  const centerId = String(filters?.centerId || "").trim();
  const departmentId = String(filters?.departmentId || "").trim();
  const year = String(filters?.year || "").trim();
  const range = String(filters?.range || "").trim();
  const startDate = String(filters?.startDate || "").trim();
  const endDate = String(filters?.endDate || "").trim();
  const ownerOnly = Boolean(filters?.ownerOnly);

  if (centerId) query.set("centerId", centerId);
  if (departmentId) query.set("departmentId", departmentId);
  if (year) query.set("year", year);
  if (range) query.set("range", range);
  if (startDate) query.set("startDate", startDate);
  if (endDate) query.set("endDate", endDate);
  if (ownerOnly) query.set("ownerOnly", "1");

  return query.toString();
}

async function safeFetch(path) {
  try {
    const payload = await apiFetch(path);
    return { data: payload?.data ?? null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export function fetchDashboardYearOptions() {
  return safeFetch("/dashboard/filters/years");
}

export function fetchDashboardSummary(filters = {}, { limit = 6 } = {}) {
  const query = new URLSearchParams(buildQuery(filters));
  if (limit) query.set("limit", String(limit));
  const queryString = query.toString();
  return safeFetch(`/dashboard/summary${queryString ? `?${queryString}` : ""}`);
}

export function fetchDashboardOverview(filters = {}) {
  const query = buildQuery(filters);
  return safeFetch(`/dashboard/overview${query ? `?${query}` : ""}`);
}

export function fetchDashboardCenterBreakdown(filters = {}) {
  const query = buildQuery(filters);
  return safeFetch(`/dashboard/center-breakdown${query ? `?${query}` : ""}`);
}

export function fetchDashboardProjectsPerCenter(filters = {}) {
  const query = buildQuery(filters);
  return safeFetch(
    `/dashboard/charts/projects-per-center${query ? `?${query}` : ""}`,
  );
}

export function fetchDashboardOutputsByDepartment(filters = {}) {
  const query = buildQuery(filters);
  return safeFetch(
    `/dashboard/charts/outputs-by-department${query ? `?${query}` : ""}`,
  );
}

export function fetchDashboardOutputsOverTime(filters = {}) {
  const query = buildQuery(filters);
  return safeFetch(
    `/dashboard/charts/outputs-over-time${query ? `?${query}` : ""}`,
  );
}

export function fetchDashboardAwardsByCategory(filters = {}) {
  const query = buildQuery(filters);
  return safeFetch(
    `/dashboard/charts/awards-by-category${query ? `?${query}` : ""}`,
  );
}

export function fetchDashboardRecentProjects(filters = {}, { limit = 6 } = {}) {
  const query = new URLSearchParams(buildQuery(filters));
  query.set("limit", String(limit));
  return safeFetch(`/dashboard/recent/projects?${query.toString()}`);
}

export function fetchDashboardRecentOutputs(filters = {}, { limit = 6 } = {}) {
  const query = new URLSearchParams(buildQuery(filters));
  query.set("limit", String(limit));
  return safeFetch(`/dashboard/recent/outputs?${query.toString()}`);
}

export function fetchDashboardRecentAwards(filters = {}, { limit = 6 } = {}) {
  const query = new URLSearchParams(buildQuery(filters));
  query.set("limit", String(limit));
  return safeFetch(`/dashboard/recent/awards?${query.toString()}`);
}
