import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { useReferenceData } from "@/shared/hooks/useReferenceData";
import PageHeader from "@/shared/components/layout/PageHeader";
import EmptyState from "@/shared/components/feedback/EmptyState";
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
} from "@/features/submissions/services";
import { normalizeStatus } from "@/shared/utils/status";
import { formatBytes, formatDate } from "@/features/submissions/utils";
import {
  ChevronLeft,
  Download,
  ExternalLink,
  FileText,
  Pencil,
} from "lucide-react";

export default function ResearchProjectDetailPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const projectId = String(params?.id || "").trim();
  const { centers } = useReferenceData();
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

  const status = normalizeStatus(project?.status);

  const canEdit = useMemo(
    () => isAdmin && Boolean(project?.ckan_dataset_id),
    [isAdmin, project?.ckan_dataset_id],
  );

  useEffect(() => {
    if (!project?.id) {
      setResourcePanel((prev) => ({ ...prev, resources: [], dataset: null }));
      return;
    }

    let cancelled = false;
    setResourcePanel((prev) => ({ ...prev, loading: true, error: "" }));
      fetchProjectResources({ projectId: project.id })
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
  }, [project?.ckan_dataset_id, project?.id]);

  if (!projectId) return <Navigate to="/submit-project" replace />;

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Research Project"
        description="Dedicated view for a single research project record."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
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
                  String(project?.ckan_dataset_id || projectId || "").trim(),
                )}`,
              )
            }
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold text-slate-900">
                {project?.title || "Project"}
              </CardTitle>
              <CardDescription>
                Submitted by{" "}
                <span className="font-semibold text-slate-700">
                  {project?.submitted_by_name || "Unknown user"}
                </span>
                {project?.submitted_by_email ? ` (${project.submitted_by_email})` : ""}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="capitalize">
                {status || "-"}
              </Badge>
              <Badge variant="secondary">
                {project?.year || "-"}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-6">
          {loading ? (
            <p className="text-sm text-slate-600">Loading project...</p>
          ) : error ? (
            <EmptyState title="Unable to load" description={error} />
          ) : !project ? (
            <EmptyState
              title="Project not found"
              description="This project is not available in your scope."
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Research Center
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {project?.ckan_org_id
                        ? centerById[project.ckan_org_id] || "-"
                        : project?.research_center || "-"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Submitted
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {formatDate(project?.submitted_at)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Lead Researcher
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {project?.lead_researcher || "-"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="overflow-hidden">
                <CardHeader className="border-b border-[var(--border)] px-6 py-5">
                  <CardTitle className="text-base font-bold text-slate-900">
                    Project Details
                  </CardTitle>
                  <CardDescription>
                    Full submission information.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-6 text-sm text-slate-700">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Abstract
                    </p>
                    <p className="mt-1 whitespace-pre-line">
                      {project?.abstract || "-"}
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Faculty Team
                      </p>
                      <p className="mt-1 whitespace-pre-line">
                        {project?.faculty_team || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Student Team
                      </p>
                      <p className="mt-1 whitespace-pre-line">
                        {project?.student_team || "-"}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Expected Outputs
                    </p>
                    <p className="mt-1 whitespace-pre-line">
                      {project?.expected_outputs || "-"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="border-b border-[var(--border)] px-6 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-bold text-slate-900">
                        Linked Resources
                      </CardTitle>
                      <CardDescription>
                        Files/resources synced from CKAN (if enabled).
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {project?.ckan_dataset_id || "-"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
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
                    <p className="text-sm text-slate-600">
                      No linked resources found for this project.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {resourcePanel.resources.map((resource) => (
                        <Card
                          key={resource.id || resource.url || resource.name}
                          className="border-slate-200 bg-slate-50/40"
                        >
                          <CardContent className="p-4">
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
                                  const resourceUrl = String(resource.url || "").trim();
                                  const isDownloadable = /\/resource\/.+\/download\//i.test(
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
                                      <Button asChild variant="outline" size="sm">
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
                                      <Button asChild variant="outline" size="sm">
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
