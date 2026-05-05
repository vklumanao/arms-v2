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
  Building2,
  ChevronLeft,
  Eye,
  Facebook,
  FolderKanban,
  Globe,
  Instagram,
  Linkedin,
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
  if (key === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (key === "ongoing" || key === "active")
    return "border-amber-200 bg-amber-50 text-amber-700";
  if (key === "delayed" || key === "rejected" || key === "cancelled")
    return "border-orange-200 bg-orange-50 text-orange-700";
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
  }, [affiliateRows, centerInfo.affiliates]);

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

  return (
    <section className="page-stack-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={() => navigate("/public-records")}>
          <ChevronLeft className="h-4 w-4" />
          Back to Public Records
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6 text-base text-muted-foreground">
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
          <Card className="sticky top-20 z-20 overflow-hidden border border-border bg-card/95 shadow-sm backdrop-blur">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-lg font-bold uppercase text-background shadow-sm">
                    {initials}
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-foreground">
                      {center?.name || "Research Center"}
                    </h1>
                    <p className="text-base text-muted-foreground">
                      Code:{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {center?.code || center?.id || "-"}
                      </span>{" "}
                      | Center Chief:{" "}
                      <span className="font-semibold text-foreground">
                        {center?.center_chief_name || "-"}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="gap-2 text-sm px-3 py-1">
                    <Users className="h-4 w-4" />
                    {summary.researcherCount} affiliates
                  </Badge>
                  <Badge variant="secondary" className="gap-2 text-sm px-3 py-1">
                    <FolderKanban className="h-4 w-4" />
                    {summary.projectCount} projects
                  </Badge>
                  <Badge variant="outline" className="gap-2 text-sm px-3 py-1">
                    <Building2 className="h-4 w-4" />
                    {center?.agenda_count || centerInfo.agendas.length} agenda
                  </Badge>
                  {socialLink ? (
                    <a
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-border hover:text-foreground"
                      href={socialLink}
                      target="_blank"
                      rel="noreferrer"
                      title={socialMeta?.label || "Open link"}
                      aria-label={socialMeta?.label || "Open link"}
                    >
                      <SocialIcon className="h-5 w-5" />
                    </a>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-[var(--border)] px-5 py-4">
                  <CardTitle className="text-base font-semibold text-foreground">
                    Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Description
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {String(center?.description || "").trim() ||
                        "No description provided."}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Members", value: summary.researcherCount },
                      { label: "Projects", value: summary.projectCount },
                      { label: "Agenda", value: agendaDisplay.length },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-lg border border-border bg-muted/40 p-3 text-center"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="mt-1 text-xl font-bold text-foreground">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="border-b border-[var(--border)] px-5 py-4">
                  <CardTitle className="text-base font-semibold text-foreground">
                    Research Agenda
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  {agendaDisplay.length ? (
                    <div className="flex flex-wrap gap-2">
                      {agendaDisplay.map((agenda) => (
                        <span
                          key={agenda}
                          className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-sm font-semibold text-muted-foreground"
                        >
                          {agenda}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No agenda linked.
                    </p>
                  )}
                </CardContent>
              </Card>
            </aside>

            <Card className="overflow-hidden">
              <Tabs value={normalizeTab(activeTab)} onValueChange={setActiveTab}>
                <CardHeader className="border-b border-[var(--border)] px-5 py-4">
                  <TabsList className="w-full justify-start gap-2 bg-transparent p-0">
                    <TabsTrigger value="projects" className="text-base">
                      Projects
                    </TabsTrigger>
                    <TabsTrigger value="affiliates" className="text-base">
                      Affiliates
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                <CardContent className="p-0">
                  <TabsContent value="projects" className="m-0 space-y-0">
                    <div className="border-b border-border p-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <Input
                          placeholder="Search project or lead researcher"
                          value={projectSearch}
                          onChange={(event) => setProjectSearch(event.target.value)}
                        />
                        <Select value={projectStatus} onValueChange={setProjectStatus}>
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
                        <Select value={projectYear} onValueChange={setProjectYear}>
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
                        <div className="overflow-x-auto">
                          <Table className="min-w-[980px] text-base">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-sm">No.</TableHead>
                                <TableHead className="text-sm">Project</TableHead>
                                <TableHead className="text-sm">Status</TableHead>
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
                                  <TableCell className="font-medium text-foreground">
                                    {record.title || "Untitled project"}
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

                  <TabsContent value="affiliates" className="m-0 space-y-0">
                    {normalizedAffiliateRows.length === 0 ? (
                      <div className="p-6">
                        <EmptyState
                          title="No affiliates"
                          description="No linked affiliates found for this research center."
                        />
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <Table className="min-w-[980px] text-base">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-sm">No.</TableHead>
                                <TableHead className="text-sm">Full Name</TableHead>
                                <TableHead className="text-sm">Email</TableHead>
                                <TableHead className="text-sm">Role</TableHead>
                                <TableHead className="text-sm">Department</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {paginatedAffiliates.map((row, idx) => (
                                <TableRow key={row.id || `${idx}`}>
                                  <TableCell>
                                    {(affiliatesPage - 1) * PAGE_SIZE + idx + 1}
                                  </TableCell>
                                  <TableCell className="font-medium text-foreground">
                                    {row?.full_name || "-"}
                                  </TableCell>
                                  <TableCell>{row?.email || "-"}</TableCell>
                                  <TableCell className="capitalize">
                                    {row?.role || "-"}
                                  </TableCell>
                                  <TableCell>{row?.department || "-"}</TableCell>
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
