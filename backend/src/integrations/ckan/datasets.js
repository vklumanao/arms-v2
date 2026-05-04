import { ckanAction, ckanMultipartAction } from "./http/ckanAction.js";
import { toText } from "./utils/normalize.js";

/**
 * Searches CKAN datasets with pagination and optional organization filter.
 *
 * Data transformation:
 * - Sanitizes page/limit to safe bounds.
 * - Builds CKAN filter query (`fq`) when org is provided.
 * - Returns normalized response shape used by route modules.
 */
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

/**
 * Creates CKAN dataset/package.
 */
export async function createDataset(payload) {
  return ckanAction("package_create", payload || {});
}

/**
 * Loads a CKAN dataset/package by id or name.
 *
 * Edge case:
 * - Returns `null` when id is empty.
 */
export async function getDataset(datasetId) {
  const id = toText(datasetId);
  if (!id) return null;
  return ckanAction("package_show", { id });
}

/**
 * Updates CKAN dataset/package.
 */
export async function updateDataset(payload) {
  return ckanAction("package_update", payload || {});
}

/**
 * Patches a CKAN dataset/package with partial fields.
 */
export async function patchDataset(payload) {
  return ckanAction("package_patch", payload || {});
}

/**
 * Updates only dataset visibility (`private`) with patch-first strategy.
 *
 * System flow:
 * - Attempt `package_patch` for minimal-field update.
 * - Fallback to `package_update` with existing dataset snapshot for CKAN builds
 *   where patch is unavailable.
 */
export async function setDatasetVisibility({ datasetId, isPrivate }) {
  const id = toText(datasetId);
  if (!id) throw new Error("Dataset id is required.");

  const privateFlag = Boolean(isPrivate);
  try {
    return await ckanAction("package_patch", { id, private: privateFlag });
  } catch {
    const current = await getDataset(id);
    if (!current) throw new Error("Dataset not found.");
    return updateDataset({
      ...current,
      id: current.id || id,
      private: privateFlag,
    });
  }
}

/**
 * Deletes CKAN dataset/package by id/name.
 *
 * Edge case:
 * - No-op when dataset id is empty after normalization.
 */
export async function deleteDataset(datasetId) {
  const id = toText(datasetId);
  if (!id) return;
  await ckanAction("package_delete", { id });
}

/**
 * Creates a CKAN dataset resource.
 */
export async function createDatasetResource(payload) {
  return ckanAction("resource_create", payload || {});
}

/**
 * Creates a CKAN dataset resource by uploading a binary file.
 */
export async function createDatasetResourceUpload({
  fields = {},
  fileBuffer,
  fileName,
  mimeType,
}) {
  const binary = Buffer.isBuffer(fileBuffer)
    ? fileBuffer
    : Buffer.from(fileBuffer || []);
  const uploadName = toText(fileName) || "output-file.bin";
  const uploadMime = toText(mimeType) || "application/octet-stream";

  const formData = new FormData();
  for (const [key, value] of Object.entries(fields || {})) {
    const text = value == null ? "" : String(value).trim();
    if (!text) continue;
    formData.append(key, text);
  }
  formData.append(
    "upload",
    new Blob([binary], { type: uploadMime }),
    uploadName,
  );

  return ckanMultipartAction("resource_create", formData);
}

/**
 * Updates a CKAN dataset resource.
 */
export async function updateDatasetResource(payload) {
  return ckanAction("resource_update", payload || {});
}

/**
 * Deletes a CKAN dataset resource by id.
 *
 * Edge case:
 * - No-op when resource id is empty after normalization.
 */
export async function deleteDatasetResource(resourceId) {
  const id = toText(resourceId);
  if (!id) return;
  await ckanAction("resource_delete", { id });
}
