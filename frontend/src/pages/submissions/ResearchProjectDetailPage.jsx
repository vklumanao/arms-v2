import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/components/providers/AuthProvider";
import { useReferenceData } from "@/hooks/useReferenceData";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  fetchLinkedProjects,
  fetchProjectResources,
  fetchUserProjects,
  listAwardRecognitionRecords,
} from "@/services/submissions";
import { normalizeStatus } from "@/utils/status";
import {
  EXPECTED_OUTPUT_TYPE_OPTIONS,
  formatBytes,
  formatDate,
} from "@/utils/submissions";
import {
  ChevronLeft,
  Download,
  ExternalLink,
  FileText,
  Pencil,
  Trophy,
} from "lucide-react";

const OUTPUT_TYPE_LABELS = EXPECTED_OUTPUT_TYPE_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const formatCurrencyPHP = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const numericValue = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numericValue)) return String(value);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericValue);
};

const normalizeLabel = (value) => {
  const text = String(value || "").trim();
  if (!text) return "-";
  const normalized = text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return normalized.replace(/\b\w/g, (match) => match.toUpperCase());
};

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || ""));

const formatProjectDuration = (startDateValue, endDateValue) => {
  if (!startDateValue || !endDateValue) return "-";
  const startDate = new Date(startDateValue);
  const endDate = new Date(endDateValue);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "-";
  }
  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs < 0) return "-";
  const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  if (diffDays >= 365) {
    const years = Math.floor(diffDays / 365);
    const months = Math.round((diffDays % 365) / 30);
    return `${years} yr${years === 1 ? "" : "s"}${
      months ? ` ${months} mo` : ""
    }`;
  }
  if (diffDays >= 30) {
    const months = Math.round(diffDays / 30);
    return `${months} mo`;
  }
  return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
};

const getStatusBadgeStyle = (value) => {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  if (key === "completed" || key === "complete" || key === "approved") {
    return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }
  if (key === "ongoing" || key === "in progress" || key === "active") {
    return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }
  if (key === "proposal" || key === "proposed" || key === "pending") {
    return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }
  if (key === "rejected" || key === "cancelled" || key === "canceled") {
    return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
};

export default function ResearchProjectDetailPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const projectId = String(params?.id || "").trim();
  const { centers, departments, agendas } = useReferenceData();
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

  const isAdmin =
    String(profile?.role || user?.role || "")
      .trim()
      .toLowerCase() === "admin";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ownedProjects, setOwnedProjects] = useState([]);
  const [linkedProjects, setLinkedProjects] = useState([]);
  const [resourcePanel, setResourcePanel] = useState({
    loading: false,
    error: "",
    dataset: null,
    resources: [],
    syncEnabled: true,
  });
  const [awardsPanel, setAwardsPanel] = useState({
    loading: false,
    error: "",
    rows: [],
  });

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [ownedRes, linkedRes] = await Promise.all([
          fetchUserProjects({ userId: profile?.id }),
          fetchLinkedProjects(),
        ]);
        if (cancelled) return;
        setOwnedProjects(Array.isArray(ownedRes?.data) ? ownedRes.data : []);
        setLinkedProjects(Array.isArray(linkedRes?.data) ? linkedRes.data : []);
      } catch (e) {
        if (cancelled) return;
        setError(String(e?.message || "Unable to load project."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, projectId]);

  const centerById = useMemo(
    () =>
      (centers || []).reduce((acc, center) => {
        acc[center.id] = center.name;
        return acc;
      }, {}),
    [centers],
  );
  const project = useMemo(() => {
    const key = String(projectId || "").trim();
    const matchesKey = (p) => {
      const id = String(p?.id || "").trim();
      const datasetId = String(p?.ckan_dataset_id || "").trim();
      return (id && id === key) || (datasetId && datasetId === key);
    };

    const fromOwned = ownedProjects.find(matchesKey);
    if (fromOwned) return fromOwned;
    return linkedProjects.find(matchesKey) || null;
  }, [linkedProjects, ownedProjects, projectId]);

  const agendaOrgId = String(
    project?.research_center_id || project?.ckan_org_id || "",
  ).trim();
  const { agendas: scopedAgendas } = useReferenceData({ orgId: agendaOrgId });

  const departmentById = useMemo(
    () =>
      (departments || []).reduce((acc, department) => {
        acc[department.id] = department.name;
        return acc;
      }, {}),
    [departments],
  );
  const agendaById = useMemo(
    () =>
      (scopedAgendas || []).reduce((acc, agenda) => {
        acc[agenda.id] = agenda.name;
        return acc;
      }, {}),
    [scopedAgendas],
  );
  const moaDownloadUrl = useMemo(() => {
    const resources = Array.isArray(resourcePanel?.resources)
      ? resourcePanel.resources
      : [];
    const moaResource = resources.find((resource) => {
      const name = String(resource?.name || "").trim();
      const description = String(resource?.description || "").trim();
      const notes = String(resource?.notes || "").trim();
      return [name, description, notes].some((value) => /\bmoa\b/i.test(value));
    });
    if (!moaResource?.id) return "";
    return `${apiBaseUrl}/submissions/resources/${encodeURIComponent(
      moaResource.id,
    )}/download?download=1`;
  }, [apiBaseUrl, resourcePanel?.resources]);
  const outputTypeLabelByValue = useMemo(
    () =>
      (EXPECTED_OUTPUT_TYPE_OPTIONS || []).reduce((acc, item) => {
        const key = String(item?.value || "").trim();
        if (!key) return acc;
        const label = String(item?.label || "").trim();
        acc[key] = label || key;
        return acc;
      }, {}),
    [],
  );

  const facultyTeamUsers = useMemo(() => {
    if (!Array.isArray(project?.faculty_team_users)) return [];
    return project.faculty_team_users
      .map((row) => row?.name || row?.email || row?.id)
      .filter(Boolean);
  }, [project?.faculty_team_users]);
  const leadResearcherUser = useMemo(() => {
    if (!project?.lead_researcher_user) return "";
    const row = project.lead_researcher_user;
    return row?.name || row?.email || row?.username || row?.id || "";
  }, [project?.lead_researcher_user]);
  const expectedOutputItems = useMemo(() => {
    if (!Array.isArray(project?.expected_outputs_items)) return [];
    return project.expected_outputs_items;
  }, [project?.expected_outputs_items]);

  const status = normalizeStatus(project?.status);

  const canEdit = useMemo(
    () => isAdmin && Boolean(project?.ckan_dataset_id),
    [isAdmin, project?.ckan_dataset_id],
  );

  const resourceDatasetId = useMemo(() => {
    const ckanId = String(project?.ckan_dataset_id || "").trim();
    if (ckanId) return ckanId;
    return String(project?.id || "").trim();
  }, [project?.ckan_dataset_id, project?.id]);

  useEffect(() => {
    if (!resourceDatasetId) {
      setResourcePanel((prev) => ({ ...prev, resources: [], dataset: null }));
      return;
    }

    let cancelled = false;
    setResourcePanel((prev) => ({ ...prev, loading: true, error: "" }));
    fetchProjectResources({ projectId: resourceDatasetId })
      .then(({ data, error: loadError, syncEnabled }) => {
        const resolvedSyncEnabled = syncEnabled ?? true;
        if (cancelled) return;
        if (loadError) {
          setResourcePanel({
            loading: false,
            error: loadError.message || "Unable to load linked resources.",
            dataset: null,
            resources: [],
            syncEnabled: resolvedSyncEnabled,
          });
          return;
        }
        setResourcePanel({
          loading: false,
          error: "",
          dataset: data?.dataset || null,
          resources: Array.isArray(data?.resources) ? data.resources : [],
          syncEnabled: resolvedSyncEnabled,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setResourcePanel({
          loading: false,
          error: e?.message || "Unable to load linked resources.",
          dataset: null,
          resources: [],
          syncEnabled: true,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [resourceDatasetId]);

  useEffect(() => {
    if (!resourceDatasetId) {
      setAwardsPanel({ loading: false, error: "", rows: [] });
      return;
    }
    let cancelled = false;
    setAwardsPanel((prev) => ({ ...prev, loading: true, error: "" }));
    listAwardRecognitionRecords({ projectId: resourceDatasetId })
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) {
          setAwardsPanel({
            loading: false,
            error: loadError.message || "Unable to load linked awards.",
            rows: [],
          });
          return;
        }
        setAwardsPanel({
          loading: false,
          error: "",
          rows: Array.isArray(data) ? data : [],
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setAwardsPanel({
          loading: false,
          error: e?.message || "Unable to load linked awards.",
          rows: [],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [resourceDatasetId]);

  if (!projectId) return <Navigate to="/projects" replace />;

  const centerName = project?.research_center_id
    ? centerById[project.research_center_id] || "-"
    : project?.project_ckan_org_id
      ? centerById[project.project_ckan_org_id] || "-"
      : project?.ckan_org_id
        ? centerById[project.ckan_org_id] || "-"
        : project?.research_center || "-";
  const departmentName = project?.department_id
    ? departmentById[project.department_id] || "-"
    : "-";
  const agendaName = project?.research_agenda_id
    ? agendaById[project.research_agenda_id] || "-"
    : "-";
  const visibilityLabel = project?.project_public_visible
    ? "Public"
    : "Private";
  const durationLabel = formatProjectDuration(
    project?.start_date,
    project?.end_date,
  );
  const facultySummary =
    facultyTeamUsers.join(", ") ||
    String(project?.faculty_team || "").trim() ||
    "-";
  const studentSummary = String(project?.student_team || "").trim() || "-";
  const expectedOutputSummary =
    String(project?.expected_outputs || "").trim() || "-";

  return (
    <section className="page-stack-lg">
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,1))]" />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">
                Project Workspace
              </p>
              <div className="space-y-2">
                <h1 className="text-slate-900">
                  {project?.title || "Research Project"}
                </h1>
                <p className="max-w-3xl text-[15px] leading-7 text-slate-600 lg:text-base">
                  Review the project summary, team details, timeline,
                  deliverables, and linked scholarly outputs from one
                  mobile-first detail page.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
              <Button asChild variant="outline">
                <Link to="/projects">
                  <ChevronLeft className="h-4 w-4" />
                  Back to Projects
                </Link>
              </Button>
              {canEdit ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(
                      `/projects/submit?edit=${encodeURIComponent(
                        String(
                          project?.ckan_dataset_id || projectId || "",
                        ).trim(),
                      )}`,
                    )
                  }
                >
                  <Pencil className="h-4 w-4" />
                  Edit Project
                </Button>
              ) : null}
              {resourceDatasetId ? (
                <Button asChild>
                  <Link
                    to={`/awards/new?project_id=${encodeURIComponent(
                      resourceDatasetId,
                    )}`}
                  >
                    <Trophy className="h-4 w-4" />
                    Add Award
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
              Loading project...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-700">
              Unable to load. {error}
            </div>
          ) : !project ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
              Project not found. This project is not available in your scope.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusBadgeStyle(
                    project?.status || "published",
                  )}`}
                >
                  {project?.status || "Published"}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {visibilityLabel}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {durationLabel}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {centerName}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Lead Researcher",
                    value: project?.lead_researcher || "-",
                  },
                  { label: "Research Center", value: centerName },
                  { label: "Department", value: departmentName },
                  { label: "Project Year", value: project?.year || "-" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
                <div className="space-y-4">
                  <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                    <CardHeader className="border-b border-slate-100 px-5 py-4">
                      <CardTitle className="text-lg font-bold text-slate-900">
                        Overview
                      </CardTitle>
                      <CardDescription>
                        Core narrative and submission context for this project.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 p-5">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Project Summary
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">
                          {String(project?.abstract || "").trim() ||
                            "No abstract provided yet."}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Expected Outputs
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">
                          {expectedOutputSummary}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                    <CardHeader className="border-b border-slate-100 px-5 py-4">
                      <CardTitle className="text-lg font-bold text-slate-900">
                        Team
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Lead Researcher
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {project?.lead_researcher || "-"}
                        </p>
                        {leadResearcherUser ? (
                          <p className="mt-1 text-sm text-slate-600">
                            Linked user: {leadResearcherUser}
                          </p>
                        ) : null}
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Faculty Team
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                          {facultySummary}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Student Team
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">
                          {studentSummary}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                    <CardHeader className="border-b border-slate-100 px-5 py-4">
                      <CardTitle className="text-lg font-bold text-slate-900">
                        Funding and Timeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
                      {[
                        [
                          "Industry/Agency Partner",
                          project?.industry_partner || "-",
                        ],
                        ["Funding Type", normalizeLabel(project?.funding_type)],
                        ["Funding Source", project?.funding_source || "-"],
                        [
                          "Funding Amount",
                          formatCurrencyPHP(project?.funding_amount),
                        ],
                        ["Start Date", formatDate(project?.start_date)],
                        ["End Date", formatDate(project?.end_date)],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                            {label}
                          </p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">
                            {value}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm xl:sticky xl:top-5">
                    <CardHeader className="border-b border-slate-100 px-5 py-4">
                      <CardTitle className="text-lg font-bold text-slate-900">
                        Project Facts
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5">
                      {[
                        ["Status", normalizeLabel(project?.status)],
                        ["Visibility", visibilityLabel],
                        ["Research Agenda", agendaName],
                        [
                          "Classification",
                          normalizeLabel(project?.classification),
                        ],
                        ["Submitted", formatDate(project?.submitted_at)],
                        [
                          "Submitted By",
                          project?.submitted_by_name || "Unknown user",
                        ],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                            {label}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {value}
                          </p>
                        </div>
                      ))}
                      {project?.submitted_by_email ? (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                            Submitter Email
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            {project.submitted_by_email}
                          </p>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                    <CardHeader className="border-b border-slate-100 px-5 py-4">
                      <CardTitle className="text-lg font-bold text-slate-900">
                        Supporting Links
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Supporting MOV Link
                        </p>
                        {project?.supporting_mov_link ? (
                          <a
                            className="mt-2 inline-flex items-center text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
                            href={project.supporting_mov_link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {project.supporting_mov_link}
                            <ExternalLink className="ml-2 h-4 w-4" />
                          </a>
                        ) : (
                          <p className="mt-2 text-sm text-slate-600">
                            No supporting MOV link added yet.
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Signed MOA
                        </p>
                        {(() => {
                          const moaReference = String(
                            project?.signed_moa_reference || "",
                          ).trim();
                          if (!moaReference) {
                            return (
                              <p className="mt-2 text-sm text-slate-600">
                                No signed MOA reference available.
                              </p>
                            );
                          }
                          if (isHttpUrl(moaReference)) {
                            return (
                              <a
                                className="mt-2 inline-flex items-center text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
                                href={moaReference}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {moaReference}
                                <ExternalLink className="ml-2 h-4 w-4" />
                              </a>
                            );
                          }
                          return (
                            <p className="mt-2 text-sm font-semibold text-slate-900">
                              {moaReference}
                            </p>
                          );
                        })()}
                        {moaDownloadUrl ? (
                          <div className="mt-3">
                            <Button asChild variant="outline" size="sm">
                              <a
                                href={moaDownloadUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download className="h-4 w-4" />
                                Download MOA
                              </a>
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>

                  {expectedOutputItems.length > 0 ? (
                    <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                      <CardHeader className="border-b border-slate-100 px-5 py-4">
                        <CardTitle className="text-lg font-bold text-slate-900">
                          Output Targets
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-3 p-5">
                        {expectedOutputItems.map((item, index) => {
                          const typeKey = String(item?.type || "")
                            .trim()
                            .toLowerCase();
                          return (
                            <div
                              key={`${typeKey}-${index}`}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <p className="text-sm font-semibold text-slate-900">
                                {outputTypeLabelByValue[typeKey] ||
                                  OUTPUT_TYPE_LABELS[typeKey] ||
                                  normalizeLabel(item?.type)}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                Target: {item?.target || item?.count || "-"}
                              </p>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              </div>

              <Card className="overflow-hidden border border-black/20 bg-white shadow-sm">
                <CardHeader className="border-b border-zinc-200 px-6 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold text-black">
                        Outputs
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {!resourcePanel.syncEnabled ? (
                    <p className="text-base text-zinc-600">
                      CKAN sync is disabled in this environment.
                    </p>
                  ) : resourcePanel.loading ? (
                    <p className="text-base text-zinc-600">
                      Loading linked resources...
                    </p>
                  ) : resourcePanel.error ? (
                    <p className="text-base text-zinc-700">
                      {resourcePanel.error}
                    </p>
                  ) : resourcePanel.resources.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-base text-zinc-600">
                      No linked resources found for this project.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {resourcePanel.resources
                        .filter((resource) => {
                          const name = String(resource?.name || "").trim();
                          const description = String(
                            resource?.description || "",
                          ).trim();
                          const notes = String(resource?.notes || "").trim();
                          return ![name, description, notes].some((value) =>
                            /\bmoa\b/i.test(value),
                          );
                        })
                        .map((resource) => {
                          const resourceUrl = String(resource.url || "").trim();
                          const isDownloadable =
                            /\/resource\/.+\/download\//i.test(resourceUrl);
                          const descriptionText = String(
                            resource.description || "",
                          ).trim();
                          const outputTypeFromDescription = descriptionText
                            .split("\n")
                            .map((line) => line.trim())
                            .find((line) =>
                              line.toLowerCase().startsWith("output type:"),
                            )
                            ?.split("output type:")
                            .slice(1)
                            .join("output type:")
                            .trim();
                          const resolvedOutputType =
                            String(resource.output_type || "").trim() ||
                            outputTypeFromDescription ||
                            "";
                          const outputTypeKey = resolvedOutputType
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "_")
                            .replace(/^_+|_+$/g, "");
                          const outputTypeLabel =
                            OUTPUT_TYPE_LABELS[outputTypeKey] ||
                            resolvedOutputType;
                          const outputLinkFromDescription = descriptionText
                            .split("\n")
                            .map((line) => line.trim())
                            .find((line) =>
                              line.toLowerCase().startsWith("output link:"),
                            )
                            ?.split("output link:")
                            .slice(1)
                            .join("output link:")
                            .trim();
                          const outputLinkFromUrl =
                            descriptionText.match(/(https?:\/\/\S+)/i)?.[1];
                          const resolvedOutputLink =
                            String(resource.output_link || "").trim() ||
                            outputLinkFromDescription ||
                            outputLinkFromUrl ||
                            (!isDownloadable ? resourceUrl : "");
                          const hasLink = Boolean(resolvedOutputLink);
                          const hasFile = Boolean(
                            resource.id && isDownloadable,
                          );
                          return (
                            <Card
                              key={resource.id || resource.url || resource.name}
                              className="rounded-2xl border border-zinc-200/70 bg-white shadow-sm"
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-base font-semibold text-zinc-900">
                                      {resource.name || "Unnamed resource"}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2" />
                                    {(() => {
                                      const rawAuthors =
                                        String(
                                          resource.publication_authors || "",
                                        ).trim() ||
                                        String(
                                          resource.publicationAuthors || "",
                                        ).trim();
                                      if (rawAuthors) {
                                        return (
                                          <p className="text-base font-medium text-zinc-800">
                                            Proponents: {rawAuthors}
                                          </p>
                                        );
                                      }
                                      const descriptionText = String(
                                        resource.description || "",
                                      ).trim();
                                      const fromDescription = descriptionText
                                        .split("\n")
                                        .map((line) => line.trim())
                                        .find((line) =>
                                          line
                                            .toLowerCase()
                                            .startsWith("authors/proponents:"),
                                        )
                                        ?.split("authors/proponents:")
                                        .slice(1)
                                        .join("authors/proponents:")
                                        .trim();
                                      if (!fromDescription) return null;
                                      return (
                                        <p className="text-base font-medium text-zinc-800">
                                          Proponents: {fromDescription}
                                        </p>
                                      );
                                    })()}
                                    {resolvedOutputType ? (
                                      <p className="text-base text-zinc-600">
                                        Output Type: {outputTypeLabel}
                                      </p>
                                    ) : null}
                                    <p className="text-base text-zinc-600">
                                      Format: {resource.format || "-"} | Size:{" "}
                                      {formatBytes(resource.size)}
                                    </p>
                                    {hasLink ? (
                                      <p className="text-base text-zinc-600">
                                        Output Link:{" "}
                                        <a
                                          href={resolvedOutputLink}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-zinc-600 hover:underline"
                                        >
                                          {resolvedOutputLink}
                                        </a>
                                      </p>
                                    ) : null}
                                  </div>
                                  <FileText className="h-5 w-5 text-zinc-400" />
                                </div>

                                {resource.id && (hasFile || hasLink) ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Button asChild variant="outline" size="sm">
                                      <a
                                        href={
                                          hasFile
                                            ? `${apiBaseUrl}/submissions/resources/${encodeURIComponent(
                                                resource.id,
                                              )}/download?download=1`
                                            : resolvedOutputLink
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        <Download className="h-4 w-4" />
                                        Download
                                      </a>
                                    </Button>
                                  </div>
                                ) : (
                                  <p className="mt-2 text-base text-zinc-500">
                                    No file attached yet.
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="overflow-hidden border border-black/20 bg-white shadow-sm">
                <CardHeader className="border-b border-zinc-200 px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold text-black">
                        Awards &amp; Recognition
                      </CardTitle>
                      <CardDescription className="text-zinc-600">
                        Awards linked to this project.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {awardsPanel.loading ? (
                    <p className="text-base text-zinc-600">
                      Loading linked awards...
                    </p>
                  ) : awardsPanel.error ? (
                    <p className="text-base text-zinc-700">
                      {awardsPanel.error}
                    </p>
                  ) : awardsPanel.rows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-base text-zinc-600">
                      No awards linked to this project yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {awardsPanel.rows.map((row) => (
                        <Card
                          key={
                            row.id ||
                            row.ckan_dataset_id ||
                            row.award_recognition
                          }
                          className="rounded-2xl border border-black/20 bg-white shadow-sm"
                        >
                          <CardContent className="p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-base font-semibold text-zinc-900">
                                  {row.award_recognition || "Award"}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">
                                    {row.level || "Level"}
                                  </Badge>
                                  {row.year_received ? (
                                    <Badge variant="secondary">
                                      {row.year_received}
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-base text-zinc-700">
                                  Awarding body: {row.awarding_body || "-"}
                                </p>
                                <p className="text-base text-zinc-700">
                                  Recipients: {row.recipients || "-"}
                                </p>
                              </div>
                              <Trophy className="h-5 w-5 text-zinc-500" />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {row.supporting_mov_resource_id ||
                              row.supporting_movs ? (
                                <Button asChild variant="outline" size="sm">
                                  <a
                                    href={
                                      row.supporting_mov_resource_id
                                        ? `${apiBaseUrl}/submissions/resources/${encodeURIComponent(
                                            row.supporting_mov_resource_id,
                                          )}/download?download=1`
                                        : row.supporting_movs
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <Download className="h-4 w-4" />
                                    Download
                                  </a>
                                </Button>
                              ) : null}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
