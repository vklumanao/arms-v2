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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 10;
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

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Public Research Records"
        description="Scholarly index of approved public ARMS research records."
      />

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
              {pagedRows.map((record) => (
                <Card
                  key={record.id}
                  className="cursor-pointer transition hover:shadow-sm"
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
                  <CardContent className="space-y-2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <h3 className="text-base font-semibold text-slate-900">
                          {highlightText(record.title, filtered.terms)}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {[
                            record.year || "-",
                            centerById[record.research_center_id] ||
                              "Unknown Center",
                            departmentById[record.department_id] ||
                              "Unknown Department",
                          ].join(" | ")}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {record.status || "unknown"}
                        </Badge>
                        <Badge variant="outline">
                          {record.classification || "unspecified"}
                        </Badge>
                      </div>
                    </div>

                    <p className="line-clamp-2 text-sm text-slate-700">
                      {record.abstract
                        ? highlightText(record.abstract, filtered.terms)
                        : "No abstract available for this record."}
                    </p>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          openDetails(record.id);
                        }}
                      >
                        {user || profile ? "View Project" : "View Details"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
