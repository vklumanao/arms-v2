export function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function getIsoDateDaysAgo(days) {
  const dt = new Date();
  dt.setDate(dt.getDate() - days);
  return dt.toISOString().slice(0, 10);
}

export function getIsoDateYearStart() {
  const dt = new Date();
  return `${dt.getFullYear()}-01-01`;
}

export function makeExportStamp() {
  return new Date().toISOString().replace(/[:]/g, "-").slice(0, 19);
}

export function createDefaultReportFilters() {
  return {
    year: "",
    status: "",
    center: "",
    department: "",
    search: "",
    dateFrom: "",
    dateTo: "",
  };
}

export function parseStoredReportFilters(raw, fallbackFilters) {
  try {
    if (!raw) return fallbackFilters;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallbackFilters;
    return {
      ...fallbackFilters,
      year: parsed.year || "",
      status: parsed.status || "",
      center: parsed.center || "",
      department: parsed.department || "",
      search: parsed.search || "",
      dateFrom: parsed.dateFrom || "",
      dateTo: parsed.dateTo || "",
    };
  } catch {
    return fallbackFilters;
  }
}

export function createIdNameMap(rows) {
  return (rows || []).reduce((acc, row) => {
    if (row?.id) acc[row.id] = row.name || row.id;
    return acc;
  }, {});
}

export function createProfileNameMap(profiles) {
  return (profiles || []).reduce((acc, profile) => {
    if (profile?.id) {
      acc[profile.id] = profile.full_name || profile.email || "Unknown user";
    }
    return acc;
  }, {});
}

export function filterProjects(projects, filters) {
  return (projects || []).filter((project) => {
    if (filters.year && String(project.year) !== filters.year) return false;
    if (filters.status && project.status !== filters.status) return false;
    if (filters.center && project.research_center_id !== filters.center) {
      return false;
    }
    if (filters.department && project.department_id !== filters.department) {
      return false;
    }
    if (
      filters.search &&
      !String(project.title || "")
        .toLowerCase()
        .includes(filters.search.toLowerCase())
    ) {
      return false;
    }
    if (filters.dateFrom && project.submitted_at) {
      const submittedDate = new Date(project.submitted_at);
      const fromDate = new Date(filters.dateFrom);
      if (submittedDate < fromDate) return false;
    }
    if (filters.dateTo && project.submitted_at) {
      const submittedDate = new Date(project.submitted_at);
      const toDate = new Date(`${filters.dateTo}T23:59:59`);
      if (submittedDate > toDate) return false;
    }
    return true;
  });
}

export function getMovProjectIdSet(movs) {
  const set = new Set();
  (movs || []).forEach((mov) => {
    if (mov?.project_id) set.add(mov.project_id);
  });
  return set;
}

export function computeReportKpis(
  filteredProjects,
  publications,
  profiles,
  movs,
) {
  const base = { proposal: 0, ongoing: 0, completed: 0, rejected: 0 };
  (filteredProjects || []).forEach((project) => {
    if (base[project.status] !== undefined) base[project.status] += 1;
  });
  return {
    totalProjects: (filteredProjects || []).length,
    ...base,
    totalPublications: (publications || []).length,
    totalAffiliates: (profiles || []).filter((p) =>
      ["faculty", "student"].includes(p.role),
    ).length,
    activeUsers: (profiles || []).filter((p) => p.is_active).length,
    totalMovs: (movs || []).length,
  };
}

export function detectProjectAnomalies(filteredProjects, movProjectSet) {
  const rows = [];
  (filteredProjects || []).forEach((project) => {
    if (!project.lead_researcher) {
      rows.push({ project, reason: "Missing lead researcher" });
    }
    if (
      (project.status === "ongoing" || project.status === "completed") &&
      !movProjectSet.has(project.id)
    ) {
      rows.push({
        project,
        reason: "No MOV uploaded for ongoing/completed project",
      });
    }
    if (
      project.public_visible &&
      !["ongoing", "completed"].includes(project.status)
    ) {
      rows.push({
        project,
        reason: "Public visible while status is not ongoing/completed",
      });
    }
    if (
      project.start_date &&
      project.end_date &&
      project.start_date > project.end_date
    ) {
      rows.push({ project, reason: "End date earlier than start date" });
    }
  });
  return rows;
}

export function buildProjectExportRows({
  projects,
  filters,
  centerMap,
  departmentMap,
}) {
  const exportedAt = new Date().toISOString();
  return (projects || []).map((project) => ({
    export_generated_at: exportedAt,
    filter_date_from: filters.dateFrom || "",
    filter_date_to: filters.dateTo || "",
    id: project.id,
    title: project.title,
    lead_researcher: project.lead_researcher,
    year: project.year,
    status: project.status,
    center: centerMap[project.research_center_id] || "",
    department: departmentMap[project.department_id] || "",
    funding_amount: project.funding_amount || 0,
    funding_source: project.funding_source || "",
    industry_partner: project.industry_partner || "",
    public_visible: project.public_visible,
    start_date: project.start_date || "",
    end_date: project.end_date || "",
  }));
}

export function getPresetDateRange(preset) {
  if (preset === "all") {
    return { dateFrom: "", dateTo: "" };
  }
  if (preset === "30d") {
    return {
      dateFrom: getIsoDateDaysAgo(30),
      dateTo: getTodayIsoDate(),
    };
  }
  if (preset === "90d") {
    return {
      dateFrom: getIsoDateDaysAgo(90),
      dateTo: getTodayIsoDate(),
    };
  }
  if (preset === "ytd") {
    return {
      dateFrom: getIsoDateYearStart(),
      dateTo: getTodayIsoDate(),
    };
  }
  return null;
}

