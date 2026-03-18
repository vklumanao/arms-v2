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
} from "@/services/submissions";
import { normalizeStatus } from "@/utils/status";
import { formatBytes, formatDate } from "@/utils/submissions";
import {
  ChevronLeft,
  Download,
  ExternalLink,
  FileText,
  Pencil,
} from "lucide-react";

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

export default function ResearchProjectDetailPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const projectId = String(params?.id || "").trim();
  const { centers, departments, agendas } = useReferenceData();
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4010/api";

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

  if (!projectId) return <Navigate to="/submit-project" replace />;

  return (
    <section className="page-stack-lg">
      <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Research Project Detail
            </p>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
              {project?.title || "Research Project"}
            </h1>
            <p className="text-sm text-slate-600">
              Review the full submission, linked resources, and funding
              information for this project.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/submit-project">
                <ChevronLeft className="h-4 w-4" />
                Back to Projects
              </Link>
            </Button>
            {canEdit ? (
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    `/submit-project/submit?edit=${encodeURIComponent(
                      String(
                        project?.ckan_dataset_id || projectId || "",
                      ).trim(),
                    )}`,
                  )
                }
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Status
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900 capitalize">
              {project?.status || "Pending"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {project?.submission_state || "Submission"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Visibility
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {project?.project_public_visible ? "Public" : "Private"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Portfolio access</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Year
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {project?.year || "-"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Project cycle</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Research Center
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {project?.research_center_id
                ? centerById[project.research_center_id] || "-"
                : project?.project_ckan_org_id
                  ? centerById[project.project_ckan_org_id] || "-"
                  : project?.ckan_org_id
                    ? centerById[project.ckan_org_id] || "-"
                    : project?.research_center || "-"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Owning center</p>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-slate-900">
                Project Details
              </CardTitle>
              <CardDescription>
                Complete submission profile and classifications.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-5">
          {loading ? (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-sm text-slate-600">
              Loading project...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-sm text-slate-600">
              Unable to load. {error}
            </div>
          ) : !project ? (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-sm text-slate-600">
              Project not found. This project is not available in your scope.
            </div>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
                <div className="space-y-4">
                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-5 py-3">
                      <CardTitle className="text-sm font-semibold text-slate-900">
                        Overview
                      </CardTitle>
                      <CardDescription>Submission metadata.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 p-4 text-sm text-slate-700 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Research Center
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {project?.research_center_id
                            ? centerById[project.research_center_id] || "-"
                            : project?.project_ckan_org_id
                              ? centerById[project.project_ckan_org_id] || "-"
                              : project?.ckan_org_id
                                ? centerById[project.ckan_org_id] || "-"
                                : project?.research_center || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Submitted
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatDate(project?.submitted_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Submitted By
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {project?.submitted_by_name || "Unknown user"}
                        </p>
                        {project?.submitted_by_email ? (
                          <p className="text-xs text-slate-500">
                            {project.submitted_by_email}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Visibility
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {project?.project_public_visible
                            ? "Public"
                            : "Private"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Year
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {project?.year || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Status
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 capitalize">
                          {project?.status || "-"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-5 py-3">
                      <CardTitle className="text-sm font-semibold text-slate-900">
                        Classification
                      </CardTitle>
                      <CardDescription>
                        Program and agenda mapping.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 p-4 text-sm text-slate-700 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Department
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {project?.department_id
                            ? departmentById[project.department_id] || "-"
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Research Agenda
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {project?.research_agenda_id
                            ? agendaById[project.research_agenda_id] || "-"
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Classification
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {project?.classification || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Scholarly Type
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {project?.scholarly_type || "-"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-5 py-3">
                      <CardTitle className="text-sm font-semibold text-slate-900">
                        People
                      </CardTitle>
                      <CardDescription>
                        Research teams and participants.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 p-4 text-sm text-slate-700 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Lead Researcher
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {project?.lead_researcher || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Faculty Team
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {project?.faculty_team || "-"}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs font-semibold text-slate-500">
                          Student Team
                        </p>
                        <p className="mt-1 whitespace-pre-line text-sm text-slate-900">
                          {project?.student_team || "-"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-5 py-3">
                      <CardTitle className="text-sm font-semibold text-slate-900">
                        Abstract
                      </CardTitle>
                      <CardDescription>Project summary.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 text-sm text-slate-700">
                      <p className="whitespace-pre-line text-sm font-semibold text-slate-900">
                        {project?.abstract || "-"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-5 py-3">
                      <CardTitle className="text-sm font-semibold text-slate-900">
                        Funding
                      </CardTitle>
                      <CardDescription>
                        Budget and funding sources.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 p-4 text-sm text-slate-700 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Industry/Agency Partner
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {project?.industry_partner || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Funding Type
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {normalizeLabel(project?.funding_type)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Funding Source
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {project?.funding_source || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Funding Amount
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatCurrencyPHP(project?.funding_amount)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-5 py-3">
                      <CardTitle className="text-sm font-semibold text-slate-900">
                        Timeline & MOA
                      </CardTitle>
                      <CardDescription>
                        Key dates and agreements.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 p-4 text-sm text-slate-700 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Start Date
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatDate(project?.start_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          End Date
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatDate(project?.end_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Supporting MOV Link
                        </p>
                        {project?.supporting_mov_link ? (
                          <a
                            className="mt-1 inline-flex items-center text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
                            href={project.supporting_mov_link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {project.supporting_mov_link}
                          </a>
                        ) : (
                          <p className="mt-1 whitespace-pre-line text-sm text-slate-900">
                            -
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Signed MOA Reference
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {project?.signed_moa_reference || "-"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Card className="overflow-hidden">
                <CardHeader className="border-b border-[var(--border)] px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold text-slate-900">
                        Linked Resources
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {!resourcePanel.syncEnabled ? (
                    <p className="text-sm text-slate-600">
                      CKAN sync is disabled in this environment.
                    </p>
                  ) : resourcePanel.loading ? (
                    <p className="text-sm text-slate-600">
                      Loading linked resources...
                    </p>
                  ) : resourcePanel.error ? (
                    <p className="text-sm text-red-700">
                      {resourcePanel.error}
                    </p>
                  ) : resourcePanel.resources.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-6 text-center text-sm text-slate-600">
                      No linked resources found for this project.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {resourcePanel.resources.map((resource) => (
                        <Card
                          key={resource.id || resource.url || resource.name}
                          className="rounded-2xl border border-slate-200/70 bg-white shadow-sm"
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
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
                              </div>
                              <FileText className="h-5 w-5 text-slate-400" />
                            </div>

                            {resource.id ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(() => {
                                  const resourceUrl = String(
                                    resource.url || "",
                                  ).trim();
                                  const isDownloadable =
                                    /\/resource\/.+\/download\//i.test(
                                      resourceUrl,
                                    );
                                  if (!isDownloadable) {
                                    return (
                                      <p className="text-sm text-slate-500">
                                        No file attached yet.
                                      </p>
                                    );
                                  }
                                  return (
                                    <>
                                      <Button
                                        asChild
                                        variant="outline"
                                        size="sm"
                                      >
                                        <a
                                          href={`${apiBaseUrl}/submissions/resources/${encodeURIComponent(
                                            resource.id,
                                          )}/download`}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                          Open
                                        </a>
                                      </Button>
                                      <Button
                                        asChild
                                        variant="outline"
                                        size="sm"
                                      >
                                        <a
                                          href={`${apiBaseUrl}/submissions/resources/${encodeURIComponent(
                                            resource.id,
                                          )}/download?download=1`}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          <Download className="h-4 w-4" />
                                          Download
                                        </a>
                                      </Button>
                                    </>
                                  );
                                })()}
                              </div>
                            ) : (
                              <p className="mt-2 text-sm text-slate-500">
                                No resource URL available.
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
