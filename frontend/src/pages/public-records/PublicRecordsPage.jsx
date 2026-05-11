import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchPublicCenterAffiliates,
  fetchPublicRecordsDataset,
} from "@/services/public-records";
import {
  highlightText,
  INITIAL_PUBLIC_RECORD_FILTERS,
  normalizeForCompare,
  parseSearchTokens,
} from "@/utils/public-records";
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
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { normalizeStatus } from "@/utils/status";
import {
  ArrowRight,
  Eye,
  FileText,
  FolderKanban,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";

const PAGE_SIZE = 10;
const NONE_SELECT_VALUE = "__all__";
const currentYear = String(new Date().getFullYear());

const QUICK_FILTERS = [
  { id: "all", label: "All Records" },
  { id: "completed", label: "Completed" },
  { id: "ongoing", label: "Ongoing" },
  { id: "academic", label: "Academic" },
  { id: "industry", label: "Industry" },
  { id: "this_year", label: "This Year" },
];

const normalizeLabel = (value) => {
  const text = String(value || "").trim();
  if (!text) return "Unknown";
  const normalized = text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return normalized.replace(/\b\w/g, (match) => match.toUpperCase());
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
  return "border-slate-300 bg-slate-50 text-slate-700";
};

const classificationBadgeClass = (classification) => {
  const key = String(classification || "")
    .trim()
    .toLowerCase();
  if (key === "academic") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (key === "industry") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
};

export default function PublicRecordsPage() {
  const [records, setRecords] = useState([]);
  const [centers, setCenters] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [affiliateCountsByCenter, setAffiliateCountsByCenter] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(INITIAL_PUBLIC_RECORD_FILTERS);
  const [activePreset, setActivePreset] = useState("all");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState("cards");
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (error) toast.error("Public records load issue", error);
  }, [error, toast]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 1023px)");
    const syncView = (event) => {
      if (event.matches) setViewMode("cards");
    };
    syncView(media);
    media.addEventListener("change", syncView);
    return () => media.removeEventListener("change", syncView);
  }, []);

  const load = async () => {
    setError("");
    setLoading(true);

    const result = await fetchPublicRecordsDataset();
    if (result.error) {
      setRecords([]);
      setError(result.error.message || "Unable to load public records.");
    } else {
      setRecords(result.records || []);
      setCenters(result.centers || []);
      setDepartments(result.departments || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadAffiliateCounts = async () => {
      if (!centers.length) return;
      const results = await Promise.all(
        centers.map(async (center) => {
          const centerId = String(center?.id || "").trim();
          if (!centerId) return [centerId, null];
          const response = await fetchPublicCenterAffiliates(centerId);
          if (response.error) return [centerId, null];
          return [centerId, (response.rows || []).length];
        }),
      );
      if (cancelled) return;
      const nextCounts = results.reduce((acc, [id, count]) => {
        if (id && Number.isFinite(count)) acc[id] = count;
        return acc;
      }, {});
      setAffiliateCountsByCenter(nextCounts);
    };
    loadAffiliateCounts();
    return () => {
      cancelled = true;
    };
  }, [centers]);

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

  const publicRecords = useMemo(
    () => records.filter((record) => record.public_visible !== false),
    [records],
  );

  const summaryMetrics = useMemo(() => {
    const centerIds = new Set();
    const yearValues = new Set();

    publicRecords.forEach((record) => {
      if (record.research_center_id) {
        centerIds.add(String(record.research_center_id));
      }
      if (record.year) {
        yearValues.add(String(record.year));
      }
    });

    return {
      totalRecords: publicRecords.length,
      totalCenters: centerIds.size,
      totalYears: yearValues.size,
    };
  }, [publicRecords]);

  const centerCards = useMemo(() => {
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

    const counts = publicRecords.reduce((acc, record) => {
      const key = String(record.research_center_id || "").trim();
      if (!key) return acc;
      if (!acc[key]) {
        acc[key] = {
          projects: 0,
          researchers: new Set(),
          publications: 0,
        };
      }
      acc[key].projects += 1;

      const lead = toTokens(record.lead_researcher);
      const faculty = toTokens(record.faculty_team);
      const students = toTokens(record.student_team);
      [...lead, ...faculty, ...students].forEach((name) => {
        acc[key].researchers.add(name);
      });

      if (includesPublicationSignal(record.expected_outputs)) {
        acc[key].publications += 1;
      }

      return acc;
    }, {});

    return centers
      .map((center) => ({
        id: center.id,
        name: center.name,
        description: center.description || center.summary || "",
        count: counts[center.id]?.projects || 0,
        researcherCount:
          (affiliateCountsByCenter[center.id] ??
            counts[center.id]?.researchers.size) ||
          0,
        publicationCount: counts[center.id]?.publications || 0,
      }))
      .filter((center) => center.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [affiliateCountsByCenter, centers, publicRecords]);

  const quickFilterCounts = useMemo(
    () => ({
      all: publicRecords.length,
      completed: publicRecords.filter(
        (record) => normalizeStatus(record.status) === "completed",
      ).length,
      ongoing: publicRecords.filter((record) => {
        const key = normalizeStatus(record.status);
        return key === "ongoing" || key === "active";
      }).length,
      academic: publicRecords.filter(
        (record) =>
          String(record.classification || "")
            .trim()
            .toLowerCase() === "academic",
      ).length,
      industry: publicRecords.filter(
        (record) =>
          String(record.classification || "")
            .trim()
            .toLowerCase() === "industry",
      ).length,
      this_year: publicRecords.filter(
        (record) => String(record.year || "") === currentYear,
      ).length,
    }),
    [publicRecords],
  );

  const filtered = useMemo(() => {
    const { tokens, freeText, terms } = parseSearchTokens(filters.search);
    const rows = publicRecords.filter((record) => {
      if (
        freeText &&
        !`${String(record.title || "")} ${String(record.abstract || "")}`
          .toLowerCase()
          .includes(freeText.toLowerCase())
      ) {
        return false;
      }

      if (filters.status && record.status !== filters.status) return false;
      if (
        filters.classification &&
        record.classification !== filters.classification
      ) {
        return false;
      }
      if (filters.year && String(record.year) !== filters.year) return false;
      if (tokens.year && String(record.year) !== String(tokens.year)) {
        return false;
      }
      if (
        tokens.status &&
        normalizeForCompare(record.status) !==
          normalizeForCompare(tokens.status)
      ) {
        return false;
      }
      if (
        tokens.classification &&
        normalizeForCompare(record.classification) !==
          normalizeForCompare(tokens.classification)
      ) {
        return false;
      }

      if (filters.center) {
        const centerName = centerById[record.research_center_id] || "";
        if (centerName !== filters.center) return false;
      }
      if (tokens.center) {
        const centerName = centerById[record.research_center_id] || "";
        if (
          !normalizeForCompare(centerName).includes(
            normalizeForCompare(tokens.center),
          )
        ) {
          return false;
        }
      }

      if (filters.department) {
        const departmentName = departmentById[record.department_id] || "";
        if (departmentName !== filters.department) return false;
      }
      if (tokens.department) {
        const departmentName = departmentById[record.department_id] || "";
        if (
          !normalizeForCompare(departmentName).includes(
            normalizeForCompare(tokens.department),
          )
        ) {
          return false;
        }
      }

      return true;
    });

    rows.sort((a, b) => {
      if (filters.sort === "a_z") {
        return String(a.title || "").localeCompare(String(b.title || ""));
      }
      if (filters.sort === "most_complete") {
        const completeScore = (record) => {
          let score = 0;
          if (record.abstract) score += 1;
          if (record.expected_outputs) score += 1;
          if (record.start_date && record.end_date) score += 1;
          return score;
        };
        return completeScore(b) - completeScore(a);
      }
      if (filters.sort === "longest_abstract") {
        return (
          String(b.abstract || "").length - String(a.abstract || "").length
        );
      }
      return (
        new Date(b.submitted_at || 0).getTime() -
        new Date(a.submitted_at || 0).getTime()
      );
    });

    return { rows, terms };
  }, [publicRecords, filters, centerById, departmentById]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.rows.slice(start, start + PAGE_SIZE);
  }, [filtered.rows, page]);

  const totalPages = Math.max(1, Math.ceil(filtered.rows.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [
    filters.search,
    filters.status,
    filters.year,
    filters.center,
    filters.department,
    filters.classification,
    filters.sort,
  ]);

  const setFilterValue = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetFilters = () => {
    setFilters(INITIAL_PUBLIC_RECORD_FILTERS);
    setActivePreset("all");
  };

  const applyPreset = (presetId) => {
    setActivePreset(presetId);
    if (presetId === "completed") {
      setFilters((prev) => ({
        ...prev,
        status: "completed",
        classification: "",
        year: "",
      }));
      return;
    }
    if (presetId === "ongoing") {
      setFilters((prev) => ({
        ...prev,
        status: "ongoing",
        classification: "",
        year: "",
      }));
      return;
    }
    if (presetId === "academic") {
      setFilters((prev) => ({
        ...prev,
        classification: "academic",
        status: "",
        year: "",
      }));
      return;
    }
    if (presetId === "industry") {
      setFilters((prev) => ({
        ...prev,
        classification: "industry",
        status: "",
        year: "",
      }));
      return;
    }
    if (presetId === "this_year") {
      setFilters((prev) => ({
        ...prev,
        year: currentYear,
        status: "",
        classification: "",
      }));
      return;
    }
    resetFilters();
  };

  const openDetails = (projectId) => {
    if (!projectId) return;
    if (user || profile) {
      navigate(`/projects/${encodeURIComponent(projectId)}`);
      return;
    }
    navigate(`/public-records/${encodeURIComponent(projectId)}`);
  };

  const openCenterDetails = (centerId) => {
    if (!centerId) return;
    navigate(`/public-research-centers/${encodeURIComponent(centerId)}`);
  };

  const activeFilterPills = useMemo(() => {
    const pills = [];
    if (String(filters.search || "").trim()) {
      pills.push({
        key: "search",
        label: `Search: ${String(filters.search || "").trim()}`,
        clear: () => setFilterValue("search", ""),
      });
    }
    if (filters.status) {
      pills.push({
        key: "status",
        label: `Status: ${normalizeLabel(filters.status)}`,
        clear: () => setFilterValue("status", ""),
      });
    }
    if (filters.classification) {
      pills.push({
        key: "classification",
        label: `Classification: ${normalizeLabel(filters.classification)}`,
        clear: () => setFilterValue("classification", ""),
      });
    }
    if (filters.year) {
      pills.push({
        key: "year",
        label: `Year: ${filters.year}`,
        clear: () => setFilterValue("year", ""),
      });
    }
    if (filters.center) {
      pills.push({
        key: "center",
        label: `Center: ${filters.center}`,
        clear: () => setFilterValue("center", ""),
      });
    }
    if (filters.department) {
      pills.push({
        key: "department",
        label: `Department: ${filters.department}`,
        clear: () => setFilterValue("department", ""),
      });
    }
    return pills;
  }, [filters]);

  const renderAdvancedFilters = () => (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Status
        </p>
        <Select
          value={filters.status || NONE_SELECT_VALUE}
          onValueChange={(value) =>
            setFilterValue("status", value === NONE_SELECT_VALUE ? "" : value)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_SELECT_VALUE}>All status</SelectItem>
            <SelectItem value="ongoing">Ongoing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Classification
        </p>
        <Select
          value={filters.classification || NONE_SELECT_VALUE}
          onValueChange={(value) =>
            setFilterValue(
              "classification",
              value === NONE_SELECT_VALUE ? "" : value,
            )
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All classification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_SELECT_VALUE}>
              All classification
            </SelectItem>
            <SelectItem value="academic">Academic</SelectItem>
            <SelectItem value="industry">Industry</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Year
        </p>
        <Input
          placeholder="e.g. 2025"
          value={filters.year}
          onChange={(event) => setFilterValue("year", event.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Research Center
        </p>
        <Select
          value={filters.center || NONE_SELECT_VALUE}
          onValueChange={(value) =>
            setFilterValue("center", value === NONE_SELECT_VALUE ? "" : value)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All centers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_SELECT_VALUE}>All centers</SelectItem>
            {centers.map((center) => (
              <SelectItem key={center.id} value={center.name}>
                {center.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Department
        </p>
        <Select
          value={filters.department || NONE_SELECT_VALUE}
          onValueChange={(value) =>
            setFilterValue(
              "department",
              value === NONE_SELECT_VALUE ? "" : value,
            )
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_SELECT_VALUE}>All departments</SelectItem>
            {departments.map((department) => (
              <SelectItem key={department.id} value={department.name}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="button" variant="outline" onClick={resetFilters}>
        Clear All Filters
      </Button>
    </div>
  );

  const renderCenterCard = (center) => (
    <div
      role="button"
      tabIndex={0}
      className="group h-full w-full text-left"
      onClick={() => openCenterDetails(center.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openCenterDetails(center.id);
        }
      }}
    >
      <Card className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                Browse by Center
              </p>
              <CardTitle className="mt-2 line-clamp-2 text-xl font-bold text-slate-900">
                {center.name}
              </CardTitle>
              <CardDescription className="mt-2 line-clamp-2">
                {center.description ||
                  "Explore records, affiliates, and publication activity from this research center."}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-slate-400 group-hover:text-slate-900"
              onClick={(event) => {
                event.stopPropagation();
                openCenterDetails(center.id);
              }}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col pt-2">
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Records
                </span>
                <FolderKanban className="h-4 w-4 text-slate-700" />
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">
                {center.count}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Affiliates
                </span>
                <Users className="h-4 w-4 text-slate-700" />
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">
                {center.researcherCount}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Publications
                </span>
                <FileText className="h-4 w-4 text-slate-700" />
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">
                {center.publicationCount}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderRecordCard = (record) => {
    const statusKey = normalizeStatus(record.status);
    const statusLabel = normalizeLabel(statusKey);
    const classificationLabel = normalizeLabel(record.classification);

    return (
      <Card
        key={record.id}
        className="group cursor-pointer rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
        role="button"
        tabIndex={0}
        onClick={() => openDetails(record.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openDetails(record.id);
          }
        }}
      >
        <CardContent className="p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={`px-2.5 capitalize ${statusBadgeClass(record.status)}`}
              >
                {statusLabel}
              </Badge>
              <Badge
                variant="outline"
                className={`px-2.5 ${classificationBadgeClass(record.classification)}`}
              >
                {classificationLabel}
              </Badge>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                {record.year || "Unknown Year"}
              </span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {highlightText(record.title, filtered.terms)}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm leading-7 text-slate-600">
                {record.abstract
                  ? highlightText(record.abstract, filtered.terms)
                  : "No abstract available for this record."}
              </p>
            </div>

            <div className="grid gap-2 text-sm text-slate-600 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Research Center
                </p>
                <p className="mt-1 font-semibold text-slate-800">
                  {centerById[record.research_center_id] || "Unknown Center"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Department
                </p>
                <p className="mt-1 font-semibold text-slate-800">
                  {departmentById[record.department_id] || "Unknown Department"}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Public scholarly record ready for browsing and citation review.
              </p>
              <Button
                type="button"
                variant="outline"
                className="sm:w-auto"
                onClick={(event) => {
                  event.stopPropagation();
                  openDetails(record.id);
                }}
              >
                {user || profile ? "View Project" : "View Details"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderLoadingState = () => (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card
          key={`public-record-skeleton-${index}`}
          className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm"
        >
          <CardContent className="p-5">
            <div className="animate-pulse space-y-4">
              <div className="flex gap-2">
                <div className="h-6 w-24 rounded-full bg-slate-200" />
                <div className="h-6 w-20 rounded-full bg-slate-200" />
                <div className="h-6 w-16 rounded-full bg-slate-200" />
              </div>
              <div className="space-y-2">
                <div className="h-6 w-4/5 rounded-full bg-slate-200" />
                <div className="h-4 w-full rounded-full bg-slate-200" />
                <div className="h-4 w-3/4 rounded-full bg-slate-200" />
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="h-20 rounded-2xl bg-slate-200" />
                <div className="h-20 rounded-2xl bg-slate-200" />
              </div>
              <div className="h-11 w-full rounded-xl bg-slate-200 sm:w-40" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderEmptyState = () => (
    <Card className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 shadow-none">
      <CardContent className="p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
          No Matches Found
        </p>
        <h3 className="mt-3 text-xl font-bold text-slate-900">
          No public records match the current search.
        </h3>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Try a broader keyword, remove a filter, or return to the full public
          catalog.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button type="button" variant="outline" onClick={resetFilters}>
            Clear All Filters
          </Button>
          <Button type="button" onClick={() => setFilterValue("search", "")}>
            Reset Search
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <section className="page-stack-xl">
      <section className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white sm:rounded-[2rem]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_28%),linear-gradient(180deg,rgba(248,250,252,0.94),rgba(255,255,255,1))]" />
        <div className="relative grid gap-5 p-4 sm:gap-6 sm:p-6 lg:p-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)] xl:p-10">
          <div className="space-y-4 sm:space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              Public Research Catalog
            </div>

            <div className="space-y-3">
              <h1 className="max-w-4xl text-slate-900">
                Discover approved research records across centers, departments,
                and institutional output categories.
              </h1>
              <p className="max-w-3xl text-[15px] leading-7 text-slate-600 lg:text-base">
                Browse public-facing records from the CenterPULSE catalog,
                search for titles and abstracts, and explore research centers
                with visible project activity and publication signals.
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Public Records
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {loading ? "--" : summaryMetrics.totalRecords}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Research Centers
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {loading ? "--" : summaryMetrics.totalCenters}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Active Years
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {loading ? "--" : summaryMetrics.totalYears}
                </p>
              </div>
            </div>
          </div>

          <Card className="rounded-[1.5rem] border-slate-200 bg-slate-950 text-white shadow-lg sm:rounded-[1.8rem]">
            <CardHeader className="pb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                Search the Catalog
              </p>
              <CardTitle className="text-xl font-bold text-white sm:text-2xl">
                Start with a title, topic, year, or research center.
              </CardTitle>
              <CardDescription className="text-slate-300">
                Search supports phrases like{" "}
                <span className="font-semibold text-white">year:2025</span> and{" "}
                <span className="font-semibold text-white">
                  status:completed
                </span>
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={filters.search}
                  onChange={(event) =>
                    setFilterValue("search", event.target.value)
                  }
                  placeholder="Search by title, abstract, year, or status"
                  className="border-white/10 bg-white/10 pl-10 text-white placeholder:text-slate-400"
                />
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/15 bg-white/10 text-white hover:bg-white/20 sm:w-full lg:w-auto"
                  onClick={() => setMobileFiltersOpen(true)}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Advanced Filters
                </Button>
                <Button
                  type="button"
                  className="border border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 sm:w-full lg:w-auto"
                  onClick={resetFilters}
                >
                  Reset Catalog View
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="page-stack-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
              Browse by Research Center
            </p>
            <h2 className="mt-2 text-slate-900">
              Explore the centers driving visible research activity.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              Browse by center to discover affiliated activity, publication
              signals, and approved public records from each unit.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card
                key={`center-skeleton-${index}`}
                className="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm"
              >
                <CardContent className="p-5">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 w-28 rounded-full bg-slate-200" />
                    <div className="h-7 w-3/4 rounded-full bg-slate-200" />
                    <div className="h-4 w-full rounded-full bg-slate-200" />
                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="h-24 rounded-2xl bg-slate-200" />
                      <div className="h-24 rounded-2xl bg-slate-200" />
                      <div className="h-24 rounded-2xl bg-slate-200" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : centerCards.length === 0 ? (
          <Card className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 shadow-none">
            <CardContent className="p-6 text-sm text-slate-600">
              No public records have been assigned to research centers yet.
            </CardContent>
          </Card>
        ) : centerCards.length <= 3 ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {centerCards.map((center) => (
              <div key={center.id} className="h-full">
                {renderCenterCard(center)}
              </div>
            ))}
          </div>
        ) : (
          <Carousel
            opts={{ align: "start" }}
            className="relative -mx-4 px-4 sm:mx-0 sm:px-0"
          >
            <CarouselContent>
              {centerCards.map((center) => (
                <CarouselItem
                  key={center.id}
                  className="flex basis-[88%] lg:basis-1/2 xl:basis-1/3"
                >
                  <div className="h-full w-full">
                    {renderCenterCard(center)}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="-left-3 z-10 hidden xl:inline-flex" />
            <CarouselNext className="-right-3 z-10 hidden xl:inline-flex" />
          </Carousel>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="public-records-filter hidden h-fit xl:block">
          <Card className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Advanced Filters
              </p>
              <CardTitle className="text-xl font-bold text-slate-900">
                Refine the public catalog
              </CardTitle>
              <CardDescription>
                Narrow results by status, classification, year, center, or
                department.
              </CardDescription>
            </CardHeader>
            <CardContent>{renderAdvancedFilters()}</CardContent>
          </Card>
        </aside>

        <div className="space-y-4">
          <Card className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                      Search and Quick Filters
                    </p>
                    <div className="relative max-w-2xl">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Search titles, abstracts, years, or tagged phrases"
                        value={filters.search}
                        onChange={(event) =>
                          setFilterValue("search", event.target.value)
                        }
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="hidden flex-col gap-3 xl:flex xl:items-center xl:justify-end">
                    <div className="w-full sm:w-52">
                      <Select
                        value={filters.sort || "most_recent"}
                        onValueChange={(value) => setFilterValue("sort", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="most_recent">
                            Sort: Most Recent
                          </SelectItem>
                          <SelectItem value="a_z">Sort: A-Z</SelectItem>
                          <SelectItem value="most_complete">
                            Sort: Most Complete
                          </SelectItem>
                          <SelectItem value="longest_abstract">
                            Sort: Longest Abstract
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white p-1 xl:inline-flex">
                      <Button
                        type="button"
                        size="sm"
                        variant={viewMode === "cards" ? "secondary" : "ghost"}
                        className="rounded-full"
                        onClick={() => setViewMode("cards")}
                      >
                        <LayoutGrid className="h-4 w-4" />
                        Cards
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={viewMode === "list" ? "secondary" : "ghost"}
                        className="rounded-full"
                        onClick={() => setViewMode("list")}
                      >
                        <List className="h-4 w-4" />
                        List
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {QUICK_FILTERS.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      className={
                        activePreset === preset.id
                          ? "shrink-0 rounded-full border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                          : "shrink-0 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }
                      onClick={() => applyPreset(preset.id)}
                    >
                      {preset.label}
                      <span
                        className={
                          activePreset === preset.id
                            ? "ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white"
                            : "ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                        }
                      >
                        {quickFilterCounts[preset.id]}
                      </span>
                    </Button>
                  ))}
                </div>

                <div className="grid gap-3 xl:hidden">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="w-full">
                      <Select
                        value={filters.sort || "most_recent"}
                        onValueChange={(value) => setFilterValue("sort", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="most_recent">
                            Sort: Most Recent
                          </SelectItem>
                          <SelectItem value="a_z">Sort: A-Z</SelectItem>
                          <SelectItem value="most_complete">
                            Sort: Most Complete
                          </SelectItem>
                          <SelectItem value="longest_abstract">
                            Sort: Longest Abstract
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setMobileFiltersOpen(true)}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        Filters
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetFilters}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Catalog Results
                    </p>
                    <p className="mt-1 text-xl font-bold text-slate-900">
                      {loading
                        ? "Loading public records..."
                        : `${filtered.rows.length} matching records`}
                    </p>
                  </div>

                  {activeFilterPills.length > 0 ? (
                    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 xl:mx-0 xl:flex-wrap xl:overflow-visible xl:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {activeFilterPills.map((pill) => (
                        <button
                          key={pill.key}
                          type="button"
                          className="max-w-[78vw] shrink-0 truncate rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 sm:max-w-none"
                          onClick={pill.clear}
                        >
                          {pill.label} x
                        </button>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                        onClick={resetFilters}
                      >
                        Clear all
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Browse all public records without filters.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {loading ? renderLoadingState() : null}
          {!loading && filtered.rows.length === 0 ? renderEmptyState() : null}

          {!loading && filtered.rows.length > 0 ? (
            viewMode === "list" ? (
              <Card className="hidden overflow-hidden rounded-[1.5rem] border-slate-200 bg-white shadow-sm xl:block">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[90px]">Year</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-[160px]">Status</TableHead>
                      <TableHead className="w-[170px]">
                        Classification
                      </TableHead>
                      <TableHead className="w-[220px]">
                        Research Center
                      </TableHead>
                      <TableHead className="w-[180px]">Department</TableHead>
                      <TableHead className="w-[120px] text-right">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.map((record) => (
                      <TableRow key={record.id} className="align-top">
                        <TableCell className="font-semibold text-slate-700">
                          {record.year || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <p className="font-semibold text-slate-900">
                              {highlightText(record.title, filtered.terms)}
                            </p>
                            <p className="line-clamp-2 text-sm leading-6 text-slate-600">
                              {record.abstract
                                ? highlightText(record.abstract, filtered.terms)
                                : "No abstract available for this record."}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`capitalize ${statusBadgeClass(record.status)}`}
                          >
                            {normalizeLabel(normalizeStatus(record.status))}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={classificationBadgeClass(
                              record.classification,
                            )}
                          >
                            {normalizeLabel(record.classification)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-700">
                          {centerById[record.research_center_id] ||
                            "Unknown Center"}
                        </TableCell>
                        <TableCell className="text-slate-700">
                          {departmentById[record.department_id] ||
                            "Unknown Department"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openDetails(record.id)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : null
          ) : null}

          {!loading && filtered.rows.length > 0 ? (
            <div
              className={
                viewMode === "list"
                  ? "grid gap-4 xl:hidden"
                  : "grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3"
              }
            >
              {pagedRows.map((record) => renderRecordCard(record))}
            </div>
          ) : null}

          {!loading && filtered.rows.length > 0 ? (
            <PaginationControls
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      </section>

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="left" className="w-screen max-w-none sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Refine the Public Catalog</SheetTitle>
            <SheetDescription>
              Adjust advanced filters for status, classification, year, center,
              and department.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Search
              </p>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search by title, abstract, year, or status"
                  value={filters.search}
                  onChange={(event) =>
                    setFilterValue("search", event.target.value)
                  }
                  className="pl-10"
                />
              </div>
            </div>
            {renderAdvancedFilters()}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
