import { normalizeStatus } from "@/shared/utils/status";

export const MAX_MOV_FILE_BYTES = 25 * 1024 * 1024;

export function sanitizeMovFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function isMovRequired(project) {
  const status = normalizeStatus(project.status);
  return ["ongoing", "completed"].includes(status);
}

export function filterSubmissions(projects, filters) {
  return (projects || []).filter((project) => {
    if (
      filters.search &&
      !String(project.title || "")
        .toLowerCase()
        .includes(filters.search.toLowerCase())
    ) {
      return false;
    }
    if (filters.status && normalizeStatus(project.status) !== filters.status) {
      return false;
    }
    if (filters.year && String(project.year) !== filters.year) return false;
    return true;
  });
}

export function buildSubmissionAnalytics(projects) {
  const base = { proposal: 0, ongoing: 0, completed: 0, rejected: 0 };
  (projects || []).forEach((project) => {
    const key = normalizeStatus(project.status);
    if (Object.prototype.hasOwnProperty.call(base, key)) {
      base[key] += 1;
    }
  });
  return base;
}

export function buildSubmissionTasks(projects) {
  const dueSoon = (projects || []).filter((project) => {
    if (!project.end_date || normalizeStatus(project.status) !== "ongoing") {
      return false;
    }
    const diff = Math.ceil(
      (new Date(project.end_date) - new Date()) / (1000 * 60 * 60 * 24),
    );
    return diff >= 0 && diff <= 14;
  });

  const rejected = (projects || []).filter(
    (project) => normalizeStatus(project.status) === "rejected",
  );
  const proposals = (projects || []).filter(
    (project) => normalizeStatus(project.status) === "proposal",
  );

  return { dueSoon, rejected, proposals };
}

export function buildMovStoragePath(projectId, fileName, seed = Date.now()) {
  const safeName = sanitizeMovFileName(fileName);
  return `${projectId}/pending-${seed}/${seed}-${safeName}`;
}

