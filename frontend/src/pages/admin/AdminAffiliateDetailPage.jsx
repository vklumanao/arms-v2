import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/feedback/EmptyState";
import { useToast } from "@/components/providers/ToastProvider";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchCkanDatasets } from "@/services/ckanApi";
import {
  buildCenterNameById,
  filterAffiliateRelatedDatasets,
} from "@/utils/admin";
import { fetchAffiliateRegistry } from "@/services/admin";
import { ChevronLeft, FolderKanban, Users } from "lucide-react";

export default function AdminAffiliateDetailPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const params = useParams();
  const affiliateId = String(params?.id || "").trim();
  const { departments: referenceDepartments } = useReferenceData();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [centers, setCenters] = useState([]);
  const [projectsPanel, setProjectsPanel] = useState({
    loading: false,
    error: "",
    rows: [],
  });

  const centerNameById = useMemo(() => buildCenterNameById(centers), [centers]);

  const affiliate = useMemo(
    () =>
      rows.find((row) => String(row?.id || "").trim() === affiliateId) || null,
    [affiliateId, rows],
  );

  const departmentLabel = useMemo(() => {
    if (!affiliate) return "-";
    const byId = (
      Array.isArray(referenceDepartments) ? referenceDepartments : []
    ).find(
      (d) =>
        String(d?.id || "").trim() ===
        String(affiliate?.ckan_group_id || "").trim(),
    );
    if (byId?.name) return byId.name;
    return affiliate.department || "-";
  }, [affiliate, referenceDepartments]);

  useEffect(() => {
    if (!affiliateId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await fetchAffiliateRegistry();
        if (cancelled) return;
        setRows(Array.isArray(payload?.rows) ? payload.rows : []);
        setCenters(Array.isArray(payload?.centers) ? payload.centers : []);
      } catch (e) {
        if (cancelled) return;
        setError(String(e?.message || "Unable to load affiliate data."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [affiliateId]);

  useEffect(() => {
    if (!affiliate?.id) {
      setProjectsPanel({ loading: false, error: "", rows: [] });
      return;
    }

    let cancelled = false;
    setProjectsPanel({ loading: true, error: "", rows: [] });
    fetchCkanDatasets({ limit: 200 })
      .then((payload) => {
        if (cancelled) return;
        const datasets = Array.isArray(payload?.data) ? payload.data : [];
        const filtered = filterAffiliateRelatedDatasets(datasets, affiliate);
        setProjectsPanel({ loading: false, error: "", rows: filtered });
      })
      .catch((loadError) => {
        if (cancelled) return;
        setProjectsPanel({
          loading: false,
          error:
            loadError?.message ||
            "Unable to load related projects for this affiliate.",
          rows: [],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [affiliate]);

  useEffect(() => {
    if (!error) return;
    toast.error("Load failed", error);
  }, [error, toast]);

  if (!affiliateId) return <Navigate to="/admin/affiliates" replace />;

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Affiliate Details"
        description="Dedicated view for affiliate profile information and related projects."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="outline">
          <Link to="/admin/affiliates">
            <ChevronLeft className="h-4 w-4" />
            Back to Affiliates
          </Link>
        </Button>
        {affiliate?.source === "ckan_only" ? (
          <Button
            variant="outline"
            onClick={() =>
              toast.error(
                "Read-only record",
                "Users must be edited directly in CKAN.",
              )
            }
          >
            Edit (CKAN)
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => navigate("/admin/affiliates")}
          >
            Edit
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold text-slate-900">
                {affiliate?.full_name || "-"}
              </CardTitle>
              <CardDescription>{affiliate?.email || "-"}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-2 capitalize">
                <Users className="h-4 w-4" />
                {affiliate?.role || "role"}
              </Badge>
              <Badge
                variant={affiliate?.is_active ? "secondary" : "destructive"}
                className="gap-2"
              >
                {affiliate?.is_active ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="secondary" className="gap-2">
                <FolderKanban className="h-4 w-4" />
                {Number(affiliate?.research_project_count || 0)} projects
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {loading ? (
            <p className="text-sm text-slate-600">Loading affiliate...</p>
          ) : error ? (
            <EmptyState title="Unable to load" description={error} />
          ) : !affiliate ? (
            <EmptyState
              title="Affiliate not found"
              description="The requested affiliate could not be found."
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Department
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {departmentLabel}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Research Center
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {affiliate?.ckan_org_id
                        ? centerNameById[affiliate.ckan_org_id] || "-"
                        : "-"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      GS Faculty
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {affiliate?.is_gs_faculty ? "Yes" : "No"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Publications
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {Number(affiliate?.publication_count || 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Awards
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {Number(affiliate?.awards_count || 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      IPs
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {Number(affiliate?.ip_count || 0)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="overflow-hidden">
                <CardHeader className="border-b border-[var(--border)] px-6 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-bold text-slate-900">
                        Related Projects
                      </CardTitle>
                      <CardDescription>
                        Projects linked to this affiliate.
                      </CardDescription>
                    </div>
                    <span className="text-sm text-slate-600">
                      {projectsPanel.rows.length} row(s)
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[420px] overflow-auto">
                    {projectsPanel.loading ? (
                      <p className="p-4 text-sm text-slate-600">
                        Loading related projects...
                      </p>
                    ) : projectsPanel.error ? (
                      <p className="p-4 text-sm text-red-700">
                        {projectsPanel.error}
                      </p>
                    ) : projectsPanel.rows.length === 0 ? (
                      <p className="p-4 text-sm text-slate-600">
                        No related projects found for this affiliate.
                      </p>
                    ) : (
                      <Table className="min-w-[980px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>No.</TableHead>
                            <TableHead>Project Title</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Year</TableHead>
                            <TableHead>Organization</TableHead>
                            <TableHead>Updated</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projectsPanel.rows.map((project, index) => (
                            <TableRow key={project.id || index}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-medium text-slate-900">
                                {project.title || "-"}
                              </TableCell>
                              <TableCell className="capitalize text-slate-700">
                                {project.status || "-"}
                              </TableCell>
                              <TableCell className="text-slate-700">
                                {project.year || "-"}
                              </TableCell>
                              <TableCell className="text-slate-700">
                                {project.organization || "-"}
                              </TableCell>
                              <TableCell className="text-slate-700">
                                {project.updatedAt
                                  ? new Date(project.updatedAt).toLocaleString()
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/20">
                <CardContent className="p-4 text-sm text-slate-700">
                  <p className="text-xs uppercase tracking-[0.06em] text-slate-500">
                    User ID
                  </p>
                  <code className="text-xs">{affiliate?.id || "-"}</code>
                </CardContent>
              </Card>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
