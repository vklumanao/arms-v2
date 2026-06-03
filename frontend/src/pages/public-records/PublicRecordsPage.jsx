import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPublicRecordsDataset } from "@/services/public-records";
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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizeStatus } from "@/utils/status";
import { ArrowRight, Search } from "lucide-react";

const PAGE_SIZE = 10;
const NONE_SELECT_VALUE = "__all__";

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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(INITIAL_PUBLIC_RECORD_FILTERS);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (error) toast.error("Public records load issue", error);
  }, [error, toast]);

  useEffect(() => {
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

    load();
  }, []);

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
  };

  const openDetails = (projectId) => {
    if (!projectId) return;
    if (user || profile) {
      navigate(`/projects/${encodeURIComponent(projectId)}`);
      return;
    }
    navigate(`/public-records/${encodeURIComponent(projectId)}`);
  };
  const renderRecordCard = (record) => {
    const statusKey = normalizeStatus(record.status);
    const statusLabel = normalizeLabel(statusKey);
    const classificationLabel = normalizeLabel(record.classification);

    return (
      <Card
        key={record.id}
        className="group cursor-pointer rounded-[1.25rem] border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
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
              <h3 className="text-lg font-semibold text-slate-900">
                {highlightText(record.title, filtered.terms)}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm leading-7 text-slate-600">
                {record.abstract
                  ? highlightText(record.abstract, filtered.terms)
                  : "No abstract available for this record."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-sm text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                Center: {centerById[record.research_center_id] || "Unknown"}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                Department: {departmentById[record.department_id] || "Unknown"}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <p className="text-sm text-slate-500">
                Public record available for review.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  openDetails(record.id);
                }}
              >
                {user || profile ? "Open" : "View"}
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
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
          Public records
        </p>
        <h1 className="text-slate-900">Public records catalog</h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-600">
          Browse approved records, filter by basic fields, and open a record for
          more detail.
        </p>
      </div>

      <Card className="rounded-[1.25rem] border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="relative md:col-span-2 xl:col-span-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={filters.search}
                onChange={(event) =>
                  setFilterValue("search", event.target.value)
                }
                placeholder="Search titles, abstracts, years, or statuses"
                className="pl-10"
              />
            </div>

            <Select
              value={filters.status || NONE_SELECT_VALUE}
              onValueChange={(value) =>
                setFilterValue(
                  "status",
                  value === NONE_SELECT_VALUE ? "" : value,
                )
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

            <Input
              placeholder="Year"
              value={filters.year}
              onChange={(event) => setFilterValue("year", event.target.value)}
            />

            <Select
              value={filters.center || NONE_SELECT_VALUE}
              onValueChange={(value) =>
                setFilterValue(
                  "center",
                  value === NONE_SELECT_VALUE ? "" : value,
                )
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
                <SelectItem value={NONE_SELECT_VALUE}>
                  All departments
                </SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.name}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.sort || "most_recent"}
              onValueChange={(value) => setFilterValue("sort", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="most_recent">Most recent</SelectItem>
                <SelectItem value="a_z">Title A-Z</SelectItem>
                <SelectItem value="most_complete">Most complete</SelectItem>
                <SelectItem value="longest_abstract">
                  Longest abstract
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Showing {loading ? "--" : filtered.rows.length} matching records.
            </p>
            <Button type="button" variant="outline" onClick={resetFilters}>
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? renderLoadingState() : null}
      {!loading && filtered.rows.length === 0 ? renderEmptyState() : null}

      {!loading && filtered.rows.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
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
    </section>
  );
}
