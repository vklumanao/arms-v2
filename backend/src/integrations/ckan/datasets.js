import { ckanAction } from "./http/ckanAction.js";
import { toText } from "./utils/normalize.js";

export async function listDatasets({
  orgId = "",
  q = "",
  page = 1,
  limit = 100,
} = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const safePage = Math.max(1, Number(page) || 1);
  const start = (safePage - 1) * safeLimit;
  const fqParts = [];
  const cleanOrgId = String(orgId || "").trim();
  if (cleanOrgId) fqParts.push(`organization:${cleanOrgId}`);

  const result = await ckanAction("package_search", {
    q: String(q || "").trim() || "*:*",
    fq: fqParts.join(" AND "),
    include_private: true,
    rows: safeLimit,
    start,
    sort: "metadata_modified desc",
  });

  return {
    count: Number(result?.count || 0),
    datasets: Array.isArray(result?.results) ? result.results : [],
    page: safePage,
    limit: safeLimit,
  };
}

export async function createDataset(payload) {
  return ckanAction("package_create", payload || {});
}

export async function updateDataset(payload) {
  return ckanAction("package_update", payload || {});
}

export async function deleteDataset(datasetId) {
  const id = toText(datasetId);
  if (!id) return;
  await ckanAction("package_delete", { id });
}

export async function createDatasetResource(payload) {
  return ckanAction("resource_create", payload || {});
}
