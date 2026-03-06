export function createAffiliateModuleFilters() {
  return {
    search: "",
    role: "all",
    status: "all",
    department: "",
    sortBy: "name_asc",
  };
}

export function buildCenterNameById(centers) {
  return (centers || []).reduce((acc, center) => {
    acc[center.id] = center.name;
    return acc;
  }, {});
}

export function buildAffiliateAnalytics(rows) {
  const total = (rows || []).length;
  const active = (rows || []).filter((row) => row.is_active).length;
  const inactive = total - active;
  const faculty = (rows || []).filter((row) => row.role === "faculty").length;
  const student = (rows || []).filter((row) => row.role === "student").length;
  return { total, active, inactive, faculty, student };
}

export function listAffiliateDepartments(rows) {
  const set = new Set();
  (rows || []).forEach((row) => {
    if (row.department) set.add(row.department);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function filterAndSortAffiliates(rows, filters) {
  const keyword = String(filters.search || "")
    .trim()
    .toLowerCase();

  const filtered = (rows || []).filter((row) => {
    if (filters.role !== "all" && row.role !== filters.role) return false;
    if (filters.status !== "all") {
      const expectedActive = filters.status === "active";
      if (row.is_active !== expectedActive) return false;
    }
    if (filters.department && row.department !== filters.department) {
      return false;
    }
    if (keyword) {
      const target =
        `${row.full_name || ""} ${row.email || ""} ${row.department || ""} ${row.id || ""}`.toLowerCase();
      if (!target.includes(keyword)) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (filters.sortBy === "name_desc") {
      return String(b.full_name || "").localeCompare(String(a.full_name || ""));
    }
    if (filters.sortBy === "recent_desc") {
      return (
        new Date(b.updated_at || b.created_at || 0) -
        new Date(a.updated_at || a.created_at || 0)
      );
    }
    if (filters.sortBy === "recent_asc") {
      return (
        new Date(a.updated_at || a.created_at || 0) -
        new Date(b.updated_at || b.created_at || 0)
      );
    }
    return String(a.full_name || "").localeCompare(String(b.full_name || ""));
  });

  return sorted;
}

export function filterAffiliateRelatedDatasets(datasets, affiliate) {
  const userId = String(affiliate?.ckan_user_id || "")
    .trim()
    .toLowerCase();
  const username = String(affiliate?.ckan_username || "")
    .trim()
    .toLowerCase();
  const email = String(affiliate?.email || "")
    .trim()
    .toLowerCase();
  const fullName = String(affiliate?.full_name || "")
    .trim()
    .toLowerCase();

  return (datasets || [])
    .filter((dataset) => {
      const creatorId = String(dataset?.creator_user_id || "")
        .trim()
        .toLowerCase();
      const author = String(dataset?.author || "")
        .trim()
        .toLowerCase();
      const maintainer = String(dataset?.maintainer || "")
        .trim()
        .toLowerCase();
      const maintainerEmail = String(dataset?.maintainer_email || "")
        .trim()
        .toLowerCase();

      if (userId && creatorId && creatorId === userId) return true;
      if (username && author && author.includes(username)) return true;
      if (username && maintainer && maintainer.includes(username)) return true;
      if (email && maintainerEmail && maintainerEmail === email) return true;
      if (fullName && author && author.includes(fullName)) return true;
      if (fullName && maintainer && maintainer.includes(fullName)) return true;
      return false;
    })
    .map((dataset, index) => {
      const createdAt = dataset?.metadata_created || "";
      const year = createdAt ? new Date(createdAt).getFullYear() : "-";
      const status = String(dataset?.state || "active").trim();
      return {
        id: dataset?.id || dataset?.name || `dataset-${index}`,
        title: dataset?.title || dataset?.name || "Untitled dataset",
        status,
        year: Number.isFinite(year) ? year : "-",
        organization:
          dataset?.organization?.title ||
          dataset?.organization?.display_name ||
          dataset?.organization?.name ||
          "-",
        updatedAt: dataset?.metadata_modified || dataset?.metadata_created || null,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.updatedAt || 0).getTime() -
        new Date(a.updatedAt || 0).getTime(),
    );
}

export function createAffiliateEditForm(row) {
  return {
    department: row.department || "",
    ckan_org_id: row.ckan_org_id || "",
    designation: row.designation || "",
    employment_status: row.employment_status || "",
    google_scholar_link: row.google_scholar_link || "",
    is_gs_faculty: Boolean(row.is_gs_faculty),
    publication_count: Number(row.publication_count || 0),
    research_project_count: Number(row.research_project_count || 0),
    creative_work_count: Number(row.creative_work_count || 0),
    awards_count: Number(row.awards_count || 0),
    ip_count: Number(row.ip_count || 0),
  };
}

export function buildAffiliateExportRows(rows, centerNameById) {
  return (rows || []).map((row, index) => ({
    no: index + 1,
    name: row.full_name || "-",
    email: row.email || "-",
    role: row.role || "-",
    department: row.department || "-",
    center: row.ckan_org_id ? centerNameById[row.ckan_org_id] || "-" : "-",
    status: row.is_active ? "Active" : "Inactive",
    gs: row.is_gs_faculty ? "Yes" : "No",
  }));
}
