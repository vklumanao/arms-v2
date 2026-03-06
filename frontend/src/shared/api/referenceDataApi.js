import { apiFetch } from "@/shared/api/httpClient";

export async function fetchReferenceData(options = {}) {
  const orgId = String(options?.orgId || "").trim();
  const query = orgId ? `?org_id=${encodeURIComponent(orgId)}` : "";
  return apiFetch(`/reference-data${query}`);
}

