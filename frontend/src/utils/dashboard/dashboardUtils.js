import { normalizeStatus } from "@/utils/status";

export function createDashboardFilters() {
  return {
    search: "",
    status: "",
    year: "",
    center: "",
    department: "",
  };
}

export function filterDashboardProjects(projects, filters) {
  return (projects || []).filter((project) => {
    if (
      filters.search &&
      !String(project.title || "")
        .toLowerCase()
        .includes(filters.search.toLowerCase())
    ) {
      return false;
    }
    const normalizedStatus = normalizeStatus(project.status);
    if (filters.status && normalizedStatus !== filters.status) return false;
    if (filters.year && String(project.year) !== filters.year) return false;
    if (filters.center && project.research_center_id !== filters.center) {
      return false;
    }
    if (filters.department && project.department_id !== filters.department) {
      return false;
    }
    return true;
  });
}

export function buildDashboardCounts(projects) {
  const base = { proposal: 0, ongoing: 0, completed: 0, rejected: 0 };
  (projects || []).forEach((project) => {
    const normalized = normalizeStatus(project.status);
    if (Object.prototype.hasOwnProperty.call(base, normalized)) {
      base[normalized] += 1;
    }
  });
  return base;
}

export function findDashboardDeadlineAlerts(projects, days = 14) {
  return (projects || []).filter((project) => {
    if (!project.end_date || normalizeStatus(project.status) !== "ongoing") {
      return false;
    }
    const due = new Date(project.end_date);
    const today = new Date();
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= days;
  });
}

export function buildDeadlineCalendar(alerts, limit = 10) {
  return [...(alerts || [])]
    .sort((a, b) => new Date(a.end_date) - new Date(b.end_date))
    .slice(0, limit);
}

export function buildMonthlySubmissions(projects) {
  const monthMap = new Map();
  const today = new Date();

  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(undefined, { month: "short" });
    monthMap.set(key, { key, month: label, submissions: 0 });
  }

  (projects || []).forEach((project) => {
    const rawDate = project.submitted_at || project.updated_at;
    if (!rawDate) return;
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap.has(key)) return;
    monthMap.get(key).submissions += 1;
  });

  return Array.from(monthMap.values());
}

export function buildLifecycleBreakdown(projects) {
  const statusBase = { proposal: 0, ongoing: 0, completed: 0, rejected: 0 };
  const resolveProjectYear = (project) => {
    if (
      project?.year !== undefined &&
      project?.year !== null &&
      project?.year !== ""
    ) {
      const numericYear = Number(project.year);
      if (!Number.isNaN(numericYear)) return numericYear;
    }

    const dateCandidates = [
      project?.submitted_at,
      project?.created_at,
      project?.updated_at,
      project?.start_date,
      project?.end_date,
    ];

    for (const value of dateCandidates) {
      if (!value) continue;
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.getFullYear();
    }

    return null;
  };

  const normalizedRows = (projects || [])
    .map((project) => ({ project, year: resolveProjectYear(project) }))
    .filter((row) => row.year !== null);

  const years = [...new Set(normalizedRows.map((row) => row.year))].sort(
    (a, b) => a - b,
  );

  return years.map((year) => {
    const row = { year: String(year), ...statusBase };
    normalizedRows.forEach(({ project, year: projectYear }) => {
      if (projectYear !== year) return;
      const status = normalizeStatus(project.status);
      if (Object.prototype.hasOwnProperty.call(row, status)) row[status] += 1;
    });
    return row;
  });
}

function getDaysUntil(dateValue) {
  if (!dateValue) return null;
  const due = new Date(dateValue);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  return diff;
}

export function isDashboardNeedsAction(project, role = "") {
  const status = normalizeStatus(project?.status);
  if (role === "admin") {
    return status === "proposal";
  }

  if (status === "proposal" || status === "rejected") {
    return true;
  }

  if (status === "ongoing") {
    const daysUntil = getDaysUntil(project?.end_date);
    return daysUntil !== null && daysUntil <= 7;
  }

  return false;
}

export function applyDashboardQuickFilter(projects, quickFilter, context = {}) {
  if (!quickFilter || quickFilter === "all") return projects || [];

  const userId = context.userId || "";
  const role = context.role || "";

  return (projects || []).filter((project) => {
    if (quickFilter === "mine") {
      return userId ? project.submitted_by === userId : true;
    }
    if (quickFilter === "completed") {
      return normalizeStatus(project.status) === "completed";
    }
    if (quickFilter === "needs_action") {
      return isDashboardNeedsAction(project, role);
    }
    return true;
  });
}

export function buildDashboardFeaturedRecords(projects, limit = 6) {
  return [...(projects || [])]
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
    .slice(0, limit);
}

export function buildDashboardActivityRail(projects, historyRows, limit = 12) {
  const projectMap = new Map(
    (projects || []).map((project) => [project.id, project]),
  );
  const events = [];

  (projects || []).forEach((project) => {
    if (project.submitted_at) {
      events.push({
        id: `submitted-${project.id}`,
        timestamp: project.submitted_at,
        title: "Submission created",
        detail: project.title || "Untitled project",
        tone: "info",
      });
    }

    if (project.updated_at && project.updated_at !== project.submitted_at) {
      events.push({
        id: `updated-${project.id}`,
        timestamp: project.updated_at,
        title: "Record updated",
        detail: project.title || "Untitled project",
        tone: "muted",
      });
    }

    const daysUntil = getDaysUntil(project.end_date);
    if (
      normalizeStatus(project.status) === "ongoing" &&
      daysUntil !== null &&
      daysUntil >= 0 &&
      daysUntil <= 14
    ) {
      events.push({
        id: `deadline-${project.id}`,
        timestamp: project.end_date,
        title: "Upcoming deadline",
        detail: `${project.title || "Untitled project"} due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
        tone: "warning",
      });
    }
  });

  (historyRows || []).forEach((row) => {
    const project = projectMap.get(row.project_id);
    events.push({
      id: `history-${row.id}`,
      timestamp: row.changed_at,
      title: "Status changed",
      detail: `${project?.title || "Project"}: ${normalizeStatus(row.old_status) || "none"} -> ${normalizeStatus(row.new_status)}`,
      tone: "success",
    });
  });

  return events
    .filter((event) => Boolean(event.timestamp))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

