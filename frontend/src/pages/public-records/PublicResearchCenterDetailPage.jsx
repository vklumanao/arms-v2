import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchPublicCenterAffiliates,
  fetchPublicRecordsDataset,
} from "@/services/public-records";
import EmptyState from "@/components/feedback/EmptyState";
import PaginationControls from "@/components/navigation/PaginationControls";
import { useToast } from "@/components/providers/ToastProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatStatusLabel, normalizeStatus } from "@/utils/status";
import {
  ArrowUpRight,
  Building2,
  CalendarRange,
  ChevronLeft,
  Eye,
  Facebook,
  FolderKanban,
  Globe,
  Instagram,
  Linkedin,
  Search,
  Sparkles,
  Twitter,
  Users,
  Youtube,
} from "lucide-react";

const PAGE_SIZE = 10;

const toTokens = (value) =>
  String(value || "")
    .split(/[,;\n]+/g)
    .map((token) => token.trim())
    .filter(Boolean);

const formatDisplayDate = (value) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const includesPublicationSignal = (value) => {
  const text = String(value || "").toLowerCase();
  return (
    text.includes("publication") ||
    text.includes("journal") ||
    text.includes("conference") ||
    text.includes("paper")
  );
};

const statusBadgeClass = (status) => {
  const key = normalizeStatus(status);
  if (key === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (key === "ongoing" || key === "active") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (key === "delayed" || key === "rejected" || key === "cancelled") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const getSocialMeta = (url) => {
  const value = String(url || "")
    .trim()
    .toLowerCase();
  if (!value) return null;
  if (value.includes("facebook.com") || value.includes("fb.com")) {
    return { label: "Facebook", icon: Facebook };
  }
  if (value.includes("instagram.com")) {
    return { label: "Instagram", icon: Instagram };
  }
  if (value.includes("x.com") || value.includes("twitter.com")) {
    return { label: "X (Twitter)", icon: Twitter };
  }
  if (value.includes("linkedin.com")) {
    return { label: "LinkedIn", icon: Linkedin };
  }
  if (value.includes("youtube.com") || value.includes("youtu.be")) {
    return { label: "YouTube", icon: Youtube };
  }
  return { label: "Website", icon: Globe };
};

function normalizeTab(value) {
  const tab = String(value || "")
    .trim()
    .toLowerCase();
  if (["affiliates", "projects"].includes(tab)) return tab;
  return "projects";
}

export default function PublicResearchCenterDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, profile } = useAuth();
  const centerId = String(params?.id || "").trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [center, setCenter] = useState(null);
  const [records, setRecords] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeTab, setActiveTab] = useState("projects");
  const [affiliatesPage, setAffiliatesPage] = useState(1);
  const [projectsPage, setProjectsPage] = useState(1);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectStatus, setProjectStatus] = useState("all");
  const [projectYear, setProjectYear] = useState("all");
  const [affiliateRows, setAffiliateRows] = useState([]);

  useEffect(() => {
    if (error) toast.error("Unable to load center", error);
  }, [error, toast]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      const result = await fetchPublicRecordsDataset();
      if (cancelled) return;
      if (result.error) {
        setRecords([]);
        setCenter(null);
        setDepartments([]);
        setError(result.error.message || "Unable to load center records.");
      } else {
        setRecords(result.records || []);
        const centerRow = (result.centers || []).find(
          (row) => String(row?.id || "").trim() === centerId,
        );
        setCenter(centerRow || null);
        setDepartments(result.departments || []);
      }
      setLoading(false);
    };
    if (centerId) load();
    return () => {
      cancelled = true;
    };
  }, [centerId]);

  useEffect(() => {
    let cancelled = false;
    const loadAffiliates = async () => {
      if (!centerId) return;
      const result = await fetchPublicCenterAffiliates(centerId);
      if (cancelled) return;
      if (result.error) return;
      setAffiliateRows(result.rows || []);
    };
    loadAffiliates();
    return () => {
      cancelled = true;
    };
  }, [centerId]);

  const centerRecords = useMemo(
    () =>
      (records || []).filter(
        (record) =>
          record.public_visible !== false &&
          String(record.research_center_id || "").trim() === centerId,
      ),
    [records, centerId],
  );

  const departmentById = useMemo(
    () =>
      (departments || []).reduce((acc, dept) => {
        const id = String(dept?.id || "").trim();
        const name = String(dept?.name || "").trim();
        if (!id) return acc;
        acc[id] = name || id;
        return acc;
      }, {}),
    [departments],
  );

  const centerInfo = useMemo(() => {
    const departmentsSet = new Set();
    const agendasSet = new Set();
    const leadSet = new Set();
    const affiliateSet = new Set();
    const years = [];
    let latestSubmittedAt = null;

    centerRecords.forEach((record) => {
      const deptId = String(record.department_id || "").trim();
      if (deptId) departmentsSet.add(departmentById[deptId] || deptId);

      const agendaName =
        String(record.research_agenda_name || "").trim() ||
        String(record.research_agenda_id || "").trim();
      if (agendaName) agendasSet.add(agendaName);

      const lead = toTokens(record.lead_researcher);
      const faculty = toTokens(record.faculty_team);
      const students = toTokens(record.student_team);
      lead.forEach((name) => leadSet.add(name));
      [...lead, ...faculty, ...students].forEach((name) =>
        affiliateSet.add(name),
      );

      const yearValue = Number(record.year);
      if (Number.isFinite(yearValue)) years.push(yearValue);

      const submittedAt = record.submitted_at
        ? new Date(record.submitted_at)
        : null;
      if (submittedAt && !Number.isNaN(submittedAt.getTime())) {
        if (!latestSubmittedAt || submittedAt > latestSubmittedAt) {
          latestSubmittedAt = submittedAt;
        }
      }
    });

    const yearsSorted = years.sort((a, b) => a - b);
    const yearSpan =
      yearsSorted.length > 0
        ? yearsSorted[0] === yearsSorted[yearsSorted.length - 1]
          ? String(yearsSorted[0])
          : `${yearsSorted[0]} - ${yearsSorted[yearsSorted.length - 1]}`
        : "-";

    return {
      departments: Array.from(departmentsSet).sort(),
      agendas: Array.from(agendasSet).sort(),
      leads: Array.from(leadSet).sort(),
      affiliates: Array.from(affiliateSet).sort(),
      yearSpan,
      latestSubmittedAt,
    };
  }, [centerRecords, departmentById]);

  const normalizedAffiliateRows = useMemo(() => {
    if (affiliateRows.length) {
      return affiliateRows.map((row) => ({
        id: row.id || row.name,
        full_name: row.full_name || row.name || "-",
        email: row.email || "-",
        role: row.role || "-",
        department: row.department || "-",
      }));
    }
    return [];
  }, [affiliateRows]);

  const summary = useMemo(() => {
    let publications = 0;

    centerRecords.forEach((record) => {
      const expected = String(record.expected_outputs || "");
      if (includesPublicationSignal(expected)) {
        publications += 1;
      }
    });

    return {
      projectCount: centerRecords.length,
      researcherCount: normalizedAffiliateRows.length,
      publicationCount: publications,
    };
  }, [centerRecords, normalizedAffiliateRows.length]);

  const agendaDisplay = (() => {
    if (Array.isArray(center?.agenda_names) && center.agenda_names.length > 0) {
      return center.agenda_names;
    }
    return centerInfo.agendas;
  })();

  const socialLink = String(center?.social_media_link || "").trim();
  const socialMeta = getSocialMeta(socialLink);
  const SocialIcon = socialMeta?.icon || Globe;

  const paginatedAffiliates = useMemo(() => {
    const start = (affiliatesPage - 1) * PAGE_SIZE;
    return normalizedAffiliateRows.slice(start, start + PAGE_SIZE);
  }, [normalizedAffiliateRows, affiliatesPage]);

  const affiliatesTotalPages = Math.max(
    1,
    Math.ceil(normalizedAffiliateRows.length / PAGE_SIZE),
  );

  const filteredProjects = useMemo(() => {
    return centerRecords.filter((record) => {
      if (
        projectSearch &&
        !`${String(record.title || "")} ${String(record.lead_researcher || "")}`
          .toLowerCase()
          .includes(projectSearch.toLowerCase())
      ) {
        return false;
      }
      if (projectStatus !== "all") {
        const normalized = normalizeStatus(record.status);
        if (normalized !== projectStatus) return false;
      }
      if (projectYear !== "all" && String(record.year) !== projectYear) {
        return false;
      }
      return true;
    });
  }, [centerRecords, projectSearch, projectStatus, projectYear]);

  const projectYearOptions = useMemo(() => {
    const years = new Set();
    centerRecords.forEach((record) => {
      if (record.year) years.add(String(record.year));
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [centerRecords]);

  const paginatedProjects = useMemo(() => {
    const start = (projectsPage - 1) * PAGE_SIZE;
    return filteredProjects.slice(start, start + PAGE_SIZE);
  }, [filteredProjects, projectsPage]);

  const projectsTotalPages = Math.max(
    1,
    Math.ceil(filteredProjects.length / PAGE_SIZE),
  );

  useEffect(() => {
    setAffiliatesPage(1);
  }, [centerId]);

  useEffect(() => {
    setProjectsPage(1);
  }, [centerId, projectSearch, projectStatus, projectYear]);

  const initials = useMemo(() => {
    const name = String(center?.name || "").trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      const first = parts[0]?.[0] || "";
      const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
      return `${first}${last}`.toUpperCase() || "RC";
    }
    return "RC";
  }, [center]);

  const openDetails = (projectId) => {
    if (!projectId) return;
    if (user || profile) {
      navigate(`/projects/${encodeURIComponent(projectId)}`);
      return;
    }
    navigate(`/public-records/${encodeURIComponent(projectId)}`);
  };

  if (!centerId) {
    return (
      <section className="page-stack-lg">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Research center not found.
          </CardContent>
        </Card>
      </section>
    );
  }

  const snapshotItems = [
    {
      label: "Active public projects",
      value: summary.projectCount,
      icon: FolderKanban,
      tone: "from-emerald-500/15 to-emerald-500/5 text-emerald-700",
    },
    {
      label: "Listed affiliates",
      value: summary.researcherCount,
      icon: Users,
      tone: "from-slate-900/10 to-slate-900/5 text-slate-700",
    },
    {
      label: "Publication signals",
      value: summary.publicationCount,
      icon: Sparkles,
      tone: "from-amber-500/15 to-amber-500/5 text-amber-700",
    },
    {
      label: "Coverage years",
      value: centerInfo.yearSpan,
      icon: CalendarRange,
      tone: "from-sky-500/15 to-sky-500/5 text-sky-700",
    },
  ];

  return (
    <section className="page-stack-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={() => navigate("/public-records")}>
          <ChevronLeft className="h-4 w-4" />
          Back to Public Records
        </Button>
      </div>

      {loading ? (
        <Card className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-8 text-base text-slate-600">
            Loading research center...
          </CardContent>
        </Card>
      ) : error ? (
        <EmptyState title="Unable to load" description={error} />
      ) : !center ? (
        <EmptyState
          title="Research center not found"
          description="The requested research center could not be found or you do not have access."
        />
      ) : (
        <>
          <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_24%),radial-gradient(circle_at_left_center,rgba(15,23,42,0.06),transparent_28%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))]" />
            <div className="relative p-5 sm:p-7 lg:p-8">
              <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-4xl space-y-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">
                      Public Research Center
                    </p>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem] bg-slate-900 text-xl font-bold uppercase text-white shadow-lg shadow-slate-900/10">
                        {initials}
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <h1 className="text-slate-900">
                            {center?.name || "Research Center"}
                          </h1>
                          <p className="max-w-3xl text-[15px] leading-7 text-slate-600 lg:text-base">
                            {String(center?.description || "").trim() ||
                              "Discover the center's public-facing research activity, active agenda coverage, and the affiliates contributing to its scholarly work."}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                            Code:{" "}
                            <span className="ml-1 font-mono text-slate-900">
                              {center?.code || center?.id || "-"}
                            </span>
                          </span>
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                            Center Chief:{" "}
                            <span className="ml-1 text-slate-900">
                              {center?.center_chief_name || "-"}
                            </span>
                          </span>
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            {agendaDisplay.length} research
                            {agendaDisplay.length === 1
                              ? " agenda"
                              : " agendas"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:max-w-sm xl:justify-end">
                    {socialLink ? (
                      <Button asChild variant="outline">
                        <a
                          href={socialLink}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={socialMeta?.label || "Visit website"}
                        >
                          <SocialIcon className="h-4 w-4" />
                          {socialMeta?.label || "Visit website"}
                          <ArrowUpRight className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {snapshotItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className={`rounded-[1.5rem] border border-slate-200 bg-gradient-to-br ${item.tone} p-4 shadow-sm`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                              {item.label}
                            </p>
                            <p className="text-2xl font-bold text-slate-900">
                              {item.value}
                            </p>
                          </div>
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-slate-700 shadow-sm">
                            <Icon className="h-5 w-5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
              <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                <CardHeader className="border-b border-slate-100 px-5 py-4">
                  <CardTitle className="text-lg font-bold text-slate-900">
                    Center Snapshot
                  </CardTitle>
                  <CardDescription>
                    A quick public summary of this center&apos;s research
                    footprint.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 p-5">
                  {[
                    ["Lead researchers", centerInfo.leads.length || "-"],
                    [
                      "Departments linked",
                      centerInfo.departments.length || "-",
                    ],
                    [
                      "Latest public submission",
                      formatDisplayDate(centerInfo.latestSubmittedAt),
                    ],
                    ["Project coverage", centerInfo.yearSpan],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        {label}
                      </p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">
                        {value}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                <CardHeader className="border-b border-slate-100 px-5 py-4">
                  <CardTitle className="text-lg font-bold text-slate-900">
                    Research Agendas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  {agendaDisplay.length ? (
                    <div className="flex flex-wrap gap-2">
                      {agendaDisplay.map((agenda) => (
                        <span
                          key={agenda}
                          className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700"
                        >
                          {agenda}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">No agenda linked.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                <CardHeader className="border-b border-slate-100 px-5 py-4">
                  <CardTitle className="text-lg font-bold text-slate-900">
                    Departments
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  {centerInfo.departments.length ? (
                    <div className="grid gap-2">
                      {centerInfo.departments.map((department) => (
                        <div
                          key={department}
                          className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700"
                        >
                          {department}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">
                      No departments linked.
                    </p>
                  )}
                </CardContent>
              </Card>
            </aside>

            <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
              <Tabs
                value={normalizeTab(activeTab)}
                onValueChange={setActiveTab}
              >
                <CardHeader className="border-b border-slate-100 px-5 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-bold text-slate-900">
                        Center Activity
                      </CardTitle>
                      <CardDescription>
                        Browse linked public projects and published affiliates
                        from this research center.
                      </CardDescription>
                    </div>
                    <TabsList className="h-auto w-full justify-start gap-2 rounded-2xl bg-slate-100/80 p-1 sm:w-auto">
                      <TabsTrigger
                        value="projects"
                        className="rounded-xl px-4 py-2 text-sm"
                      >
                        Projects
                      </TabsTrigger>
                      <TabsTrigger
                        value="affiliates"
                        className="rounded-xl px-4 py-2 text-sm"
                      >
                        Affiliates
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <TabsContent value="projects" className="m-0">
                    <div className="border-b border-slate-100 p-4 sm:p-5">
                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_220px_180px]">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            placeholder="Search project title or lead researcher"
                            value={projectSearch}
                            onChange={(event) =>
                              setProjectSearch(event.target.value)
                            }
                            className="pl-9"
                          />
                        </div>
                        <Select
                          value={projectStatus}
                          onValueChange={setProjectStatus}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All status</SelectItem>
                            <SelectItem value="ongoing">Ongoing</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="delayed">Delayed</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={projectYear}
                          onValueChange={setProjectYear}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Year" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All years</SelectItem>
                            {projectYearOptions.map((year) => (
                              <SelectItem key={year} value={year}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-700">
                          {filteredProjects.length} matching project
                          {filteredProjects.length === 1 ? "" : "s"}
                        </span>
                        <span>
                          Explore public records connected to this center&apos;s
                          agenda and leadership.
                        </span>
                      </div>
                    </div>

                    {filteredProjects.length === 0 ? (
                      <div className="p-6">
                        <EmptyState
                          title="No projects"
                          description="No linked projects found for this research center."
                        />
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-4 p-4 sm:p-5 lg:hidden">
                          {paginatedProjects.map((record) => (
                            <Card
                              key={record.id}
                              className="rounded-[1.25rem] border border-slate-200 bg-white shadow-sm"
                            >
                              <CardContent className="space-y-4 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-2">
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${statusBadgeClass(record.status)}`}
                                    >
                                      {formatStatusLabel(record.status) || "-"}
                                    </Badge>
                                    <h3 className="text-base font-bold text-slate-900">
                                      {record.title || "Untitled project"}
                                    </h3>
                                  </div>
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                    {record.year || "-"}
                                  </span>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                      Lead Researcher
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">
                                      {record.lead_researcher || "-"}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                      Expected Outputs
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">
                                      {record.expected_outputs || "-"}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full"
                                  onClick={() => openDetails(record.id)}
                                >
                                  <Eye className="h-4 w-4" />
                                  View project details
                                </Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        <div className="hidden overflow-x-auto lg:block">
                          <Table className="min-w-[980px] text-base">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-sm">No.</TableHead>
                                <TableHead className="text-sm">
                                  Project
                                </TableHead>
                                <TableHead className="text-sm">
                                  Status
                                </TableHead>
                                <TableHead className="text-sm">Year</TableHead>
                                <TableHead className="text-sm">
                                  Lead Researcher
                                </TableHead>
                                <TableHead className="text-sm text-right">
                                  Action
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {paginatedProjects.map((record, idx) => (
                                <TableRow key={record.id}>
                                  <TableCell>
                                    {(projectsPage - 1) * PAGE_SIZE + idx + 1}
                                  </TableCell>
                                  <TableCell className="font-medium text-slate-900">
                                    <div className="space-y-1">
                                      <p>
                                        {record.title || "Untitled project"}
                                      </p>
                                      <p className="text-sm text-slate-500">
                                        {record.expected_outputs ||
                                          "No output summary"}
                                      </p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={`text-sm ${statusBadgeClass(record.status)}`}
                                    >
                                      {formatStatusLabel(record.status) || "-"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{record.year || "-"}</TableCell>
                                  <TableCell>
                                    {record.lead_researcher || "-"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9"
                                      onClick={() => openDetails(record.id)}
                                    >
                                      <Eye className="h-5 w-5" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <PaginationControls
                          page={projectsPage}
                          totalPages={projectsTotalPages}
                          onPageChange={setProjectsPage}
                          className="border-t"
                        />
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="affiliates" className="m-0">
                    {normalizedAffiliateRows.length === 0 ? (
                      <div className="p-6">
                        <EmptyState
                          title="No affiliates"
                          description="No linked affiliates found for this research center."
                        />
                      </div>
                    ) : (
                      <>
                        <div className="border-b border-slate-100 p-4 sm:p-5">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-700">
                              {normalizedAffiliateRows.length} listed affiliate
                              {normalizedAffiliateRows.length === 1 ? "" : "s"}
                            </span>
                            <span>
                              People connected to this center&apos;s visible
                              public research work.
                            </span>
                          </div>
                        </div>

                        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:hidden">
                          {paginatedAffiliates.map((row) => {
                            const personName = String(row?.full_name || "-");
                            const personInitials =
                              personName
                                .split(/\s+/)
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((part) => part[0]?.toUpperCase() || "")
                                .join("") || "A";
                            return (
                              <Card
                                key={row.id || personName}
                                className="rounded-[1.25rem] border border-slate-200 bg-white shadow-sm"
                              >
                                <CardContent className="space-y-4 p-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-sm font-bold text-emerald-700">
                                      {personInitials}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-base font-bold text-slate-900">
                                        {personName}
                                      </p>
                                      <p className="truncate text-sm text-slate-600">
                                        {row?.role || "-"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="grid gap-3">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                        Department
                                      </p>
                                      <p className="mt-1 text-sm font-semibold text-slate-900">
                                        {row?.department || "-"}
                                      </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                        Email
                                      </p>
                                      <p className="mt-1 break-all text-sm font-semibold text-slate-900">
                                        {row?.email || "-"}
                                      </p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>

                        <div className="hidden overflow-x-auto xl:block">
                          <Table className="min-w-[980px] text-base">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-sm">No.</TableHead>
                                <TableHead className="text-sm">
                                  Full Name
                                </TableHead>
                                <TableHead className="text-sm">Email</TableHead>
                                <TableHead className="text-sm">Role</TableHead>
                                <TableHead className="text-sm">
                                  Department
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {paginatedAffiliates.map((row, idx) => (
                                <TableRow key={row.id || `${idx}`}>
                                  <TableCell>
                                    {(affiliatesPage - 1) * PAGE_SIZE + idx + 1}
                                  </TableCell>
                                  <TableCell className="font-medium text-slate-900">
                                    {row?.full_name || "-"}
                                  </TableCell>
                                  <TableCell>{row?.email || "-"}</TableCell>
                                  <TableCell className="capitalize">
                                    {row?.role || "-"}
                                  </TableCell>
                                  <TableCell>
                                    {row?.department || "-"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <PaginationControls
                          page={affiliatesPage}
                          totalPages={affiliatesTotalPages}
                          onPageChange={setAffiliatesPage}
                          className="border-t"
                        />
                      </>
                    )}
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
