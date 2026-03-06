import { apiFetch } from "@/shared/api/httpClient";

export async function fetchCkanOrganizations() {
  return apiFetch("/integrations/ckan/organizations");
}

export async function fetchCkanGroups() {
  return apiFetch("/integrations/ckan/groups");
}

export async function fetchCkanUsers(options = {}) {
  const orgId = String(options?.orgId || "").trim();
  const query = orgId ? `?org_id=${encodeURIComponent(orgId)}` : "";
  try {
    return await apiFetch(`/integrations/ckan/users${query}`);
  } catch {
    const fallback = await apiFetch("/admin/controls/reference-data");
    const users = Array.isArray(fallback?.ckan_users)
      ? fallback.ckan_users
      : [];
    return { data: users };
  }
}

export async function fetchCkanOrganizationAgendas(orgId) {
  const cleanOrgId = String(orgId || "").trim();
  if (!cleanOrgId) return { data: [] };
  return apiFetch(
    `/integrations/ckan/organizations/${encodeURIComponent(cleanOrgId)}/agendas`,
  );
}

export async function fetchCkanDatasets(options = {}) {
  const query = new URLSearchParams();
  if (options?.orgId) query.set("org_id", String(options.orgId).trim());
  if (options?.q) query.set("q", String(options.q).trim());
  if (options?.page) query.set("page", String(options.page));
  if (options?.limit) query.set("limit", String(options.limit));
  const qs = query.toString();
  return apiFetch(`/integrations/ckan/datasets${qs ? `?${qs}` : ""}`);
}

export async function updateCkanDataset(datasetId, payload) {
  const id = String(datasetId || "").trim();
  if (!id) throw new Error("Dataset id is required.");
  return apiFetch(`/integrations/ckan/datasets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload || {}),
  });
}

export async function deleteCkanDataset(datasetId) {
  const id = String(datasetId || "").trim();
  if (!id) throw new Error("Dataset id is required.");
  return apiFetch(`/integrations/ckan/datasets/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

