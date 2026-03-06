import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import PageHeader from "@/shared/components/layout/PageHeader";
import EmptyState from "@/shared/components/feedback/EmptyState";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";
import { useToast } from "@/app/providers/ToastProvider";
import { logAdminActivity } from "@/features/admin/utils";
import { reviewSubmissionDecision } from "@/features/admin/services";
import {
  assignReviewerToProject,
  fetchReviewQueueProjectDetailBundle as fetchProjectDetailBundle,
  markProjectCompleted,
  fetchReviewedTodayCount,
  fetchReviewQueueSnapshot,
} from "@/features/admin/services";
import {
  daysSince,
  dueWithinDays,
  getDiffRows,
  hasInvalidDates,
  isMissingAbstract,
  normalizeStatus,
  toMapById,
} from "@/features/admin/utils";

export default function AdminReviewQueuePage() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState([]);
  const [statusSummary, setStatusSummary] = useState({});
  const [comments, setComments] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState({});
  const [filters, setFilters] = useState({
    search: "",
    center: "",
    department: "",
    year: "",
    workflow: "proposal",
    submittedWindow: "all",
    priority: "all",
    assignedToMe: false,
  });
  const [centers, setCenters] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [reviewedTodayCount, setReviewedTodayCount] = useState(0);
  const [auditPreviewByProject, setAuditPreviewByProject] = useState({});
  const [latestEditByProject, setLatestEditByProject] = useState({});
  const [assignments, setAssignments] = useState({});
  const [reviewerNameById, setReviewerNameById] = useState({});
  const [submitterNameById, setSubmitterNameById] = useState({});
  const [editorNameById, setEditorNameById] = useState({});
  const [decisionModal, setDecisionModal] = useState(null);
  const [decisionComment, setDecisionComment] = useState("");
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [completeModal, setCompleteModal] = useState(null);
  const [completeRemarks, setCompleteRemarks] = useState("");
  const [completeLoading, setCompleteLoading] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState({
    project: null,
    movs: [],
    history: [],
    reviews: [],
  });
  const [previewDoc, setPreviewDoc] = useState(null);
  const [confirmAssignAction, setConfirmAssignAction] = useState(null);
  const isLoadingRef = useRef(false);
  const toast = useToast();

  useEffect(() => {
    if (error) toast.error("Review action failed", error);
  }, [error, toast]);

  useEffect(() => {
    if (message) toast.success("Review action completed", message);
  }, [message, toast]);

  const loadQueue = async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const snapshot = await fetchReviewQueueSnapshot();
      setStatusSummary(snapshot.statusSummary);
      setItems(snapshot.items);
      setCenters(snapshot.centers);
      setDepartments(snapshot.departments);
      setAssignments(snapshot.assignments);
      setReviewerNameById(snapshot.reviewerNameById);
      setSubmitterNameById(snapshot.submitterNameById);
      setAuditPreviewByProject(snapshot.auditPreviewByProject);
      setLatestEditByProject(snapshot.latestEditByProject);
      setEditorNameById(snapshot.editorNameById);
    } catch (loadError) {
      setError(loadError.message || "Unable to load review queue.");
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  useEffect(() => {
    loadQueue();
    const timer = window.setInterval(() => {
      void loadQueue();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetchReviewedTodayCount(user.id).then((count) =>
      setReviewedTodayCount(count),
    );
  }, [user?.id, message]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (previewDoc) {
        setPreviewDoc(null);
        return;
      }
      if (detailItem) {
        setDetailItem(null);
        return;
      }
      if (completeModal) {
        setCompleteModal(null);
        return;
      }
      if (decisionModal) setDecisionModal(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [completeModal, decisionModal, detailItem, previewDoc]);

  const centerById = useMemo(() => toMapById(centers), [centers]);
  const departmentById = useMemo(() => toMapById(departments), [departments]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const title = String(item.title || "").toLowerCase();
      if (filters.search && !title.includes(filters.search.toLowerCase()))
        return false;
      if (
        filters.workflow !== "all" &&
        normalizeStatus(item.status) !== filters.workflow
      ) {
        return false;
      }
      if (filters.center && item.research_center_id !== filters.center)
        return false;
      if (filters.department && item.department_id !== filters.department)
        return false;
      if (filters.year && String(item.year) !== filters.year) return false;

      const submittedAt = new Date(item.submitted_at || item.updated_at || 0);
      if (filters.submittedWindow === "today") {
        const now = new Date();
        if (
          submittedAt.getFullYear() !== now.getFullYear() ||
          submittedAt.getMonth() !== now.getMonth() ||
          submittedAt.getDate() !== now.getDate()
        ) {
          return false;
        }
      }
      if (filters.submittedWindow === "week") {
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - submittedAt.getTime() > sevenDaysMs) return false;
      }

      if (filters.priority === "high" && daysSince(item.submitted_at) <= 7)
        return false;
      if (filters.assignedToMe && assignments[item.id] !== user?.id)
        return false;
      return true;
    });
  }, [items, filters, assignments, user?.id]);

  const selectedIdList = useMemo(
    () => Object.keys(selectedIds).filter((id) => selectedIds[id]),
    [selectedIds],
  );
  const selectedProposalIds = useMemo(
    () =>
      selectedIdList.filter((id) => {
        const item = items.find((row) => row.id === id);
        return item && normalizeStatus(item.status) === "proposal";
      }),
    [selectedIdList, items],
  );
  const workflowLabel = useMemo(() => {
    if (filters.workflow === "proposal") return "proposals";
    if (filters.workflow === "ongoing") return "ongoing projects";
    if (filters.workflow === "completed") return "completed projects";
    return "actionable items";
  }, [filters.workflow]);

  const summaryMetrics = useMemo(() => {
    const pending = items.length;
    const highPriority = items.filter(
      (row) => daysSince(row.submitted_at) > 7,
    ).length;
    const dueSoon = items.filter((row) =>
      dueWithinDays(row.end_date, 14),
    ).length;
    const assignedToMe = items.filter(
      (row) => assignments[row.id] === user?.id,
    ).length;
    return {
      pending,
      highPriority,
      dueSoon,
      reviewedToday: reviewedTodayCount,
      assignedToMe,
    };
  }, [items, assignments, reviewedTodayCount, user?.id]);

  const decisionPreview = useMemo(() => {
    if (!decisionModal?.targetIds?.length) return null;
    const firstId = decisionModal.targetIds[0];
    const target = items.find((row) => row.id === firstId) || null;
    const audit = auditPreviewByProject[firstId] || [];
    const latestEdit = latestEditByProject[firstId] || null;
    const diffCount = getDiffRows(
      latestEdit?.old_values,
      latestEdit?.new_values,
    ).length;
    return {
      target,
      audit,
      diffCount,
    };
  }, [decisionModal, items, auditPreviewByProject, latestEditByProject]);

  const completionPreview = useMemo(() => {
    if (!completeModal?.projectId) return null;
    const target =
      items.find((row) => row.id === completeModal.projectId) || null;
    const audit = auditPreviewByProject[completeModal.projectId] || [];
    return { target, audit };
  }, [completeModal, items, auditPreviewByProject]);

  const openDecisionModal = (action, targetIds) => {
    setDecisionComment("");
    setDecisionModal({
      action,
      targetIds,
      targetCount: targetIds.length,
    });
  };

  const runReview = async (projectId, action, comment) => {
    const rpcError = await reviewSubmissionDecision({
      projectId,
      action,
      comments: comment,
    });
    return rpcError;
  };

  const confirmDecision = async () => {
    if (!decisionModal) return;
    const { action, targetIds } = decisionModal;
    if (action === "reject" && !decisionComment.trim()) {
      setError("Rejection reason is required.");
      return;
    }

    setDecisionLoading(true);
    setError("");
    setMessage("");

    const failures = [];
    for (const id of targetIds) {
      const perItemComment = comments[id] || decisionComment;
      const err = await runReview(id, action, perItemComment);
      if (err) failures.push({ id, message: err.message || "Unknown error" });
    }

    setDecisionLoading(false);
    setDecisionModal(null);
    setSelectedIds({});

    if (failures.length > 0) {
      setError(
        `${failures.length} of ${targetIds.length} action(s) failed. First error: ${failures[0].message}`,
      );
    } else {
      setMessage(
        `${action === "approve" ? "Approved" : "Rejected"} ${targetIds.length} proposal(s) successfully.`,
      );
    }
    await loadQueue();
  };

  const openDetailDrawer = async (projectId) => {
    void logAdminActivity("proposal_detail_viewed", "project", projectId, {});
    setDetailItem(projectId);
    setDetailLoading(true);
    const detailBundle = await fetchProjectDetailBundle(projectId);
    setDetailData(detailBundle.detailData);
    setReviewerNameById((prev) => ({
      ...prev,
      ...detailBundle.reviewerNameById,
    }));
    setDetailLoading(false);
  };

  const toggleSelectAllVisible = () => {
    const shouldSelectAll = filteredItems.some((row) => !selectedIds[row.id]);
    const next = { ...selectedIds };
    filteredItems.forEach((row) => {
      next[row.id] = shouldSelectAll;
    });
    setSelectedIds(next);
  };

  const previewMov = async (mov) => {
    setError("");
    if (!mov?.file_path) {
      setError("MOV file path is missing. Cannot preview file.");
      return;
    }
    if (
      !String(mov.file_path).startsWith("http") &&
      !String(mov.file_path).startsWith("blob:")
    ) {
      setError(
        "MOV preview is unavailable for this stored path in local mode.",
      );
      return;
    }

    setPreviewDoc({
      name: mov.file_name,
      mimeType: mov.mime_type || "",
      url: mov.file_path,
    });
  };

  const assignReviewer = async (projectId, confirmed = false) => {
    if (!confirmed) {
      setConfirmAssignAction({ projectId });
      return;
    }
    setError("");
    setMessage("");
    if (!user?.id) {
      setError("Your session has expired. Please log in again.");
      return;
    }
    try {
      await assignReviewerToProject({ projectId, reviewerId: user.id });
    } catch (rpcError) {
      setError(rpcError.message || "Unable to update reviewer assignment.");
      return;
    }
    setAssignments((prev) => ({ ...prev, [projectId]: user.id }));
    setMessage(
      `Reviewer assigned to ${profile?.full_name || "current account"}.`,
    );
  };

  const openCompleteModal = (projectId) => {
    setCompleteRemarks("");
    setCompleteModal({ projectId });
  };

  const confirmMarkCompleted = async () => {
    if (!completeModal?.projectId) return;
    setCompleteLoading(true);
    setError("");
    setMessage("");

    const result = await markProjectCompleted({
      projectId: completeModal.projectId,
    });

    if (!result?.data?.id) {
      setError("Unable to mark project as completed.");
      setCompleteLoading(false);
      return;
    }

    await logAdminActivity(
      "project_completed",
      "project",
      completeModal.projectId,
      {
        old_status: "ongoing",
        new_status: "completed",
        remarks: completeRemarks.trim() || null,
      },
    );

    setCompleteLoading(false);
    setCompleteModal(null);
    setMessage("Project marked as completed.");
    await loadQueue();
  };

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Admin Review Queue"
        description="Manage proposal, ongoing, and completed workflows with reviewer assignment and full audit visibility."
      />

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <div className="kpi-card">
          <p className="kpi-label">Pending Queue</p>
          <p className="kpi-value">{summaryMetrics.pending}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">High Priority (&gt;7 days)</p>
          <p className="kpi-value">{summaryMetrics.highPriority}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Due Soon (14 days)</p>
          <p className="kpi-value">{summaryMetrics.dueSoon}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Reviewed Today</p>
          <p className="kpi-value">{summaryMetrics.reviewedToday}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Assigned To Me</p>
          <p className="kpi-value">{summaryMetrics.assignedToMe}</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`btn ${filters.workflow === "proposal" ? "btn-primary" : "btn-outline"}`}
              onClick={() =>
                setFilters((p) => ({ ...p, workflow: "proposal" }))
              }
            >
              Proposal
            </button>
            <button
              className={`btn ${filters.workflow === "ongoing" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setFilters((p) => ({ ...p, workflow: "ongoing" }))}
            >
              Ongoing
            </button>
            <button
              className={`btn ${filters.workflow === "completed" ? "btn-primary" : "btn-outline"}`}
              onClick={() =>
                setFilters((p) => ({ ...p, workflow: "completed" }))
              }
            >
              Completed
            </button>
            <button
              className={`btn ${filters.workflow === "all" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setFilters((p) => ({ ...p, workflow: "all" }))}
            >
              All Actionable
            </button>
            <button
              className={`btn ${filters.submittedWindow === "all" ? "btn-primary" : "btn-outline"}`}
              onClick={() =>
                setFilters((p) => ({ ...p, submittedWindow: "all" }))
              }
            >
              All
            </button>
            <button
              className={`btn ${filters.submittedWindow === "today" ? "btn-primary" : "btn-outline"}`}
              onClick={() =>
                setFilters((p) => ({ ...p, submittedWindow: "today" }))
              }
            >
              Submitted Today
            </button>
            <button
              className={`btn ${filters.submittedWindow === "week" ? "btn-primary" : "btn-outline"}`}
              onClick={() =>
                setFilters((p) => ({ ...p, submittedWindow: "week" }))
              }
            >
              Submitted This Week
            </button>
            <button
              className={`btn ${filters.priority === "high" ? "btn-primary" : "btn-outline"}`}
              onClick={() =>
                setFilters((p) => ({
                  ...p,
                  priority: p.priority === "high" ? "all" : "high",
                }))
              }
            >
              High Priority
            </button>
            <button
              className={`btn ${filters.assignedToMe ? "btn-primary" : "btn-outline"}`}
              onClick={() =>
                setFilters((p) => ({ ...p, assignedToMe: !p.assignedToMe }))
              }
            >
              Assigned to Me
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <input
              className="control-input"
              placeholder="Search proposal title"
              value={filters.search}
              onChange={(e) =>
                setFilters((p) => ({ ...p, search: e.target.value }))
              }
            />
            <select
              className="control-select"
              value={filters.center}
              onChange={(e) =>
                setFilters((p) => ({ ...p, center: e.target.value }))
              }
            >
              <option value="">All centers</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
            <select
              className="control-select"
              value={filters.department}
              onChange={(e) =>
                setFilters((p) => ({ ...p, department: e.target.value }))
              }
            >
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <input
              className="control-input"
              placeholder="Year"
              value={filters.year}
              onChange={(e) =>
                setFilters((p) => ({ ...p, year: e.target.value }))
              }
            />
            <button
              className="btn btn-outline"
              onClick={loadQueue}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh queue"}
            </button>
          </div>
        </div>
      </div>

      {selectedIdList.length > 0 ? (
        <div className="panel border-blue-200 bg-blue-50">
          <div className="panel-body flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-blue-900">
              {selectedIdList.length} item(s) selected
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-primary"
                onClick={() =>
                  openDecisionModal("approve", selectedProposalIds)
                }
                disabled={selectedProposalIds.length === 0}
              >
                Bulk Approve
              </button>
              <button
                className="btn btn-danger-outline"
                onClick={() => openDecisionModal("reject", selectedProposalIds)}
                disabled={selectedProposalIds.length === 0}
              >
                Bulk Reject
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setSelectedIds({})}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {!loading && filteredItems.length === 0 && (
          <EmptyState
            title={`No ${workflowLabel} found`}
            description={
              Object.keys(statusSummary).length > 0
                ? `Current statuses: ${Object.entries(statusSummary)
                    .map(([status, count]) => `${status} (${count})`)
                    .join(", ")}`
                : "Items will appear here when records match the selected workflow."
            }
          />
        )}

        {!loading && filteredItems.length > 0 ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Showing {filteredItems.length} {workflowLabel}
            </p>
            <button
              className="btn btn-outline"
              onClick={toggleSelectAllVisible}
            >
              Toggle Select Visible
            </button>
          </div>
        ) : null}

        {loading && (
          <div className="panel">
            <div className="panel-body text-sm text-slate-600">
              Loading pending proposals...
            </div>
          </div>
        )}

        {filteredItems.map((item) => {
          const ageDays = daysSince(item.submitted_at || item.updated_at);
          const agingClass =
            ageDays > 7
              ? "status-rejected"
              : ageDays >= 3
                ? "status-proposal"
                : "status-ongoing";
          const auditPreview = auditPreviewByProject[item.id] || [];
          const latestEdit = latestEditByProject[item.id] || null;
          const diffRows = getDiffRows(
            latestEdit?.old_values,
            latestEdit?.new_values,
          );
          const missingAbstract = isMissingAbstract(item);
          const invalidDates = hasInvalidDates(item);
          const hasOutputs = Boolean(
            String(item.expected_outputs || "").trim(),
          );

          return (
            <article key={item.id} className="panel">
              <div className="panel-body">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedIds[item.id])}
                        onChange={(e) =>
                          setSelectedIds((prev) => ({
                            ...prev,
                            [item.id]: e.target.checked,
                          }))
                        }
                      />
                      <h2 className="truncate font-semibold">{item.title}</h2>
                      <span
                        className={`status-chip ${
                          normalizeStatus(item.status) === "proposal"
                            ? "status-proposal"
                            : normalizeStatus(item.status) === "ongoing"
                              ? "status-ongoing"
                              : "status-completed"
                        }`}
                      >
                        {normalizeStatus(item.status) === "proposal"
                          ? "Proposal"
                          : normalizeStatus(item.status) === "ongoing"
                            ? "Ongoing"
                            : "Completed"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Submitted by:{" "}
                      {submitterNameById[item.submitted_by] ||
                        "Unknown submitter"}
                    </p>
                    <p className="text-sm text-slate-600">
                      Lead researcher: {item.lead_researcher || "-"}
                    </p>
                    <p className="text-sm text-slate-600">
                      Year: {item.year} | Center:{" "}
                      {centerById[item.research_center_id]?.name || "-"} |
                      Department:{" "}
                      {departmentById[item.department_id]?.name || "-"}
                    </p>
                    <p className="text-sm text-slate-600">
                      Submitted:{" "}
                      {item.submitted_at
                        ? new Date(item.submitted_at).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-2">
                    <span className={`status-chip ${agingClass}`}>
                      Aging: {ageDays}d
                    </span>
                    {dueWithinDays(item.end_date, 14) ? (
                      <span className="status-chip status-proposal">
                        Due within 14 days
                      </span>
                    ) : null}
                    {missingAbstract ? (
                      <span className="status-chip status-rejected">
                        Risk: Missing abstract
                      </span>
                    ) : null}
                    {invalidDates ? (
                      <span className="status-chip status-rejected">
                        Risk: Invalid dates
                      </span>
                    ) : null}
                    {!hasOutputs ? (
                      <span className="status-chip status-proposal">
                        Risk: Missing outputs
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr]">
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">
                      Assign reviewer
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="btn btn-outline"
                        onClick={() => assignReviewer(item.id)}
                        disabled={assignments[item.id] === user?.id}
                      >
                        {assignments[item.id] === user?.id
                          ? `Assigned: ${profile?.full_name || "Current Account"}`
                          : `Assign to ${profile?.full_name || "Current Account"}`}
                      </button>
                      <span className="text-xs text-slate-500">
                        Current reviewer:{" "}
                        {assignments[item.id]
                          ? reviewerNameById[assignments[item.id]] ||
                            "Unknown reviewer"
                          : "Unassigned"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Assignment uses the currently logged-in admin account.
                    </p>
                  </label>

                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">
                      Review comments
                    </span>
                    <textarea
                      className="control-textarea min-h-20"
                      placeholder="Add approval/rejection notes"
                      value={comments[item.id] || ""}
                      onChange={(e) =>
                        setComments((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="mt-3 app-card app-card-compact">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Old vs New (Latest Edit)
                  </p>
                  {!latestEdit || diffRows.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-600">
                      No tracked field changes from latest update.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-slate-500">
                        Updated on{" "}
                        {new Date(latestEdit.created_at).toLocaleString()} by{" "}
                        {latestEdit.actor_id
                          ? editorNameById[latestEdit.actor_id] ||
                            "Unknown admin"
                          : "System"}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-amber-700">
                            Old
                          </p>
                          <ul className="mt-1 space-y-1 text-sm text-slate-700">
                            {diffRows.map((row) => (
                              <li key={`${item.id}-old-${row.key}`}>
                                <span className="font-semibold">
                                  {row.key}:
                                </span>{" "}
                                {String(row.oldValue)}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-[var(--radius-sm)] border border-emerald-200 bg-emerald-50 p-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-emerald-700">
                            New
                          </p>
                          <ul className="mt-1 space-y-1 text-sm text-slate-700">
                            {diffRows.map((row) => (
                              <li key={`${item.id}-new-${row.key}`}>
                                <span className="font-semibold">
                                  {row.key}:
                                </span>{" "}
                                {String(row.newValue)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 app-card-muted app-card-compact">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Audit Preview
                  </p>
                  {auditPreview.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-600">
                      No status history yet.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm">
                      {auditPreview.map((entry) => (
                        <li key={entry.id} className="text-slate-700">
                          {entry.old_status || "none"} {"->"} {entry.new_status}{" "}
                          on {new Date(entry.changed_at).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    Next action summary:{" "}
                    {normalizeStatus(item.status) === "proposal"
                      ? "Approve/Reject will create review log + update project status."
                      : normalizeStatus(item.status) === "ongoing"
                        ? "Mark Completed will update project status + completion timestamp."
                        : "No status transition action available for this workflow."}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {normalizeStatus(item.status) === "proposal" ? (
                    <>
                      <button
                        className="btn btn-primary"
                        onClick={() => openDecisionModal("approve", [item.id])}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-danger-outline"
                        onClick={() => openDecisionModal("reject", [item.id])}
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                  {normalizeStatus(item.status) === "ongoing" ? (
                    <button
                      className="btn btn-primary"
                      onClick={() => openCompleteModal(item.id)}
                    >
                      Mark Completed
                    </button>
                  ) : null}
                  <button
                    className="btn btn-outline"
                    onClick={() => openDetailDrawer(item.id)}
                  >
                    View Details
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {decisionModal ? (
        <div
          className="modal-overlay modal-overlay-centered"
          onClick={() => !decisionLoading && setDecisionModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-decision-title"
            className="modal-dialog modal-dialog-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel">
              <div className="panel-header">
                <h3
                  id="review-decision-title"
                  className="text-base font-semibold text-slate-900"
                >
                  Confirm{" "}
                  {decisionModal.action === "approve"
                    ? "Approval"
                    : "Rejection"}
                </h3>
              </div>
              <div className="panel-body space-y-3">
                <p className="text-sm text-slate-600">
                  You are about to {decisionModal.action}{" "}
                  {decisionModal.targetCount} proposal(s). This action will be
                  logged in review history.
                </p>
                {decisionPreview?.target ? (
                  <div className="app-card-muted app-card-compact text-sm">
                    <p className="font-semibold text-slate-800">
                      Audit Summary Preview
                    </p>
                    <p className="text-slate-600">
                      Target: {decisionPreview.target.title}
                    </p>
                    <p className="text-slate-600">
                      Recent timeline events: {decisionPreview.audit.length}
                    </p>
                    <p className="text-slate-600">
                      Latest tracked field edits: {decisionPreview.diffCount}
                    </p>
                  </div>
                ) : null}
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Decision note{" "}
                    {decisionModal.action === "reject"
                      ? "(required)"
                      : "(optional)"}
                  </span>
                  <textarea
                    className="control-textarea min-h-24"
                    value={decisionComment}
                    onChange={(e) => setDecisionComment(e.target.value)}
                    placeholder="Provide decision rationale"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setDecisionModal(null)}
                    disabled={decisionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`btn ${decisionModal.action === "approve" ? "btn-primary" : "btn-danger-outline"}`}
                    onClick={confirmDecision}
                    disabled={decisionLoading}
                  >
                    {decisionLoading
                      ? "Processing..."
                      : decisionModal.action === "approve"
                        ? "Confirm Approval"
                        : "Confirm Rejection"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {completeModal ? (
        <div
          className="modal-overlay modal-overlay-centered"
          onClick={() => !completeLoading && setCompleteModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-complete-title"
            className="modal-dialog modal-dialog-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel">
              <div className="panel-header">
                <h3
                  id="review-complete-title"
                  className="text-base font-semibold text-slate-900"
                >
                  Confirm Completion
                </h3>
              </div>
              <div className="panel-body space-y-3">
                <p className="text-sm text-slate-600">
                  This will update the project status from ongoing to completed.
                </p>
                {completionPreview?.target ? (
                  <div className="app-card-muted app-card-compact text-sm">
                    <p className="font-semibold text-slate-800">
                      Audit Summary Preview
                    </p>
                    <p className="text-slate-600">
                      Target: {completionPreview.target.title}
                    </p>
                    <p className="text-slate-600">
                      Recent timeline events: {completionPreview.audit.length}
                    </p>
                  </div>
                ) : null}
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Remarks (optional)
                  </span>
                  <textarea
                    className="control-textarea min-h-24"
                    value={completeRemarks}
                    onChange={(e) => setCompleteRemarks(e.target.value)}
                    placeholder="Completion notes"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setCompleteModal(null)}
                    disabled={completeLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={confirmMarkCompleted}
                    disabled={completeLoading}
                  >
                    {completeLoading ? "Processing..." : "Confirm Completed"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {detailItem ? (
        <div
          className="modal-overlay"
          onClick={() => setDetailItem(null)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-detail-title"
            className="ml-auto h-full w-full max-w-3xl overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-4 sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3
                id="review-detail-title"
                className="text-lg font-bold text-slate-900"
              >
                Proposal Detail
              </h3>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDetailItem(null)}
              >
                Close
              </button>
            </div>

            {detailLoading || !detailData.project ? (
              <p className="text-sm text-slate-600">
                Loading proposal details...
              </p>
            ) : (
              <div className="space-y-4">
                <div className="app-card app-card-compact">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Title
                  </p>
                  <p className="mt-1 text-base font-semibold">
                    {detailData.project.title}
                  </p>
                  {detailData.project.abstract ? (
                    <p className="mt-2 text-sm text-slate-600">
                      {detailData.project.abstract}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="app-card app-card-compact text-sm">
                    <p>Year: {detailData.project.year}</p>
                    <p>Status: {detailData.project.status}</p>
                    <p>Classification: {detailData.project.classification}</p>
                    <p>
                      Scholarly Type: {detailData.project.scholarly_type || "-"}
                    </p>
                  </div>
                  <div className="app-card app-card-compact text-sm">
                    <p>Funding Type: {detailData.project.funding_type}</p>
                    <p>
                      Funding Category:{" "}
                      {detailData.project.funding_category || "-"}
                    </p>
                    <p>
                      Funding Source: {detailData.project.funding_source || "-"}
                    </p>
                    <p>
                      Funding Amount: {detailData.project.funding_amount || 0}
                    </p>
                    <p>Partner: {detailData.project.industry_partner || "-"}</p>
                  </div>
                </div>

                <div className="app-card app-card-compact text-sm">
                  <p>
                    Lead Researcher: {detailData.project.lead_researcher || "-"}
                  </p>
                  <p>Faculty Team: {detailData.project.faculty_team || "-"}</p>
                  <p>Student Team: {detailData.project.student_team || "-"}</p>
                  <p>
                    Expected Outputs:{" "}
                    {detailData.project.expected_outputs || "-"}
                  </p>
                  <p>
                    Supporting MOV Link:{" "}
                    {detailData.project.supporting_mov_link || "-"}
                  </p>
                  <p>
                    Signed MOA Reference:{" "}
                    {detailData.project.signed_moa_reference || "-"}
                  </p>
                </div>

                <div className="app-card app-card-compact">
                  <p className="mb-2 text-sm font-semibold">MOV Attachments</p>
                  {detailData.movs.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      No MOV files uploaded yet.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {detailData.movs.map((mov) => (
                        <li
                          key={mov.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span>
                            v{mov.version_no} - {mov.file_name}{" "}
                            {mov.is_current ? "(current)" : ""}
                          </span>
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => previewMov(mov)}
                          >
                            Preview
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="app-card app-card-compact">
                  <p className="mb-2 text-sm font-semibold">Status Timeline</p>
                  {detailData.history.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      No status timeline entries.
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
                </div>

                <div className="app-card app-card-compact">
                  <p className="mb-2 text-sm font-semibold">Review Audit</p>
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
                </div>
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
            aria-labelledby="review-preview-title"
            className="mx-auto mt-8 w-full max-w-5xl rounded-[var(--radius-md)] border border-[var(--border)] bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
              <p
                id="review-preview-title"
                className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900"
              >
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
        open={Boolean(confirmAssignAction)}
        title="Confirm Reviewer Assignment"
        message="Assign current account as reviewer for this project?"
        confirmLabel="Assign Reviewer"
        onCancel={() => setConfirmAssignAction(null)}
        onConfirm={async () => {
          if (!confirmAssignAction?.projectId) return;
          await assignReviewer(confirmAssignAction.projectId, true);
          setConfirmAssignAction(null);
        }}
      />
    </section>
  );
}





