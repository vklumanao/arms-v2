import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { useReferenceData } from "@/shared/hooks/useReferenceData";
import { fetchCkanDatasets } from "@/shared/api/ckanApi";
import PageHeader from "@/shared/components/layout/PageHeader";
import EmptyState from "@/shared/components/feedback/EmptyState";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";
import PaginationControls from "@/shared/components/navigation/PaginationControls";
import { useToast } from "@/app/providers/ToastProvider";
import {
  deleteOwnedProject,
  fetchProjectResources,
  quickEditOwnedProject,
  updateResearchOutputVisibility,
} from "@/features/submissions/services";
import { normalizeStatus } from "@/shared/utils/status";
import {
  formatBytes,
  formatDate,
  mapDatasetToProjectRecord,
  STATUS_OPTIONS,
  toDateInputValue,
} from "@/features/submissions/utils";
import {
  CheckCircle2,
  Clock3,
  FileText,
  Search,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";

const PROJECTS_PAGE_SIZE = 10;

export default function ResearchProjectsHubPage() {
  const { user, profile } = useAuth();
  const isAdmin =
    String(profile?.role || user?.role || "")
      .trim()
      .toLowerCase() === "admin";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { centers } = useReferenceData();
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    year: "",
    sortBy: "submitted_desc",
  });
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    abstract: "",
    year: "",
    industry_partner: "",
    funding_source: "",
    funding_amount: "",
    start_date: "",
    end_date: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [exportingType, setExportingType] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resourcePanel, setResourcePanel] = useState({
    loading: false,
    error: "",
    dataset: null,
    resources: [],
    syncEnabled: true,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [visibilitySavingByDataset, setVisibilitySavingByDataset] = useState({});
  const toast = useToast();

  useEffect(() => {
    if (error) toast.error("Action failed", error);
  }, [error, toast]);

  useEffect(() => {
    if (message) toast.success("Action completed", message);
  }, [message, toast]);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId) {
      navigate(
        `/submit-affiliation/submit?edit=${encodeURIComponent(editId)}`,
        {
          replace: true,
        },
      );
    }
  }, [navigate, searchParams]);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    const orgId = String(profile?.ckan_org_id || "").trim();

    fetchCkanDatasets({
      orgId: isAdmin ? "" : orgId,
      limit: 100,
    })
      .then((payload) => {
        if (!isMounted) return;
        const datasets = Array.isArray(payload?.data) ? payload.data : [];
        setProjects(datasets.map(mapDatasetToProjectRecord));
      })
      .catch((queryError) => {
        if (!isMounted) return;
        setError(queryError.message || "Unable to load CKAN datasets.");
      });

    return () => {
      isMounted = false;
    };
  }, [isAdmin, profile?.ckan_org_id, user?.id]);

  const centerById = useMemo(
    () =>
      centers.reduce((acc, center) => {
        acc[center.id] = center.name;
        return acc;
      }, {}),
    [centers],
  );
  const getProjectOrganization = (project) => {
    const submittedOrgName = String(
      project?.submitted_by_org_name || "",
    ).trim();
    if (submittedOrgName) return submittedOrgName;
    const submittedOrgId = String(project?.submitted_by_org_id || "").trim();
    if (submittedOrgId) return centerById[submittedOrgId] || submittedOrgId;
    const projectOrgId = String(project?.project_ckan_org_id || "").trim();
    if (projectOrgId) return centerById[projectOrgId] || projectOrgId;
    return centerById[project?.research_center_id] || "-";
  };

  const analytics = useMemo(() => {
    const base = {
      total: projects.length,
      proposal: 0,
      ongoing: 0,
      completed: 0,
      rejected: 0,
    };

    projects.forEach((project) => {
      const key = normalizeStatus(project.status);
      if (Object.prototype.hasOwnProperty.call(base, key)) {
        base[key] += 1;
      }
    });

    return base;
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const normalizedSearch = String(filters.search || "")
      .trim()
      .toLowerCase();

    const filtered = (projects || []).filter((project) => {
      const status = normalizeStatus(project.status);
      const title = String(project.title || "").toLowerCase();
      const abstract = String(project.abstract || "").toLowerCase();
      const leadResearcher = String(
        project.lead_researcher || "",
      ).toLowerCase();

      if (
        normalizedSearch &&
        !title.includes(normalizedSearch) &&
        !abstract.includes(normalizedSearch) &&
        !leadResearcher.includes(normalizedSearch)
      ) {
        return false;
      }

      if (filters.status && status !== filters.status) return false;
      if (filters.year && String(project.year || "") !== String(filters.year)) {
        return false;
      }

      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (filters.sortBy === "submitted_asc") {
        return new Date(a.submitted_at || 0) - new Date(b.submitted_at || 0);
      }
      if (filters.sortBy === "title_asc") {
        return String(a.title || "").localeCompare(String(b.title || ""));
      }
      if (filters.sortBy === "title_desc") {
        return String(b.title || "").localeCompare(String(a.title || ""));
      }
      return new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0);
    });

    return sorted;
  }, [filters, projects]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredProjects.length / PROJECTS_PAGE_SIZE)),
    [filteredProjects.length],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * PROJECTS_PAGE_SIZE;
    return filteredProjects.slice(start, start + PROJECTS_PAGE_SIZE);
  }, [currentPage, filteredProjects]);

  const selectedProject = useMemo(
    () =>
      filteredProjects.find((project) => project.id === selectedProjectId) ||
      null,
    [filteredProjects, selectedProjectId],
  );

  useEffect(() => {
    if (!selectedProject?.id) {
      setResourcePanel({
        loading: false,
        error: "",
        dataset: null,
        resources: [],
        syncEnabled: true,
      });
      return;
    }

    let isMounted = true;
    setResourcePanel({
      loading: true,
      error: "",
      dataset: null,
      resources: [],
      syncEnabled: true,
    });

    if (selectedProject.source === "ckan") {
      setResourcePanel({
        loading: false,
        error: "",
        dataset: selectedProject,
        resources: Array.isArray(selectedProject.resources)
          ? selectedProject.resources
          : [],
        syncEnabled: true,
      });
      return () => {
        isMounted = false;
      };
    }

    fetchProjectResources({ projectId: selectedProject.id }).then(
      ({ data, error: loadError }) => {
        if (!isMounted) return;
        if (loadError) {
          setResourcePanel({
            loading: false,
            error: loadError.message || "Unable to load linked CKAN resources.",
            dataset: null,
            resources: [],
            syncEnabled: true,
          });
          return;
        }

        setResourcePanel({
          loading: false,
          error: "",
          dataset: data?.dataset || null,
          resources: Array.isArray(data?.resources) ? data.resources : [],
          syncEnabled: data?.syncEnabled !== false,
        });
      },
    );

    return () => {
      isMounted = false;
    };
  }, [selectedProject?.id]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      status: "",
      year: "",
      sortBy: "submitted_desc",
    });
  };

  const openEditModal = (project) => {
    setMessage("");
    setError("");
    setEditingProject(project);
    setConfirmSaveOpen(false);
    setEditForm({
      title: project.title || "",
      abstract: project.abstract || "",
      year: project.year || "",
      industry_partner: project.industry_partner || "",
      funding_source: project.funding_source || "",
      funding_amount: project.funding_amount ?? "",
      start_date: toDateInputValue(project.start_date),
      end_date: toDateInputValue(project.end_date),
    });
  };

  const handleEditField = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const submitQuickEdit = async () => {
    if (!editingProject?.id) return;
    setSavingEdit(true);
    setMessage("");
    setError("");

    const { data, error: updateError } = await quickEditOwnedProject({
      projectId: editingProject.id,
      form: editForm,
    });

    if (updateError) {
      setError(updateError.message || "Unable to update project.");
      setSavingEdit(false);
      return;
    }

    setProjects((prev) =>
      prev.map((project) =>
        project.id === editingProject.id
          ? { ...project, ...(data || {}) }
          : project,
      ),
    );

    setSavingEdit(false);
    setEditingProject(null);
    setMessage("Project updated successfully.");
  };

  const handleDeleteProject = async (project) => {
    if (!project?.id) return;
    setDeleteTarget(project);
  };

  const confirmDeleteProject = async () => {
    const project = deleteTarget;
    if (!project?.id) return;

    setDeletingProjectId(project.id);
    setMessage("");
    setError("");

    const { error: deleteError } = await deleteOwnedProject({
      projectId: project.id,
    });

    if (deleteError) {
      setError(deleteError.message || "Unable to delete project.");
      setDeletingProjectId("");
      return;
    }

    setProjects((prev) => prev.filter((item) => item.id !== project.id));
    if (selectedProjectId === project.id) setSelectedProjectId(null);
    setDeleteTarget(null);
    setDeletingProjectId("");
    setMessage("Project deleted successfully.");
  };

  const handleToggleVisibility = async (project) => {
    const datasetId = String(project?.ckan_dataset_id || "").trim();
    if (!datasetId) {
      setError("Dataset id is missing.");
      return;
    }

    const nextIsPublic = Boolean(project?.private);
    setVisibilitySavingByDataset((prev) => ({ ...prev, [datasetId]: true }));

    const { data, error: updateError } = await updateResearchOutputVisibility({
      datasetId,
      isPublic: nextIsPublic,
    });

    setVisibilitySavingByDataset((prev) => {
      const next = { ...prev };
      delete next[datasetId];
      return next;
    });

    if (updateError) {
      setError(updateError.message || "Unable to update project visibility.");
      return;
    }

    const isNowPublic = Boolean(data?.project_public_visible);
    setProjects((prev) =>
      prev.map((item) =>
        String(item?.ckan_dataset_id || "").trim() === datasetId
          ? {
              ...item,
              project_public_visible: isNowPublic,
              private: !isNowPublic,
            }
          : item,
      ),
    );
    setMessage(
      isNowPublic ? "Project is now public." : "Project is now private.",
    );
  };

  const triggerDownload = (filename, content, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const buildExportRows = () =>
    filteredProjects.map((project, index) => ({
      no: index + 1,
      title: project.title || "-",
      submittedBy: project.submitted_by_name || "Unknown user",
      submittedEmail: project.submitted_by_email || project.submitted_by || "-",
      year: project.year || "-",
      status: normalizeStatus(project.status),
      organization: getProjectOrganization(project),
      submittedDate: formatDate(project.submitted_at),
    }));

  const exportAsCsv = () => {
    if (!filteredProjects.length) return;
    setExportingType("csv");
    try {
      const headers = [
        "No.",
        "Title",
        "Submitted By",
        "Submitted Email",
        "Year",
        "Status",
        "Organization",
        "Submitted Date",
      ];
      const lines = buildExportRows().map((row) =>
        [
          row.no,
          row.title,
          row.submittedBy,
          row.submittedEmail,
          row.year,
          row.status,
          row.organization,
          row.submittedDate,
        ]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(","),
      );
      const csv = [headers.join(","), ...lines].join("\n");
      triggerDownload(
        `research-projects-${new Date().toISOString().slice(0, 10)}.csv`,
        csv,
        "text/csv;charset=utf-8;",
      );
    } finally {
      setExportingType("");
    }
  };

  const exportAsPdf = () => {
    if (!filteredProjects.length) return;
    setExportingType("pdf");
    try {
      const timestamp = new Date().toLocaleString();
      const rows = buildExportRows();
      const rowsHtml = rows
        .map(
          (row) => `
            <tr>
              <td>${row.no}</td>
              <td>${row.title}</td>
              <td>${row.submittedBy}</td>
              <td>${row.submittedEmail}</td>
              <td>${row.year}</td>
              <td>${row.status}</td>
              <td>${row.organization}</td>
              <td>${row.submittedDate}</td>
            </tr>
          `,
        )
        .join("");

      const printWindow = window.open("", "_blank", "width=1200,height=800");
      if (!printWindow) {
        setError("Unable to open print window for PDF export.");
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>research-project-records-filtered</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
              h1 { margin: 0 0 6px; font-size: 20px; }
              p { margin: 0 0 16px; color: #475569; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; }
              th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
              th { background: #f8fafc; }
            </style>
          </head>
          <body>
            <h1>Research Project Records Report</h1>
            <p>Generated: ${timestamp} | Scope: filtered | Rows: ${rows.length}</p>
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Title</th>
                  <th>Submitted By</th>
                  <th>Email</th>
                  <th>Year</th>
                  <th>Status</th>
                  <th>Organization</th>
                  <th>Submitted Date</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="8">No records found.</td></tr>'}
              </tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } finally {
      setExportingType("");
    }
  };

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Research Projects"
        description="Browse all submitted projects first, then open the submission form only when needed."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <FileText size={14} />
            Total Projects
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.total}
          </p>
        </article>
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <FileText size={14} />
            Proposal
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.proposal}
          </p>
        </article>
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <Clock3 size={14} />
            Ongoing
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.ongoing}
          </p>
        </article>
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <CheckCircle2 size={14} />
            Completed
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.completed}
          </p>
        </article>
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <XCircle size={14} />
            Rejected
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.rejected}
          </p>
        </article>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
            <SlidersHorizontal size={14} />
            Filters
          </div>
        </div>
        <div className="panel-body">
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              <label className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  className="control-input pl-8"
                  placeholder="Search title, abstract, lead"
                  value={filters.search}
                  onChange={(e) => updateFilter("search", e.target.value)}
                />
              </label>
              <select
                className="control-select"
                value={filters.status}
                onChange={(e) => updateFilter("status", e.target.value)}
              >
                <option value="">Filter by status</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status[0].toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
              <input
                className="control-input"
                placeholder="Year"
                value={filters.year}
                onChange={(e) => updateFilter("year", e.target.value)}
              />
              <div className="flex gap-2">
                <select
                  className="control-select"
                  value={filters.sortBy}
                  onChange={(e) => updateFilter("sortBy", e.target.value)}
                >
                  <option value="submitted_desc">Sort: Newest submitted</option>
                  <option value="submitted_asc">Sort: Oldest submitted</option>
                  <option value="title_asc">Sort: Title A-Z</option>
                  <option value="title_desc">Sort: Title Z-A</option>
                </select>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={clearFilters}
                >
                  Reset
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Showing{" "}
              <span className="font-semibold">{filteredProjects.length}</span>{" "}
              project(s).
            </p>
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
            Research Project Records ({filteredProjects.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="btn btn-primary" to="/submit-affiliation/submit">
              Submit Research Project
            </Link>
            <button
              type="button"
              className="btn btn-outline"
              onClick={exportAsCsv}
              disabled={!filteredProjects.length || Boolean(exportingType)}
            >
              {exportingType === "csv" ? "Exporting..." : "Export CSV"}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={exportAsPdf}
              disabled={!filteredProjects.length || Boolean(exportingType)}
            >
              {exportingType === "pdf" ? "Exporting..." : "Export PDF"}
            </button>
          </div>
        </div>
        {filteredProjects.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No research projects found"
              description="Try adjusting your filters or submit a new research project."
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Title</th>
                    <th>Submitted By</th>
                    <th>Year</th>
                    <th>Status</th>
                    <th>Visibility</th>
                    <th>Organization</th>
                    <th>Submitted</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProjects.map((project, index) => {
                    const status = normalizeStatus(project.status);
                    const canToggleVisibility =
                      Boolean(project?.ckan_dataset_id) &&
                      (isAdmin ||
                        String(project?.submitted_by || "") ===
                          String(user?.id || "") ||
                        String(project?.submitted_by_email || "")
                          .trim()
                          .toLowerCase() ===
                          String(user?.email || "")
                            .trim()
                            .toLowerCase());
                    const canEdit =
                      project.source !== "ckan" &&
                      (isAdmin || project.submitted_by === user?.id);
                    return (
                      <tr key={project.id} className="align-top">
                        <td>
                          {(currentPage - 1) * PROJECTS_PAGE_SIZE + index + 1}
                        </td>
                        <td className="font-medium text-slate-900">
                          {project.title || "-"}
                        </td>
                        <td className="text-slate-600">
                          <p className="font-medium text-slate-900">
                            {project.submitted_by_name || "Unknown user"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {project.submitted_by_email ||
                              project.submitted_by ||
                              "-"}
                          </p>
                        </td>
                        <td className="text-slate-600">
                          {project.year || "-"}
                        </td>
                        <td>
                          <span className={`status-chip status-${status}`}>
                            {status}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`status-chip ${project.private ? "status-rejected" : "status-completed"}`}
                            >
                              {project.private ? "Private" : "Public"}
                            </span>
                            <button
                              type="button"
                              className="btn btn-outline"
                              disabled={
                                !canToggleVisibility ||
                                Boolean(
                                  visibilitySavingByDataset[
                                    project.ckan_dataset_id
                                  ],
                                )
                              }
                              onClick={() => handleToggleVisibility(project)}
                            >
                              {visibilitySavingByDataset[project.ckan_dataset_id]
                                ? "Saving..."
                                : project.private
                                  ? "Make Public"
                                  : "Make Private"}
                            </button>
                          </div>
                        </td>
                        <td className="text-slate-600">
                          {getProjectOrganization(project)}
                        </td>
                        <td className="text-slate-600">
                          {formatDate(project.submitted_at)}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => setSelectedProjectId(project.id)}
                            >
                              View
                            </button>
                            {canEdit ? (
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => openEditModal(project)}
                              >
                                Edit
                              </button>
                            ) : null}
                            {canEdit ? (
                              <button
                                type="button"
                                className="btn btn-danger-outline"
                                onClick={() => handleDeleteProject(project)}
                                disabled={deletingProjectId === project.id}
                              >
                                {deletingProjectId === project.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <PaginationControls
        page={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {selectedProject ? (
        <div
          className="modal-overlay"
          onClick={() => setSelectedProjectId(null)}
        >
          <aside
            className="ml-auto h-full w-full overflow-y-auto border-l border-[var(--border)] bg-white p-4 shadow-2xl sm:max-w-xl sm:p-5 lg:max-w-6xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
              <h2 className="text-base font-bold uppercase tracking-[0.08em] text-slate-500">
                Project Details
              </h2>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSelectedProjectId(null)}
              >
                Close
              </button>
            </div>
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-sm uppercase tracking-[0.06em] text-slate-500">
                  Title
                </p>
                <p className="text-base font-semibold text-slate-900">
                  {selectedProject.title || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.06em] text-slate-500">
                  Submitted By
                </p>
                <p className="text-base text-slate-800">
                  {selectedProject.submitted_by_name || "Unknown user"}
                </p>
                <p className="text-sm text-slate-500">
                  {selectedProject.submitted_by_email ||
                    selectedProject.submitted_by ||
                    "-"}
                </p>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.06em] text-slate-500">
                  Status
                </p>
                <span
                  className={`status-chip status-${normalizeStatus(selectedProject.status)}`}
                >
                  {normalizeStatus(selectedProject.status)}
                </span>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.06em] text-slate-500">
                  Organization
                </p>
                <p className="text-base text-slate-800">
                  {getProjectOrganization(selectedProject)}
                </p>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.06em] text-slate-500">
                  Year
                </p>
                <p className="text-base text-slate-800">
                  {selectedProject.year || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.06em] text-slate-500">
                  Submitted Date
                </p>
                <p className="text-base text-slate-800">
                  {formatDate(selectedProject.submitted_at)}
                </p>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.06em] text-slate-500">
                  Lead Researcher
                </p>
                <p className="text-base text-slate-800">
                  {selectedProject.lead_researcher || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.06em] text-slate-500">
                  Research Team (Faculty)
                </p>
                <p className="text-base whitespace-pre-line text-slate-700">
                  {selectedProject.faculty_team || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.06em] text-slate-500">
                  Research Team (Students)
                </p>
                <p className="text-base whitespace-pre-line text-slate-700">
                  {selectedProject.student_team || "-"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm uppercase tracking-[0.06em] text-slate-500">
                  Abstract
                </p>
                <p className="text-base text-slate-700">
                  {selectedProject.abstract || "-"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm uppercase tracking-[0.06em] text-slate-500">
                  Linked CKAN Resources
                </p>
                {!resourcePanel.syncEnabled ? (
                  <p className="mt-1 text-base text-slate-600">
                    CKAN sync is disabled in this environment.
                  </p>
                ) : resourcePanel.loading ? (
                  <p className="mt-1 text-base text-slate-600">
                    Loading linked resources...
                  </p>
                ) : resourcePanel.error ? (
                  <p className="mt-1 text-base text-red-700">
                    {resourcePanel.error}
                  </p>
                ) : resourcePanel.resources.length === 0 ? (
                  <p className="mt-1 text-base text-slate-600">
                    No linked CKAN resources found for this project.
                  </p>
                ) : (
                  <div className="mt-2 space-y-3">
                    <p className="text-sm text-slate-500">
                      Dataset:{" "}
                      <span className="font-semibold text-slate-700">
                        {resourcePanel.dataset?.title ||
                          resourcePanel.dataset?.name ||
                          "-"}
                      </span>
                    </p>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {resourcePanel.resources.map((resource) => (
                        <div
                          key={resource.id || resource.url || resource.name}
                          className="rounded-lg border border-slate-200 bg-slate-50/40 p-4"
                        >
                          <p className="truncate text-base font-semibold text-slate-900">
                            {resource.name || "Unnamed resource"}
                          </p>
                          <p className="text-sm text-slate-600">
                            Format: {resource.format || "-"} | Size:{" "}
                            {formatBytes(resource.size)} | Updated:{" "}
                            {formatDate(
                              resource.lastModified || resource.created,
                            )}
                          </p>
                          {resource.url ? (
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex text-sm font-semibold text-sky-700 hover:text-sky-800"
                            >
                              Open / Download
                            </a>
                          ) : (
                            <p className="mt-1 text-sm text-slate-500">
                              No resource URL available.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {editingProject ? (
        <div className="modal-overlay modal-overlay-centered">
          <div className="panel w-full max-w-6xl">
            <div className="panel-header flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
                Edit Project
              </h2>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setEditingProject(null)}
                disabled={savingEdit}
              >
                Close
              </button>
            </div>
            <div className="panel-body grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1 text-sm sm:col-span-2">
                <span className="font-semibold text-slate-700">
                  Project title
                </span>
                <input
                  className="control-input"
                  value={editForm.title}
                  onChange={(e) => handleEditField("title", e.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm sm:col-span-2">
                <span className="font-semibold text-slate-700">Abstract</span>
                <textarea
                  className="control-textarea min-h-28"
                  value={editForm.abstract}
                  onChange={(e) => handleEditField("abstract", e.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Year</span>
                <input
                  className="control-input"
                  value={editForm.year}
                  onChange={(e) => handleEditField("year", e.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Funding amount
                </span>
                <input
                  className="control-input"
                  value={editForm.funding_amount}
                  onChange={(e) =>
                    handleEditField("funding_amount", e.target.value)
                  }
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Industry partner
                </span>
                <input
                  className="control-input"
                  value={editForm.industry_partner}
                  onChange={(e) =>
                    handleEditField("industry_partner", e.target.value)
                  }
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Funding source
                </span>
                <input
                  className="control-input"
                  value={editForm.funding_source}
                  onChange={(e) =>
                    handleEditField("funding_source", e.target.value)
                  }
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Start date</span>
                <input
                  type="date"
                  className="control-input"
                  value={editForm.start_date}
                  onChange={(e) =>
                    handleEditField("start_date", e.target.value)
                  }
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">End date</span>
                <input
                  type="date"
                  className="control-input"
                  value={editForm.end_date}
                  onChange={(e) => handleEditField("end_date", e.target.value)}
                />
              </label>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditingProject(null)}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setConfirmSaveOpen(true)}
                  disabled={savingEdit}
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Delete Research Project"
        message={`Delete "${deleteTarget?.title || "Untitled"}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={Boolean(deletingProjectId)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteProject}
      />

      <ConfirmActionModal
        open={confirmSaveOpen}
        title="Save Project Changes"
        message="Apply these updates to this project now?"
        confirmLabel="Save"
        loading={savingEdit}
        onCancel={() => setConfirmSaveOpen(false)}
        onConfirm={async () => {
          setConfirmSaveOpen(false);
          await submitQuickEdit();
        }}
      />
    </section>
  );
}




