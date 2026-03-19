import { useEffect, useMemo, useRef, useState } from "react";
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ChevronLeft, FolderKanban, Search, Users } from "lucide-react";

export default function AdminAffiliateDetailPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const affiliateId = String(params?.id || "").trim();
  const { departments: referenceDepartments } = useReferenceData();
  const projectParamsKey = searchParams.toString();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [centers, setCenters] = useState([]);
  const [projectsPanel, setProjectsPanel] = useState({
    loading: false,
    error: "",
    rows: [],
  });
  const [projectSearch, setProjectSearch] = useState(() =>
    String(searchParams.get("projectSearch") || "").trim(),
  );
  const [projectStatus, setProjectStatus] = useState(
    () => String(searchParams.get("projectStatus") || "all").trim() || "all",
  );
  const [projectYear, setProjectYear] = useState(
    () => String(searchParams.get("projectYear") || "all").trim() || "all",
  );
  const prevAffiliateId = useRef(affiliateId);

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

  const initials = useMemo(() => {
    const name = String(affiliate?.full_name || "").trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      const first = parts[0]?.[0] || "";
      const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
      return `${first}${last}`.toUpperCase() || "A";
    }
    const email = String(affiliate?.email || "").trim();
    if (email) return email[0].toUpperCase();
    return "A";
  }, [affiliate]);

  useEffect(() => {
    const nextSearch = String(searchParams.get("projectSearch") || "").trim();
    const nextStatus =
      String(searchParams.get("projectStatus") || "all").trim() || "all";
    const nextYear =
      String(searchParams.get("projectYear") || "all").trim() || "all";

    if (nextSearch !== projectSearch) setProjectSearch(nextSearch);
    if (nextStatus !== projectStatus) setProjectStatus(nextStatus);
    if (nextYear !== projectYear) setProjectYear(nextYear);
  }, [projectParamsKey]);

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (projectSearch) {
          next.set("projectSearch", projectSearch);
        } else {
          next.delete("projectSearch");
        }
        if (projectStatus && projectStatus !== "all") {
          next.set("projectStatus", projectStatus);
        } else {
          next.delete("projectStatus");
        }
        if (projectYear && projectYear !== "all") {
          next.set("projectYear", projectYear);
        } else {
          next.delete("projectYear");
        }
        return next;
      },
      { replace: true },
    );
  }, [projectSearch, projectStatus, projectYear, setSearchParams]);

  const filteredProjects = useMemo(() => {
    const query = String(projectSearch || "")
      .trim()
      .toLowerCase();
    const statusFilter = String(projectStatus || "all").toLowerCase();
    const yearFilter = String(projectYear || "all").toLowerCase();
    return projectsPanel.rows.filter((project) => {
      const status = String(project?.status || "").toLowerCase();
      const year = String(project?.year || "").toLowerCase();
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (yearFilter !== "all" && year !== yearFilter) return false;
      const haystack = [
        project?.title,
        project?.status,
        project?.year,
        project?.organization,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(query);
    });
  }, [projectSearch, projectStatus, projectYear, projectsPanel.rows]);

  const projectStatusOptions = useMemo(() => {
    const unique = new Set();
    projectsPanel.rows.forEach((project) => {
      const value = String(project?.status || "")
        .trim()
        .toLowerCase();
      if (value) unique.add(value);
    });
    return ["all", ...Array.from(unique).sort()];
  }, [projectsPanel.rows]);

  const projectYearOptions = useMemo(() => {
    const unique = new Set();
    projectsPanel.rows.forEach((project) => {
      const value = String(project?.year || "").trim();
      if (value) unique.add(value);
    });
    return ["all", ...Array.from(unique).sort((a, b) => b.localeCompare(a))];
  }, [projectsPanel.rows]);

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
  const clearProjectFilters = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("projectSearch");
        next.delete("projectStatus");
        next.delete("projectYear");
        return next;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if (
      prevAffiliateId.current &&
      prevAffiliateId.current !== affiliateId &&
      (projectSearch || projectStatus !== "all" || projectYear !== "all")
    ) {
      clearProjectFilters();
    }
    prevAffiliateId.current = affiliateId;
  }, [affiliateId, projectSearch, projectStatus, projectYear]);

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
      <PageHeader title="Affiliate Details" />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] px-6 py-5">
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
              <div className="flex flex-wrap items-center justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    clearProjectFilters();
                    navigate("/admin/affiliates");
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to Affiliates
                </Button>
              </div>

              <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-gradient-to-r from-white via-white to-slate-50 p-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-lg font-bold uppercase text-white shadow-sm">
                    {initials}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl font-bold text-slate-900">
                      {affiliate?.full_name || "-"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {affiliate?.email || "-"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="gap-2 capitalize">
                        <Users className="h-4 w-4" />
                        {affiliate?.role || "role"}
                      </Badge>
                      <Badge
                        variant={
                          affiliate?.is_active ? "secondary" : "destructive"
                        }
                        className="gap-2"
                      >
                        {affiliate?.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="secondary" className="gap-2">
                        <FolderKanban className="h-4 w-4" />
                        {Number(affiliate?.research_project_count || 0)}{" "}
                        projects
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {!loading && !error && affiliate ? (
            <>
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-[var(--border)] px-6 py-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-bold text-slate-900">
                        Related Projects
                      </CardTitle>
                      <CardDescription>
                        Projects linked to this affiliate.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-slate-600">
                        {filteredProjects.length} row(s)
                      </span>
                      <label className="relative w-full min-w-[14rem] md:w-auto">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          className="pl-8"
                          placeholder="Search projects"
                          value={projectSearch}
                          onChange={(event) =>
                            setProjectSearch(event.target.value)
                          }
                        />
                      </label>
                      <Select
                        value={projectStatus}
                        onValueChange={setProjectStatus}
                      >
                        <SelectTrigger className="w-full md:w-[12rem] capitalize">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          {projectStatusOptions.map((status) => (
                            <SelectItem
                              key={status}
                              value={status}
                              className="capitalize"
                            >
                              {status === "all" ? "All statuses" : status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={projectYear}
                        onValueChange={setProjectYear}
                      >
                        <SelectTrigger className="w-full md:w-[10rem]">
                          <SelectValue placeholder="All years" />
                        </SelectTrigger>
                        <SelectContent>
                          {projectYearOptions.map((year) => (
                            <SelectItem key={year} value={year}>
                              {year === "all" ? "All years" : year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setProjectSearch("");
                          setProjectStatus("all");
                          setProjectYear("all");
                        }}
                      >
                        Reset filters
                      </Button>
                    </div>
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
                    ) : filteredProjects.length === 0 ? (
                      <div className="p-6">
                        <EmptyState
                          title="No related projects found"
                          description="Try adjusting the search or filters to find matching projects."
                        />
                      </div>
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
                          {filteredProjects.map((project, index) => (
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
            </>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
