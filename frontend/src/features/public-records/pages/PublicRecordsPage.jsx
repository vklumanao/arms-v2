import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPublicRecordsDataset } from "@/features/public-records/services";
import {
  highlightText,
  INITIAL_PUBLIC_RECORD_FILTERS,
  normalizeForCompare,
  parseSearchTokens,
  PUBLIC_RECORD_PRESETS,
} from "@/features/public-records/utils";
import PageHeader from "@/shared/components/layout/PageHeader";
import PaginationControls from "@/shared/components/navigation/PaginationControls";
import { useToast } from "@/app/providers/ToastProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizeStatus } from "@/shared/utils/status";

const PAGE_SIZE = 10;
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
  if (key === "ongoing") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (key === "proposal") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (key === "rejected") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const classificationBadgeClass = (classification) => {
  const key = String(classification || "")
    .trim()
    .toLowerCase();
  if (key === "academic") {
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  }
  if (key === "industry") {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
};

export default function PublicRecordsPage() {
  const NONE_SELECT_VALUE = "__all__";
  const [records, setRecords] = useState([]);
  const [centers, setCenters] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(INITIAL_PUBLIC_RECORD_FILTERS);
  const [activePreset, setActivePreset] = useState("all");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (error) toast.error("Public records load issue", error);
  }, [error, toast]);

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

    const counts = records.reduce((acc, record) => {
      if (record.public_visible === false) return acc;
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

      const scholarly = String(record.scholarly_type || "").toLowerCase();
      const expected = String(record.expected_outputs || "");
      if (
        includesPublicationSignal(scholarly) ||
        includesPublicationSignal(expected)
      ) {
        acc[key].publications += 1;
      }

      return acc;
    }, {});

    return centers
      .map((center) => ({
        id: center.id,
        name: center.name,
        count: counts[center.id]?.projects || 0,
        researcherCount: counts[center.id]?.researchers.size || 0,
        publicationCount: counts[center.id]?.publications || 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [centers, records]);

  const filtered = useMemo(() => {
    const { tokens, freeText, terms } = parseSearchTokens(filters.search);
    const rows = records.filter((record) => {
      if (record.public_visible === false) return false;

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
  }, [records, filters, centerById, departmentById]);

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

  const applyPreset = (presetId) => {
    setActivePreset(presetId);
    if (presetId === "completed") {
      setFilters((prev) => ({ ...prev, status: "completed" }));
      return;
    }
    if (presetId === "industry") {
      setFilters((prev) => ({ ...prev, classification: "industry" }));
      return;
    }
    if (presetId === "this_year") {
      setFilters((prev) => ({
        ...prev,
        year: String(new Date().getFullYear()),
      }));
      return;
    }
    setFilters(INITIAL_PUBLIC_RECORD_FILTERS);
  };

  const openDetails = (projectId) => {
    if (!projectId) return;
    if (user || profile) {
      navigate(`/submit-project/${encodeURIComponent(projectId)}`);
      return;
    }
    navigate(`/public-records/${encodeURIComponent(projectId)}`);
  };

  const renderCenterCard = (center) => (
    <Card className="h-full border-slate-200/70 bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-900">
          {center.name}
        </CardTitle>
        <p className="text-sm text-slate-600">
          {center.description || center.summary || "Research center overview."}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Separator />
        <div className="space-y-2 text-sm text-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-600">Projects</span>
            <Badge variant="outline" className="px-2.5">
              {center.count}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-600">Researchers</span>
            <Badge variant="outline" className="px-2.5">
              {center.researcherCount}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-600">Publications</span>
            <Badge variant="outline" className="px-2.5">
              {center.publicationCount}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Public Research Records"
        description="Scholarly index of approved public ARMS research records."
      />

      <section>
        {centerCards.length === 0 ? (
          <Card>
            <CardContent className="p-5 text-sm text-slate-600">
              No public records have been assigned to research centers yet.
            </CardContent>
          </Card>
        ) : centerCards.length <= 3 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {centerCards.map((center) => (
              <div key={center.id}>{renderCenterCard(center)}</div>
            ))}
          </div>
        ) : (
          <Carousel opts={{ align: "start" }} className="relative">
            <CarouselContent>
              {centerCards.map((center) => (
                <CarouselItem
                  key={center.id}
                  className="sm:basis-1/2 lg:basis-1/3"
                >
                  {renderCenterCard(center)}
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="-left-11 z-10" />
            <CarouselNext className="-right-11 z-10" />
          </Carousel>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="public-records-filter h-fit">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
                Refine Search
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input
                placeholder="Search title or abstract (supports year:2025 status:completed)"
                value={filters.search}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    search: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-slate-500">
                Token search: <code>year:</code>, <code>status:</code>,{" "}
                <code>center:</code>, <code>department:</code>,{" "}
                <code>classification:</code>
              </p>

              <Select
                value={filters.status || NONE_SELECT_VALUE}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: value === NONE_SELECT_VALUE ? "" : value,
                  }))
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
                  setFilters((prev) => ({
                    ...prev,
                    classification: value === NONE_SELECT_VALUE ? "" : value,
                  }))
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
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, year: event.target.value }))
                }
              />

              <Select
                value={filters.center || NONE_SELECT_VALUE}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    center: value === NONE_SELECT_VALUE ? "" : value,
                  }))
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
                  setFilters((prev) => ({
                    ...prev,
                    department: value === NONE_SELECT_VALUE ? "" : value,
                  }))
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

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFilters(INITIAL_PUBLIC_RECORD_FILTERS);
                  setActivePreset("all");
                }}
              >
                Reset Filters
              </Button>

              <div className="space-y-2 pt-2">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                  Presets
                </p>
                <div className="flex flex-wrap gap-2">
                  {PUBLIC_RECORD_PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={
                        activePreset === preset.id
                          ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50 hover:text-blue-700"
                          : ""
                      }
                      onClick={() => applyPreset(preset.id)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                  Scholarly Catalog
                </p>
                <p className="text-xl font-semibold text-slate-900">
                  {loading
                    ? "Loading records..."
                    : `${filtered.rows.length} Research Records`}
                </p>
              </div>

              <div className="min-w-48">
                <Select
                  value={filters.sort || "most_recent"}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, sort: value }))
                  }
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
                      Sort: Most Complete Metadata
                    </SelectItem>
                    <SelectItem value="longest_abstract">
                      Sort: Longest Abstract
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <Card>
              <CardContent className="p-5 text-sm text-slate-600">
                Loading records...
              </CardContent>
            </Card>
          ) : filtered.rows.length === 0 ? (
            <Card>
              <CardContent className="p-5 text-sm text-slate-600">
                No public records match the current filters.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pagedRows.map((record) => {
                const statusKey = normalizeStatus(record.status);
                const statusLabel = normalizeLabel(statusKey);
                const classificationLabel = normalizeLabel(
                  record.classification,
                );
                return (
                  <Card
                    key={record.id}
                    className="group cursor-pointer border border-slate-200/80 bg-white shadow-sm transition hover:border-slate-300"
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
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-semibold uppercase tracking-[0.12em] text-slate-400">
                              {record.year || "-"}
                            </span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span>
                              {centerById[record.research_center_id] ||
                                "Unknown Center"}
                            </span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span>
                              {departmentById[record.department_id] ||
                                "Unknown Department"}
                            </span>
                          </div>
                          <h3 className="mt-2 text-lg font-semibold text-slate-900">
                            {highlightText(record.title, filtered.terms)}
                          </h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-700">
                            {record.abstract
                              ? highlightText(record.abstract, filtered.terms)
                              : "No abstract available for this record."}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
                          <Badge
                            variant="outline"
                            className={`px-2.5 capitalize ${statusBadgeClass(
                              record.status,
                            )}`}
                          >
                            {statusLabel}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`px-2.5 ${classificationBadgeClass(
                              record.classification,
                            )}`}
                          >
                            {classificationLabel}
                          </Badge>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="md:mt-2"
                            onClick={(event) => {
                              event.stopPropagation();
                              openDetails(record.id);
                            }}
                          >
                            {user || profile ? "View Project" : "View Details"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {!loading && filtered.rows.length > 0 ? (
            <PaginationControls
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      </section>
    </section>
  );
}
