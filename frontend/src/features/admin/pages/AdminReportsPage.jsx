import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/shared/components/layout/PageHeader";
import EmptyState from "@/shared/components/feedback/EmptyState";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";
import PaginationControls from "@/shared/components/navigation/PaginationControls";
import { useToast } from "@/app/providers/ToastProvider";
import { toCsv } from "@/features/admin/utils";
import {
  createDefaultReportFilters,
  createIdNameMap,
  createProfileNameMap,
  filterProjects,
  getMovProjectIdSet,
  computeReportKpis,
  detectProjectAnomalies,
  buildProjectExportRows,
  getPresetDateRange,
  makeExportStamp,
  paginateItemsWithMeta,
  parseStoredReportFilters,
} from "@/features/admin/utils";
import {
  fetchReportProjectDetailBundle as fetchProjectDetailBundle,
  fetchProjectMovDocuments,
  fetchReportDataset,
  updateProjectVisibility as updateProjectVisibilityService,
  createMovSignedPreviewUrl,
} from "@/features/admin/services";

const REPORT_FILTERS_STORAGE_KEY = "arms_admin_report_filters_v1";
const REPORT_PREVIEW_PAGE_SIZE = 10;
const DATA_QUALITY_PAGE_SIZE = 10;

export default function AdminReportsPage() {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [publications, setPublications] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [movs, setMovs] = useState([]);
  const [centers, setCenters] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingByProject, setSavingByProject] = useState({});
  const [detailProjectId, setDetailProjectId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState({
    project: null,
    history: [],
    reviews: [],
  });
  const [movDrawer, setMovDrawer] = useState({
    open: false,
    loading: false,
    projectId: null,
    projectTitle: "",
    movs: [],
  });
  const [previewDoc, setPreviewDoc] = useState(null);
  const [filters, setFilters] = useState(createDefaultReportFilters());
  const [confirmVisibilityAction, setConfirmVisibilityAction] = useState(null);
  const [reportPreviewPage, setReportPreviewPage] = useState(1);
  const [dataQualityPage, setDataQualityPage] = useState(1);

  const loadData = async () => {
    setLoading(true);
    setError("");
    const {
      projectRes,
      publicationRes,
      profileRes,
      movRes,
      centerRes,
      departmentRes,
    } = await fetchReportDataset();

    if (projectRes.error) {
      setError(projectRes.error.message || "Unable to load reports.");
      setLoading(false);
      return;
    }

    setProjects(projectRes.data || []);
    setPublications(publicationRes.data || []);
    setProfiles(profileRes.data || []);
    setMovs(movRes.data || []);
    setCenters(centerRes.data || []);
    setDepartments(departmentRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(REPORT_FILTERS_STORAGE_KEY);
    setFilters((prev) => parseStoredReportFilters(raw, prev));
  }, []);

  useEffect(() => {
    localStorage.setItem(REPORT_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (previewDoc) {
        setPreviewDoc(null);
        return;
      }
      if (movDrawer.open) {
        setMovDrawer((prev) => ({ ...prev, open: false }));
        return;
      }
      if (detailProjectId) setDetailProjectId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailProjectId, movDrawer.open, previewDoc]);

  useEffect(() => {
    if (!error) return;
    toast.error("Load failed", error);
  }, [error, toast]);

  useEffect(() => {
    if (!message) return;
    toast.success("Export completed", message);
  }, [message, toast]);

  const centerMap = useMemo(() => createIdNameMap(centers), [centers]);
  const departmentMap = useMemo(
    () => createIdNameMap(departments),
    [departments],
  );
  const profileNameById = useMemo(
    () => createProfileNameMap(profiles),
    [profiles],
  );
  const filteredProjects = useMemo(
    () => filterProjects(projects, filters),
    [projects, filters],
  );
  const movProjectSet = useMemo(() => getMovProjectIdSet(movs), [movs]);
  const kpis = useMemo(
    () => computeReportKpis(filteredProjects, publications, profiles, movs),
    [filteredProjects, publications, profiles, movs],
  );
  const anomalies = useMemo(
    () => detectProjectAnomalies(filteredProjects, movProjectSet),
    [filteredProjects, movProjectSet],
  );
  const reportPreviewPagination = useMemo(
    () =>
      paginateItemsWithMeta(
        filteredProjects,
        reportPreviewPage,
        REPORT_PREVIEW_PAGE_SIZE,
      ),
    [filteredProjects, reportPreviewPage],
  );
  const dataQualityPagination = useMemo(
    () =>
      paginateItemsWithMeta(anomalies, dataQualityPage, DATA_QUALITY_PAGE_SIZE),
    [anomalies, dataQualityPage],
  );

  useEffect(() => {
    setReportPreviewPage(1);
  }, [
    filters.search,
    filters.year,
    filters.status,
    filters.center,
    filters.department,
    filters.dateFrom,
    filters.dateTo,
  ]);

  useEffect(() => {
    setDataQualityPage(1);
  }, [
    filters.search,
    filters.year,
    filters.status,
    filters.center,
    filters.department,
    filters.dateFrom,
    filters.dateTo,
  ]);

  const exportProjectsCsv = () => {
    const rows = buildProjectExportRows({
      projects: filteredProjects,
      filters,
      centerMap,
      departmentMap,
    });
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arms-project-report-${makeExportStamp()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Project report CSV exported.");
  };

  const updatePublicVisibility = async (
    projectId,
    nextVisible,
    confirmed = false,
  ) => {
    if (!confirmed) {
      setConfirmVisibilityAction({ projectId, nextVisible });
      return;
    }
    setError("");
    setMessage("");
    setSavingByProject((prev) => ({ ...prev, [projectId]: true }));

    const { data: updatedRow, error: updateError } =
      await updateProjectVisibilityService({
        projectId,
        nextVisible,
      });

    if (updateError) {
      setError(updateError.message || "Failed to update project visibility.");
      setSavingByProject((prev) => ({ ...prev, [projectId]: false }));
      return;
    }

    if (!updatedRow) {
      setError("No row updated. Check admin permissions/RLS.");
      setSavingByProject((prev) => ({ ...prev, [projectId]: false }));
      return;
    }

    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? { ...project, public_visible: updatedRow.public_visible }
          : project,
      ),
    );
    setSavingByProject((prev) => ({ ...prev, [projectId]: false }));
    setMessage(
      `Project visibility updated: ${updatedRow.public_visible ? "Public" : "Private"}.`,
    );
  };

  const exportAnomaliesPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });
    const margin = 40;
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    let y = margin;
    doc.setFontSize(14);
    doc.text("ARMS Data Quality Report", margin, y);
    y += 18;
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 16;
    doc.text(
      `Filter Window: ${filters.dateFrom || "all"} to ${filters.dateTo || "all"}`,
      margin,
      y,
    );
    y += 16;
    doc.text(`Findings: ${anomalies.length}`, margin, y);
    y += 16;
    doc.line(margin, y, width - margin, y);
    y += 10;

    if (anomalies.length === 0) {
      doc.text("No anomalies found for current filters.", margin, y);
    } else {
      anomalies.forEach((row, idx) => {
        const text = `${idx + 1}. ${row.project.title} (${row.project.status}, ${row.project.year}) - ${row.reason}`;
        const lines = doc.splitTextToSize(text, width - margin * 2);
        const blockHeight = lines.length * 12 + 8;
        if (y + blockHeight > height - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(lines, margin, y);
        y += blockHeight;
      });
    }
    doc.save(`arms-anomalies-${makeExportStamp()}.pdf`);
    setMessage("Data quality PDF exported.");
  };

  const openProjectDetails = async (projectId) => {
    setDetailProjectId(projectId);
    setDetailLoading(true);
    const { projectRes, historyRes, reviewRes } =
      await fetchProjectDetailBundle({
        projectId,
      });

    setDetailData({
      project: projectRes.data || null,
      history: historyRes.data || [],
      reviews: reviewRes.data || [],
    });
    setDetailLoading(false);
  };

  const openMovs = async (projectId, projectTitle) => {
    setMovDrawer({
      open: true,
      loading: true,
      projectId,
      projectTitle: projectTitle || "Project",
      movs: [],
    });

    const { data, error: movError } = await fetchProjectMovDocuments({
      projectId,
    });

    if (movError) {
      setError(movError.message || "Unable to load MOV files.");
      setMovDrawer((prev) => ({ ...prev, loading: false }));
      return;
    }

    setMovDrawer((prev) => ({ ...prev, loading: false, movs: data || [] }));
  };

  const previewMov = async (mov) => {
    setError("");
    if (!mov?.file_path) {
      setError("MOV file path is missing.");
      return;
    }
    const { data, error: signedUrlError } = await createMovSignedPreviewUrl({
      filePath: mov.file_path,
    });
    if (signedUrlError || !data?.signedUrl) {
      setError(signedUrlError?.message || "Unable to preview MOV.");
      return;
    }
    setPreviewDoc({
      name: mov.file_name,
      mimeType: mov.mime_type || "",
      url: data.signedUrl,
    });
  };

  const applyDatePreset = (preset) => {
    const nextRange = getPresetDateRange(preset);
    if (!nextRange) return;
    setFilters((prev) => ({ ...prev, ...nextRange }));
  };

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Admin Reports"
        description="Review monitoring KPIs, detect data quality issues, and export project reports."
      />

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <div className="kpi-card">
          <p className="kpi-label">Projects</p>
          <p className="kpi-value">{kpis.totalProjects}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Proposal</p>
          <p className="kpi-value">{kpis.proposal}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Ongoing</p>
          <p className="kpi-value">{kpis.ongoing}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Completed</p>
          <p className="kpi-value">{kpis.completed}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Publications</p>
          <p className="kpi-value">{kpis.totalPublications}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Affiliates</p>
          <p className="kpi-value">{kpis.totalAffiliates}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Active Users</p>
          <p className="kpi-value">{kpis.activeUsers}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">MOV Files</p>
          <p className="kpi-value">{kpis.totalMovs}</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body grid gap-2 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
          <input
            className="control-input"
            aria-label="Search project title"
            placeholder="Search project title"
            value={filters.search}
            onChange={(e) =>
              setFilters((p) => ({ ...p, search: e.target.value }))
            }
          />
          <input
            className="control-input"
            aria-label="Filter by year"
            placeholder="Year"
            value={filters.year}
            onChange={(e) =>
              setFilters((p) => ({ ...p, year: e.target.value }))
            }
          />
          <select
            className="control-select"
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) =>
              setFilters((p) => ({ ...p, status: e.target.value }))
            }
          >
            <option value="">All status</option>
            <option value="proposal">Proposal</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            className="control-select"
            aria-label="Filter by research center"
            value={filters.center}
            onChange={(e) =>
              setFilters((p) => ({ ...p, center: e.target.value }))
            }
          >
            <option value="">All centers</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="control-select"
            aria-label="Filter by department"
            value={filters.department}
            onChange={(e) =>
              setFilters((p) => ({ ...p, department: e.target.value }))
            }
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <input
            className="control-input"
            type="date"
            aria-label="Filter date from"
            value={filters.dateFrom}
            onChange={(e) =>
              setFilters((p) => ({ ...p, dateFrom: e.target.value }))
            }
          />
          <input
            className="control-input"
            type="date"
            aria-label="Filter date to"
            value={filters.dateTo}
            onChange={(e) =>
              setFilters((p) => ({ ...p, dateTo: e.target.value }))
            }
          />
          <button
            type="button"
            className="btn btn-outline"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <div className="panel-body flex flex-wrap gap-2 pt-0">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => applyDatePreset("30d")}
          >
            Last 30 Days
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => applyDatePreset("90d")}
          >
            Last 90 Days
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => applyDatePreset("ytd")}
          >
            Year To Date
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => applyDatePreset("all")}
          >
            Clear Date Range
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          onClick={exportProjectsCsv}
        >
          Export Projects CSV
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={exportAnomaliesPdf}
        >
          Export Anomalies PDF
        </button>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
            Report Preview ({filteredProjects.length} rows)
          </h2>
        </div>
        <div className="panel-body pt-0">
          {filteredProjects.length > 0 ? (
            <p className="mb-3 text-xs text-slate-500">
              Showing {reportPreviewPagination.start + 1}-
              {reportPreviewPagination.end} of{" "}
              {reportPreviewPagination.totalItems}
            </p>
          ) : null}
          {filteredProjects.length === 0 ? (
            <EmptyState
              title="No projects found"
              description="Adjust filters to view projects in the reporting preview."
            />
          ) : (
            <div className="max-h-[70vh] overflow-auto rounded-[var(--radius-sm)] border border-[var(--border)]">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Year</th>
                    <th>Submitted</th>
                    <th>Public Record</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reportPreviewPagination.items.map((project, index) => (
                    <tr key={project.id}>
                      <td>{reportPreviewPagination.start + index + 1}</td>
                      <td>{project.title}</td>
                      <td>
                        <span
                          className={`status-chip status-${project.status}`}
                        >
                          {project.status}
                        </span>
                      </td>
                      <td>{project.year}</td>
                      <td>
                        {project.submitted_at
                          ? new Date(project.submitted_at).toLocaleDateString()
                          : "-"}
                      </td>
                      <td>
                        <button
                          className="btn btn-outline"
                          disabled={Boolean(savingByProject[project.id])}
                          onClick={() =>
                            updatePublicVisibility(
                              project.id,
                              !project.public_visible,
                            )
                          }
                        >
                          {savingByProject[project.id]
                            ? "Saving..."
                            : project.public_visible
                              ? "Set Private"
                              : "Set Public"}
                        </button>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="btn btn-outline"
                            onClick={() => openProjectDetails(project.id)}
                          >
                            View Details
                          </button>
                          <button
                            className="btn btn-outline"
                            onClick={() => openMovs(project.id, project.title)}
                          >
                            Open MOVs
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredProjects.length > 0 ? (
            <PaginationControls
              page={reportPreviewPagination.page}
              totalPages={reportPreviewPagination.totalPages}
              onPageChange={setReportPreviewPage}
              className="mt-3"
            />
          ) : null}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
            Data Quality Findings ({anomalies.length})
          </h2>
        </div>
        <div className="panel-body">
          {anomalies.length > 0 ? (
            <p className="mb-3 text-xs text-slate-500">
              Showing {dataQualityPagination.start + 1}-
              {dataQualityPagination.end} of {dataQualityPagination.totalItems}
            </p>
          ) : null}
          {anomalies.length === 0 ? (
            <EmptyState
              title="No anomalies found"
              description="Current filtered projects passed the configured quality checks."
            />
          ) : (
            <div className="max-h-[70vh] overflow-auto app-card app-card-compact">
              <div className="space-y-2">
                {dataQualityPagination.items.map((row, index) => (
                  <div
                    key={`${row.project.id}-${dataQualityPagination.start + index}`}
                    className="app-card app-card-compact"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      No. {dataQualityPagination.start + index + 1}
                    </p>
                    <p className="font-semibold text-slate-900">
                      {row.project.title}
                    </p>
                    <p className="text-sm text-slate-600">
                      {row.project.status} | {row.project.year} | {row.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {anomalies.length > 0 ? (
            <PaginationControls
              page={dataQualityPagination.page}
              totalPages={dataQualityPagination.totalPages}
              onPageChange={setDataQualityPage}
              className="mt-3"
            />
          ) : null}
        </div>
      </div>

      {detailProjectId ? (
        <div
          className="modal-overlay"
          onClick={() => setDetailProjectId(null)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-reports-project-details-title"
            className="ml-auto h-full w-full max-w-2xl overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-4 sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3
                id="admin-reports-project-details-title"
                className="text-lg font-bold text-slate-900"
              >
                Project Details
              </h3>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDetailProjectId(null)}
              >
                Close
              </button>
            </div>
            {detailLoading || !detailData.project ? (
              <p className="text-sm text-slate-600">Loading details...</p>
            ) : (
              <div className="space-y-4">
                <div className="app-card app-card-compact">
                  <p className="font-semibold text-slate-900">
                    {detailData.project.title}
                  </p>
                  <p className="text-sm text-slate-600">
                    {detailData.project.status} | {detailData.project.year} |
                    Lead: {detailData.project.lead_researcher || "-"}
                  </p>
                  <p className="text-sm text-slate-600">
                    Submitted by:{" "}
                    {profileNameById[detailData.project.submitted_by] ||
                      "Unknown submitter"}
                  </p>
                  {detailData.project.abstract ? (
                    <p className="mt-2 text-sm text-slate-600">
                      {detailData.project.abstract}
                    </p>
                  ) : null}
                </div>
                <div className="app-card app-card-compact">
                  <p className="mb-2 text-sm font-semibold">Status Timeline</p>
                  {detailData.history.length === 0 ? (
                    <p className="text-sm text-slate-600">No timeline data.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {detailData.history.map((entry) => (
                        <li key={entry.id}>
                          {entry.old_status || "none"} {"->"} {entry.new_status}{" "}
                          on {new Date(entry.changed_at).toLocaleString()}
                          {entry.remarks ? ` (${entry.remarks})` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="app-card app-card-compact">
                  <p className="mb-2 text-sm font-semibold">Review History</p>
                  {detailData.reviews.length === 0 ? (
                    <p className="text-sm text-slate-600">No review records.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {detailData.reviews.map((entry) => (
                        <li key={entry.id}>
                          {entry.action} by{" "}
                          {profileNameById[entry.reviewer_id] ||
                            "Unknown reviewer"}{" "}
                          on {new Date(entry.created_at).toLocaleString()}
                          {entry.comments ? ` - ${entry.comments}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {movDrawer.open ? (
        <div
          className="modal-overlay"
          onClick={() => setMovDrawer((p) => ({ ...p, open: false }))}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-reports-mov-title"
            className="ml-auto h-full w-full max-w-2xl overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-4 sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3
                id="admin-reports-mov-title"
                className="text-lg font-bold text-slate-900"
              >
                MOV Files: {movDrawer.projectTitle}
              </h3>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setMovDrawer((p) => ({ ...p, open: false }))}
              >
                Close
              </button>
            </div>
            {movDrawer.loading ? (
              <p className="text-sm text-slate-600">Loading MOV files...</p>
            ) : movDrawer.movs.length === 0 ? (
              <p className="text-sm text-slate-600">No MOV files uploaded.</p>
            ) : (
              <div className="space-y-2">
                {movDrawer.movs.map((mov) => (
                  <div
                    key={mov.id}
                    className="app-card app-card-compact"
                  >
                    <p className="text-sm font-semibold">
                      v{mov.version_no} - {mov.file_name}{" "}
                      {mov.is_current ? "(current)" : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      {mov.uploaded_at
                        ? new Date(mov.uploaded_at).toLocaleString()
                        : "-"}
                    </p>
                    <div className="mt-2">
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => previewMov(mov)}
                      >
                        Preview / Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {previewDoc ? (
        <div
          className="modal-overlay modal-overlay-centered"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-reports-preview-title"
            className="mx-auto mt-8 w-full max-w-5xl rounded-[var(--radius-md)] border border-[var(--border)] bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
              <p
                id="admin-reports-preview-title"
                className="truncate text-sm font-semibold text-slate-900"
              >
                {previewDoc.name}
              </p>
              <div className="flex items-center gap-2">
                <a
                  className="btn btn-outline"
                  href={previewDoc.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setPreviewDoc(null)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[75vh] overflow-auto p-3">
              {previewDoc.mimeType.startsWith("image/") ? (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.name}
                  className="h-full w-full rounded-[var(--radius-sm)] object-contain"
                />
              ) : previewDoc.mimeType === "application/pdf" ? (
                <iframe
                  title={previewDoc.name}
                  src={previewDoc.url}
                  className="h-full w-full rounded-[var(--radius-sm)] border border-[var(--border)]"
                />
              ) : (
                <div className="flex h-full items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <p className="text-sm text-slate-700">
                    Inline preview is not supported for this file type. Use Open
                    to view/download.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmActionModal
        open={Boolean(confirmVisibilityAction)}
        title="Confirm Visibility Update"
        message={
          confirmVisibilityAction
            ? `${confirmVisibilityAction.nextVisible ? "Make" : "Set"} this project ${confirmVisibilityAction.nextVisible ? "public" : "private"}?`
            : ""
        }
        confirmLabel="Confirm"
        loading={Boolean(
          confirmVisibilityAction?.projectId &&
          savingByProject[confirmVisibilityAction.projectId],
        )}
        onCancel={() => setConfirmVisibilityAction(null)}
        onConfirm={async () => {
          if (!confirmVisibilityAction) return;
          await updatePublicVisibility(
            confirmVisibilityAction.projectId,
            confirmVisibilityAction.nextVisible,
            true,
          );
          setConfirmVisibilityAction(null);
        }}
      />
    </section>
  );
}





