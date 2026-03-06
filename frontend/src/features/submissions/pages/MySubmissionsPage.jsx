import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { useReferenceData } from "@/shared/hooks/useReferenceData";
import { normalizeStatus } from "@/shared/utils/status";
import {
  isAllowedMovMimeType,
  registerMovUpload,
} from "@/features/submissions/services";
import {
  createMovPreviewSignedUrl,
  fetchMovSummaryForProjects,
  fetchProjectMovDocuments,
  fetchProjectTimelineBundle,
  fetchReviewerProfiles,
  fetchUserProjects,
  uploadMovFileToStorage,
} from "@/features/submissions/services";
import {
  buildMovStoragePath,
  buildSubmissionAnalytics,
  buildSubmissionTasks,
  filterSubmissions,
  formatCurrency,
  isMovRequired,
  MAX_MOV_FILE_BYTES,
} from "@/features/submissions/utils";
import {
  DetailBlock,
  QualityChip,
  SectionPanel,
  TaskMetricCard,
} from "@/features/submissions/components";
import PageHeader from "@/shared/components/layout/PageHeader";
import EmptyState from "@/shared/components/feedback/EmptyState";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";
import { useToast } from "@/app/providers/ToastProvider";

const STATUS_OPTIONS = ["proposal", "ongoing", "completed", "rejected"];

export default function MySubmissionsPage() {
  const { user } = useAuth();
  const { centers, departments } = useReferenceData();
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "", year: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [movByProject, setMovByProject] = useState({});
  const [movCountByProject, setMovCountByProject] = useState({});
  const [files, setFiles] = useState({});
  const [uploadingByProject, setUploadingByProject] = useState({});
  const [previewDoc, setPreviewDoc] = useState(null);
  const [detailProjectId, setDetailProjectId] = useState(null);
  const [detailData, setDetailData] = useState({
    project: null,
    history: [],
    reviews: [],
  });
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewerNameById, setReviewerNameById] = useState({});
  const [confirmUploadAction, setConfirmUploadAction] = useState(null);
  const toast = useToast();

  useEffect(() => {
    if (error) toast.error("Action failed", error);
  }, [error, toast]);

  useEffect(() => {
    if (message) toast.success("Action completed", message);
  }, [message, toast]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const loadProjects = async () => {
    const { data, error: queryError } = await fetchUserProjects({
      userId: user.id,
    });

    if (queryError) {
      setError(queryError.message);
      return;
    }

    const rows = data || [];
    setProjects(rows);

    const { data: movSummaryRows } = await fetchMovSummaryForProjects({
      projectIds: rows.map((row) => row.id),
    });
    const nextCounts = {};
    (movSummaryRows || []).forEach((row) => {
      nextCounts[row.project_id] = (nextCounts[row.project_id] || 0) + 1;
    });
    setMovCountByProject(nextCounts);
  };

  const loadMovsForProject = async (projectId) => {
    const { data, error: movError } = await fetchProjectMovDocuments({
      projectId,
    });

    if (movError) {
      setError(movError.message || "Unable to load MOV files.");
      return;
    }

    setMovByProject((prev) => ({ ...prev, [projectId]: data || [] }));
    setMovCountByProject((prev) => ({
      ...prev,
      [projectId]: (data || []).length,
    }));
  };

  useEffect(() => {
    if (user?.id) loadProjects();
  }, [user?.id]);

  const filtered = useMemo(
    () => filterSubmissions(projects, filters),
    [projects, filters],
  );
  const analytics = useMemo(
    () => buildSubmissionAnalytics(projects),
    [projects],
  );
  const tasks = useMemo(() => buildSubmissionTasks(projects), [projects]);

  const centerById = useMemo(
    () =>
      centers.reduce((acc, center) => {
        acc[center.id] = center.name;
        return acc;
      }, {}),
    [centers],
  );

  const departmentById = useMemo(
    () =>
      departments.reduce((acc, department) => {
        acc[department.id] = department.name;
        return acc;
      }, {}),
    [departments],
  );

  const detailProject = useMemo(
    () => projects.find((project) => project.id === detailProjectId) || null,
    [projects, detailProjectId],
  );

  const uploadMov = async (projectId, confirmed = false) => {
    setError("");
    setMessage("");
    if (!user?.id) {
      setError("Your session expired. Please login again.");
      return;
    }

    const file = files[projectId];
    if (!file) {
      setError("Please choose a file first.");
      return;
    }
    if (!isAllowedMovMimeType(file.type)) {
      setError("Invalid file type. Allowed: PDF, DOCX, XLSX, PNG, JPG.");
      return;
    }
    if (file.size > MAX_MOV_FILE_BYTES) {
      setError("File exceeds 25MB limit.");
      return;
    }
    if (!confirmed) {
      setConfirmUploadAction({
        projectId,
        fileName: file.name,
      });
      return;
    }

    setUploadingByProject((prev) => ({ ...prev, [projectId]: true }));

    const storagePath = buildMovStoragePath(projectId, file.name);

    const { error: uploadError } = await uploadMovFileToStorage({
      storagePath,
      file,
      contentType: file.type,
    });

    if (uploadError) {
      setError(uploadError.message);
      setUploadingByProject((prev) => ({ ...prev, [projectId]: false }));
      return;
    }

    const { error: docError } = await registerMovUpload({
      projectId,
      userId: user.id,
      fileName: file.name,
      filePath: uploaded?.path || storagePath,
      mimeType: file.type,
      fileSize: file.size,
    });

    if (docError) {
      setError(docError.message);
      setUploadingByProject((prev) => ({ ...prev, [projectId]: false }));
      return;
    }

    setUploadingByProject((prev) => ({ ...prev, [projectId]: false }));
    setMessage("MOV uploaded successfully.");
    setFiles((prev) => ({ ...prev, [projectId]: null }));
    await loadMovsForProject(projectId);
  };

  const previewMov = async (mov) => {
    setError("");
    const { data, error: signedUrlError } = await createMovPreviewSignedUrl({
      filePath: mov.file_path,
    });
    if (signedUrlError || !data?.signedUrl) {
      setError(signedUrlError?.message || "Unable to open MOV preview.");
      return;
    }
    setPreviewDoc({
      name: mov.file_name,
      mimeType: mov.mime_type || "",
      url: data.signedUrl,
    });
  };

  const openTimeline = async (projectId) => {
    setDetailProjectId(projectId);
    setDetailLoading(true);
    const { projectRes, historyRes, reviewRes } =
      await fetchProjectTimelineBundle({
        projectId,
      });
    setDetailData({
      project: projectRes.data || null,
      history: historyRes.data || [],
      reviews: reviewRes.data || [],
    });

    const reviewerIds = [
      ...new Set(
        (reviewRes.data || [])
          .map((entry) => entry.reviewer_id)
          .filter(Boolean),
      ),
    ];
    if (reviewerIds.length > 0) {
      const { data: reviewerRows } = await fetchReviewerProfiles({
        reviewerIds,
      });
      setReviewerNameById((prev) => {
        const next = { ...prev };
        (reviewerRows || []).forEach((row) => {
          next[row.id] = row.full_name || row.email || "Unknown reviewer";
        });
        return next;
      });
    }

    setDetailLoading(false);
  };

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="My Submissions"
        description="Track proposals, upload MOV versions, revise rejected entries, and monitor your deadlines."
      />
      <div className="flex flex-wrap gap-2">
        <Link className="btn btn-primary" to="/submit-affiliation">
          Open Research Projects
        </Link>
        <Link className="btn btn-outline" to="/publications">
          Manage Publications
        </Link>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {Object.entries(analytics).map(([key, value]) => (
          <div key={key} className="kpi-card">
            <p className="kpi-label capitalize">{key}</p>
            <p className="kpi-value">{value}</p>
          </div>
        ))}
      </div>

      <SectionPanel
        title="My Tasks"
        bodyClassName="panel-body grid gap-3 sm:grid-cols-3"
      >
        <TaskMetricCard
          label="Revise Rejected"
          value={tasks.rejected.length}
          hint="Update and resubmit for review."
        />
        <TaskMetricCard
          label="Pending Approval"
          value={tasks.proposals.length}
          hint="Proposals awaiting admin decision."
        />
        <TaskMetricCard
          label="Due Soon"
          value={tasks.dueSoon.length}
          hint="Ongoing projects due within 14 days."
        />
      </SectionPanel>

      <SectionPanel bodyClassName="panel-body grid gap-3 sm:grid-cols-3">
        <input
          className="control-input"
          placeholder="Search title"
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
        />
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
      </SectionPanel>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <EmptyState
            title="No submissions found"
            description="Try adjusting your filters or submit a new affiliation proposal."
          />
        ) : null}
        {filtered.map((project) => {
          const status = normalizeStatus(project.status);
          const hasMov = Boolean(movCountByProject[project.id]);
          const hasOutputs = Boolean(project.expected_outputs);
          const isPublicReady =
            hasMov &&
            hasOutputs &&
            Boolean(project.abstract) &&
            ["ongoing", "completed"].includes(status);

          return (
            <article
              key={project.id}
              className="panel overflow-hidden border-l-4 border-l-[var(--border-strong)]"
            >
              <div className="panel-body space-y-4">
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-slate-900">
                      {project.title}
                    </h2>
                    <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-500">
                      {project.year || "-"} | {status} |{" "}
                      {centerById[project.research_center_id] ||
                        "Unknown Center"}{" "}
                      |{" "}
                      {departmentById[project.department_id] ||
                        "Unknown Department"}
                    </p>
                  </div>
                  <span className={`status-chip status-${status}`}>
                    {status}
                  </span>
                </header>

                <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <p>
                    <span className="font-medium text-slate-700">
                      Submitted:
                    </span>{" "}
                    {project.submitted_at
                      ? new Date(project.submitted_at).toLocaleDateString()
                      : "-"}
                  </p>
                  <p>
                    <span className="font-medium text-slate-700">Lead:</span>{" "}
                    {project.lead_researcher || "-"}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="font-medium text-slate-700">Partner:</span>{" "}
                    {project.industry_partner || "-"}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="font-medium text-slate-700">
                      Funding Amount:
                    </span>{" "}
                    {formatCurrency(project.funding_amount)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                  <QualityChip
                    ok={hasMov}
                    positiveLabel="Has MOV"
                    negativeLabel="No MOV"
                  />
                  <QualityChip
                    ok={hasOutputs}
                    positiveLabel="Has outputs"
                    negativeLabel="No outputs"
                  />
                  <QualityChip
                    ok={isPublicReady}
                    positiveLabel="Public-ready"
                    negativeLabel="Needs enrichment"
                  />
                </div>

                <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                  <button
                    className="btn btn-outline"
                    onClick={() => openTimeline(project.id)}
                  >
                    View Details
                  </button>
                  {["proposal", "rejected"].includes(status) ? (
                    <Link
                      className="btn btn-outline"
                      to={`/submit-affiliation/submit?edit=${project.id}`}
                    >
                      Revise Proposal
                    </Link>
                  ) : null}
                </div>

                <div className="app-card-muted app-card-compact">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                    MOV Manager
                  </p>
                  {!isMovRequired(project) ? (
                    <p className="mt-2 text-sm text-slate-600">
                      MOV uploads are typically required once a project is
                      ongoing/completed.
                    </p>
                  ) : (
                    <>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                        <input
                          className="control-input"
                          type="file"
                          title="Choose MOV file (PDF, DOCX, XLSX, PNG, JPG)"
                          onChange={(e) =>
                            setFiles((prev) => ({
                              ...prev,
                              [project.id]: e.target.files?.[0] || null,
                            }))
                          }
                        />
                        <button
                          className="btn btn-outline"
                          onClick={() => loadMovsForProject(project.id)}
                        >
                          Refresh MOV List
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={() => uploadMov(project.id)}
                          disabled={Boolean(uploadingByProject[project.id])}
                        >
                          {uploadingByProject[project.id]
                            ? "Uploading..."
                            : "Upload MOV"}
                        </button>
                      </div>
                      <div className="mt-3 space-y-1 text-sm">
                        {(movByProject[project.id] || []).map((mov) => (
                          <div
                            key={mov.id}
                            className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-2"
                          >
                            <span>
                              v{mov.version_no} - {mov.file_name}{" "}
                              {mov.is_current ? "(current)" : ""}
                            </span>
                            <button
                              className="btn btn-outline"
                              onClick={() => previewMov(mov)}
                            >
                              Preview
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {detailProjectId ? (
        <div className="modal-overlay" onClick={() => setDetailProjectId(null)}>
          <aside
            className="ml-auto h-full w-full max-w-2xl overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-4 sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                Proposal Details
              </h3>
              <button
                className="btn btn-outline"
                onClick={() => setDetailProjectId(null)}
              >
                Close
              </button>
            </div>
            {detailLoading ? (
              <p className="text-sm text-slate-600">Loading timeline...</p>
            ) : (
              <div className="space-y-4">
                <DetailBlock title="Proposal Snapshot">
                  {detailData.project || detailProject ? (
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      {(() => {
                        const currentProject =
                          detailData.project || detailProject;
                        return (
                          <>
                            <div>
                              <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                                Title
                              </dt>
                              <dd className="font-medium text-slate-800">
                                {currentProject.title || "-"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                                Year / Status
                              </dt>
                              <dd className="font-medium text-slate-800">
                                {currentProject.year || "-"} /{" "}
                                {normalizeStatus(currentProject.status)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                                Center
                              </dt>
                              <dd className="font-medium text-slate-800">
                                {centerById[
                                  currentProject.research_center_id
                                ] || "-"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                                Department
                              </dt>
                              <dd className="font-medium text-slate-800">
                                {departmentById[currentProject.department_id] ||
                                  "-"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                                Date Range
                              </dt>
                              <dd className="font-medium text-slate-800">
                                {currentProject.start_date
                                  ? new Date(
                                      currentProject.start_date,
                                    ).toLocaleDateString()
                                  : "-"}{" "}
                                -{" "}
                                {currentProject.end_date
                                  ? new Date(
                                      currentProject.end_date,
                                    ).toLocaleDateString()
                                  : "-"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                                Funding
                              </dt>
                              <dd className="font-medium text-slate-800">
                                {currentProject.funding_type || "-"} /{" "}
                                {currentProject.funding_source || "-"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                                Funding Amount
                              </dt>
                              <dd className="font-medium text-slate-800">
                                {formatCurrency(currentProject.funding_amount)}
                              </dd>
                            </div>
                            <div className="sm:col-span-2">
                              <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                                Abstract
                              </dt>
                              <dd className="font-medium text-slate-800">
                                {currentProject.abstract || "-"}
                              </dd>
                            </div>
                            <div className="sm:col-span-2">
                              <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                                Expected Outputs
                              </dt>
                              <dd className="font-medium text-slate-800">
                                {currentProject.expected_outputs || "-"}
                              </dd>
                            </div>
                          </>
                        );
                      })()}
                    </dl>
                  ) : (
                    <p className="text-sm text-slate-600">
                      Project details unavailable.
                    </p>
                  )}
                </DetailBlock>

                <DetailBlock title="Status History">
                  {detailData.history.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      No status history available.
                    </p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {detailData.history.map((entry) => (
                        <li key={entry.id}>
                          {entry.old_status || "none"} {"->"} {entry.new_status}{" "}
                          on {new Date(entry.changed_at).toLocaleString()}
                          {entry.remarks ? ` (${entry.remarks})` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </DetailBlock>
                <DetailBlock title="Review Actions">
                  {detailData.reviews.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      No review actions yet.
                    </p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {detailData.reviews.map((entry) => (
                        <li key={entry.id}>
                          {entry.action} by{" "}
                          {reviewerNameById[entry.reviewer_id] ||
                            "Unknown reviewer"}{" "}
                          on {new Date(entry.created_at).toLocaleString()}
                          {entry.comments ? ` - ${entry.comments}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </DetailBlock>
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
            className="mx-auto mt-8 w-full max-w-5xl rounded-[var(--radius-md)] border border-[var(--border)] bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                {previewDoc.name}
              </p>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <a
                  className="btn btn-outline"
                  href={previewDoc.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
                <button
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
        open={Boolean(confirmUploadAction)}
        title="Confirm MOV Upload"
        message={
          confirmUploadAction
            ? `Upload MOV file "${confirmUploadAction.fileName}" for this project?`
            : ""
        }
        confirmLabel="Upload"
        loading={Boolean(
          confirmUploadAction?.projectId &&
          uploadingByProject[confirmUploadAction.projectId],
        )}
        onCancel={() => setConfirmUploadAction(null)}
        onConfirm={async () => {
          if (!confirmUploadAction?.projectId) return;
          await uploadMov(confirmUploadAction.projectId, true);
          setConfirmUploadAction(null);
        }}
      />
    </section>
  );
}
