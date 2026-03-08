import { normalizeStatus } from "@/shared/utils/status";

export const STATUS_OPTIONS = ["proposal", "ongoing", "completed", "rejected"];

export function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
}

export function formatBytes(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let index = 0;
  let amount = size;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  const rounded =
    amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1);
  return `${rounded} ${units[index]}`;
}

export function toDateInputValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDatasetExtra(dataset, key) {
  const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
  const found = extras.find(
    (item) =>
      String(item?.key || "")
        .trim()
        .toLowerCase() ===
      String(key || "")
        .trim()
        .toLowerCase(),
  );
  return found?.value || "";
}

export function mapDatasetToProjectRecord(dataset) {
  const metadataCreated = String(dataset?.metadata_created || "").trim();
  const yearFromMetadata = metadataCreated
    ? new Date(metadataCreated).getFullYear()
    : null;
  const yearFromExtra = String(
    getDatasetExtra(dataset, "project_year") || getDatasetExtra(dataset, "year"),
  ).trim();
  const industryPartner = String(
    getDatasetExtra(dataset, "industry_partner"),
  ).trim();
  const fundingSource = String(getDatasetExtra(dataset, "funding_source")).trim();
  const fundingAmount = String(getDatasetExtra(dataset, "funding_amount")).trim();
  const startDate = String(getDatasetExtra(dataset, "start_date")).trim();
  const endDate = String(getDatasetExtra(dataset, "end_date")).trim();
  const submittedByUserId = String(
    getDatasetExtra(dataset, "submitted_by_user_id"),
  ).trim();
  const submittedByEmail = String(
    getDatasetExtra(dataset, "submitted_by_email"),
  ).trim();
  const submittedByName = String(
    getDatasetExtra(dataset, "submitted_by_name"),
  ).trim();
  const mappedStatus = String(
    getDatasetExtra(dataset, "status") || dataset?.state || "ongoing",
  )
    .trim()
    .toLowerCase();
  const normalizedMappedStatus = STATUS_OPTIONS.includes(mappedStatus)
    ? mappedStatus
    : mappedStatus === "active"
      ? "ongoing"
      : "proposal";

  return {
    id: dataset?.id || dataset?.name,
    source: "ckan",
    ckan_dataset_id: dataset?.id || null,
    title: dataset?.title || dataset?.name || "-",
    abstract: dataset?.notes || "",
    lead_researcher: dataset?.author || "-",
    faculty_team: getDatasetExtra(dataset, "faculty_team"),
    student_team: getDatasetExtra(dataset, "student_team"),
    industry_partner: industryPartner,
    funding_source: fundingSource,
    funding_amount: fundingAmount,
    start_date: startDate,
    end_date: endDate,
    year:
      yearFromExtra ||
      (Number.isFinite(yearFromMetadata) ? String(yearFromMetadata) : "-"),
    status: normalizeStatus(normalizedMappedStatus),
    submitted_by_name:
      submittedByName ||
      dataset?.maintainer ||
      dataset?.author ||
      "CKAN Dataset Owner",
    submitted_by_email:
      submittedByEmail || dataset?.maintainer_email || dataset?.author_email || "-",
    submitted_by: submittedByUserId || dataset?.creator_user_id || null,
    submitted_at: metadataCreated || dataset?.metadata_modified || null,
    submitted_by_org_name:
      dataset?.organization?.title ||
      dataset?.organization?.display_name ||
      dataset?.organization?.name ||
      "-",
    project_public_visible: dataset?.private !== true,
    private: dataset?.private === true,
    project_ckan_org_id: dataset?.organization?.name || null,
    research_center_id: dataset?.organization?.name || null,
    resources: Array.isArray(dataset?.resources) ? dataset.resources : [],
  };
}
