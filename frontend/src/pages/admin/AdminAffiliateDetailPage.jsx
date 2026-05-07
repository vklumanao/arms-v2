import { useEffect, useMemo, useRef, useState } from "react";
import {
  Navigate,
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
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

  const centerLabel = useMemo(() => {
    if (!affiliate) return "-";
    return affiliate?.ckan_org_id
      ? centerNameById[affiliate.ckan_org_id] || "-"
      : "-";
  }, [affiliate, centerNameById]);

  const profileFacts = useMemo(
    () => [
      ["Email", affiliate?.email || "-"],
      ["Research Center", centerLabel],
      ["Department", departmentLabel],
      ["Designation", affiliate?.designation || "-"],
      ["Employment Status", affiliate?.employment_status || "-"],
      ["GS Faculty", affiliate?.is_gs_faculty ? "Yes" : "No"],
    ],
    [affiliate, centerLabel, departmentLabel],
  );

  const activityCards = useMemo(
    () => [
      {
        label: "Projects",
        value: Number(affiliate?.research_project_count || 0),
        icon: FolderKanban,
      },
      {
        label: "Publications",
        value: Number(affiliate?.publication_count || 0),
        icon: Users,
      },
      {
        label: "Awards",
        value: Number(affiliate?.awards_count || 0),
        icon: FolderKanban,
      },
      {
        label: "IPs",
        value: Number(affiliate?.ip_count || 0),
        icon: FolderKanban,
      },
    ],
    [affiliate],
  );

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
    <section className="page-stack-xl">
      {loading ? (
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          Loading affiliate...
        </div>
      ) : error ? (
        <EmptyState title="Unable to load" description={error} />
      ) : !affiliate ? (
        <EmptyState
          title="Affiliate not found"
          description="The requested affiliate could not be found."
        />
      ) : (
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,1))]" />
          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">
                  Affiliate Workspace
                </p>
                <div className="space-y-2">
                  <h1 className="text-slate-900">
                    {affiliate?.full_name || "Affiliate Profile"}
                  </h1>
                  <p className="max-w-3xl text-[15px] leading-7 text-slate-600 lg:text-base">
                    Review affiliate identity, affiliations, account standing,
                    and related research activity from one mobile-first admin
                    page.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
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
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 capitalize">
                {affiliate?.role || "Affiliate"}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                {affiliate?.is_active ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {activityCards.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-slate-500">
                      <Icon className="h-4 w-4" />
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em]">
                        {item.label}
                      </p>
                    </div>
                    <p className="mt-3 text-3xl font-bold leading-none text-slate-900">
                      {item.value}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
              <div className="space-y-4">
                <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                  <CardHeader className="border-b border-slate-100 px-5 py-4">
                    <CardTitle className="text-lg font-bold text-slate-900">
                      Profile Overview
                    </CardTitle>
                    <CardDescription>
                      Core identity and affiliation details for this affiliate.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5 p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xl font-bold uppercase text-white shadow">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-lg font-bold text-slate-900">
                          {affiliate?.full_name || "-"}
                        </p>
                        <p className="mt-1 text-sm text-slate-600 break-all">
                          {affiliate?.email || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {profileFacts.map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                            {label}
                          </p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-slate-900 break-words">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm xl:sticky xl:top-5">
                  <CardHeader className="border-b border-slate-100 px-5 py-4">
                    <CardTitle className="text-lg font-bold text-slate-900">
                      Administrative Context
                    </CardTitle>
                    <CardDescription>
                      Compact account context for administrative review.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 p-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        Record ID
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {affiliate?.id || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        Role
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900 capitalize">
                        {affiliate?.role || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        Account Status
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {affiliate?.is_active ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        Directory Scope
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        Managed under the affiliates registry and linked project
                        catalog.
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        Navigation
                      </p>
                      <Link
                        className="mt-2 inline-flex items-center text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
                        to="/admin/affiliates"
                      >
                        Return to all affiliates
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="overflow-hidden border border-black/20 bg-white shadow-sm">
              <CardHeader className="border-b border-zinc-200 px-6 py-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold text-black">
                      Related Projects
                    </CardTitle>
                    <CardDescription className="text-zinc-600">
                      Projects linked to this affiliate.
                    </CardDescription>
                  </div>
                  <p className="text-sm text-zinc-600">
                    {filteredProjects.length} row(s).
                  </p>
                </div>
              </CardHeader>

              <CardContent className="p-4">
                <div className="rounded-2xl border border-black/20 bg-white/95 p-4 shadow-sm backdrop-blur">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <label className="relative w-full lg:max-w-md">
                      <span className="sr-only">Search projects</span>
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
                      <Input
                        className="pl-9"
                        placeholder="Search projects"
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                      />
                    </label>

                    <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
                      <Select
                        value={projectStatus}
                        onValueChange={setProjectStatus}
                      >
                        <SelectTrigger className="w-full sm:w-[160px] capitalize">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="border border-zinc-300 bg-white shadow-md">
                          {projectStatusOptions.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status === "all" ? "All statuses" : status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={projectYear}
                        onValueChange={setProjectYear}
                      >
                        <SelectTrigger className="w-full sm:w-[140px]">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent className="border border-zinc-300 bg-white shadow-md">
                          {projectYearOptions.map((year) => (
                            <SelectItem key={year} value={year}>
                              {year === "all" ? "All years" : year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-xs text-black hover:text-black"
                        onClick={() => {
                          setProjectSearch("");
                          setProjectStatus("all");
                          setProjectYear("all");
                        }}
                      >
                        Reset all
                      </Button>
                    </div>
                  </div>

                  {projectSearch ||
                  projectStatus !== "all" ||
                  projectYear !== "all" ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-black">
                        Active Filters
                      </span>
                      {projectSearch ? (
                        <button
                          type="button"
                          className="rounded-full border border-black/20 bg-zinc-100 px-3 py-1 text-xs font-semibold text-black"
                          onClick={() => setProjectSearch("")}
                        >
                          Search: "{projectSearch}" x
                        </button>
                      ) : null}
                      {projectStatus !== "all" ? (
                        <button
                          type="button"
                          className="rounded-full border border-black/20 bg-zinc-100 px-3 py-1 text-xs font-semibold text-black"
                          onClick={() => setProjectStatus("all")}
                        >
                          Status: {projectStatus} x
                        </button>
                      ) : null}
                      {projectYear !== "all" ? (
                        <button
                          type="button"
                          className="rounded-full border border-black/20 bg-zinc-100 px-3 py-1 text-xs font-semibold text-black"
                          onClick={() => setProjectYear("all")}
                        >
                          Year: {projectYear} x
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </CardContent>

              <CardContent className="md:hidden p-4 pt-0">
                {projectsPanel.loading ? (
                  <p className="text-sm text-zinc-600">
                    Loading related projects...
                  </p>
                ) : projectsPanel.error ? (
                  <p className="text-sm text-zinc-700">{projectsPanel.error}</p>
                ) : filteredProjects.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-600">
                    No related projects found for this affiliate.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredProjects.map((project, index) => (
                      <div
                        key={project.id || index}
                        className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-zinc-900">
                              {project.title || "-"}
                            </p>
                            <p className="mt-1 text-sm text-zinc-600">
                              {project.organization || "-"}
                            </p>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {project.status || "-"}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                              Year
                            </p>
                            <p className="mt-1 text-sm font-semibold text-zinc-900">
                              {project.year || "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                              Updated
                            </p>
                            <p className="mt-1 text-sm text-zinc-700">
                              {project.updatedAt
                                ? new Date(project.updatedAt).toLocaleString()
                                : "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>

              <CardContent className="hidden p-0 md:block">
                {projectsPanel.loading ? (
                  <div className="p-4 text-sm text-zinc-600">
                    Loading related projects...
                  </div>
                ) : projectsPanel.error ? (
                  <div className="p-4 text-sm text-zinc-700">
                    {projectsPanel.error}
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-auto">
                    <Table>
                      <TableHeader className="bg-zinc-50/80 text-zinc-600">
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
                        {filteredProjects.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="py-8 text-center text-sm text-zinc-600"
                            >
                              No related projects found for this affiliate.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredProjects.map((project, index) => (
                            <TableRow key={project.id || index}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-medium">
                                {project.title || "-"}
                              </TableCell>
                              <TableCell className="capitalize">
                                {project.status || "-"}
                              </TableCell>
                              <TableCell>{project.year || "-"}</TableCell>
                              <TableCell>
                                {project.organization || "-"}
                              </TableCell>
                              <TableCell>
                                {project.updatedAt
                                  ? new Date(project.updatedAt).toLocaleString()
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}
