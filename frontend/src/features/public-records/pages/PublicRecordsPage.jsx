import { useEffect, useMemo, useState } from "react";
import {
  fetchPublicRecordsDataset,
  fetchPublicRecordTimeline,
} from "@/features/public-records/services";
import {
  buildApaCitation,
  buildMlaCitation,
  highlightText,
  INITIAL_PUBLIC_RECORD_FILTERS,
  normalizeForCompare,
  parseSearchTokens,
  PUBLIC_RECORD_PRESETS,
} from "@/features/public-records/utils";
import PageHeader from "@/shared/components/layout/PageHeader";
import PaginationControls from "@/shared/components/navigation/PaginationControls";
import { useToast } from "@/app/providers/ToastProvider";

const PAGE_SIZE = 10;
export default function PublicRecordsPage() {
  const [records, setRecords] = useState([]);
  const [centers, setCenters] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [timelineByProjectId, setTimelineByProjectId] = useState({});
  const [timelineExists, setTimelineExists] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(INITIAL_PUBLIC_RECORD_FILTERS);
  const [activePreset, setActivePreset] = useState("all");
  const [page, setPage] = useState(1);
  const [detailProjectId, setDetailProjectId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (error) toast.error("Public records load issue", error);
  }, [error, toast]);

  useEffect(() => {
    if (message) toast.success("Done", message);
  }, [message, toast]);

  const load = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    const result = await fetchPublicRecordsDataset();
    if (result.error) {
      setRecords([]);
      setError(result.error.message || "Unable to load public records.");
    } else {
      setRecords(result.records || []);
      setCenters(result.centers || []);
      setDepartments(result.departments || []);
      setTimelineExists(result.timelineExists || {});
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
          if (timelineExists[record.id]) score += 1;
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
  }, [records, filters, centerById, departmentById, timelineExists]);

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

  const openDetails = async (projectId) => {
    setDetailProjectId(projectId);
    if (timelineByProjectId[projectId]) return;
    setDetailLoading(true);
    const result = await fetchPublicRecordTimeline(projectId);
    if (result.error) {
      setError(result.error.message || "Unable to load project timeline.");
      setDetailLoading(false);
      return;
    }
    setTimelineByProjectId((prev) => ({
      ...prev,
      [projectId]: result.timeline || [],
    }));
    setDetailLoading(false);
  };
  const selectedRecord = detailProjectId
    ? records.find((record) => record.id === detailProjectId) || null
    : null;

  const selectedTimeline = detailProjectId
    ? timelineByProjectId[detailProjectId] || []
    : [];

  const selectedCenter = selectedRecord
    ? centerById[selectedRecord.research_center_id] || "-"
    : "-";
  const selectedDepartment = selectedRecord
    ? departmentById[selectedRecord.department_id] || "-"
    : "-";

  const apaCitation = selectedRecord
    ? buildApaCitation(selectedRecord, selectedCenter, selectedDepartment)
    : "";
  const mlaCitation = selectedRecord
    ? buildMlaCitation(selectedRecord, selectedCenter, selectedDepartment)
    : "";

  const copyCitation = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label} citation copied.`);
    } catch {
      setError("Unable to copy citation.");
    }
  };

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Public Research Records"
        description="Scholarly index of approved public ARMS research records."
      />

      <section className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="panel h-fit lg:sticky lg:top-5">
          <div className="panel-header">
            <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
              Refine Search
            </h2>
          </div>
          <div className="panel-body grid gap-3">
            <input
              className="control-input"
              placeholder="Search title or abstract (supports year:2025 status:completed)"
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, search: event.target.value }))
              }
            />
            <p className="text-xs text-slate-500">
              Token search: <code>year:</code>, <code>status:</code>,{" "}
              <code>center:</code>, <code>department:</code>,{" "}
              <code>classification:</code>
            </p>

            <select
              className="control-select"
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, status: event.target.value }))
              }
            >
              <option value="">All status</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>

            <select
              className="control-select"
              value={filters.classification}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  classification: event.target.value,
                }))
              }
            >
              <option value="">All classification</option>
              <option value="academic">Academic</option>
              <option value="industry">Industry</option>
            </select>

            <input
              className="control-input"
              placeholder="Year"
              value={filters.year}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, year: event.target.value }))
              }
            />

            <select
              className="control-select"
              value={filters.center}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, center: event.target.value }))
              }
            >
              <option value="">All centers</option>
              {centers.map((center) => (
                <option key={center.id} value={center.name}>
                  {center.name}
                </option>
              ))}
            </select>

            <select
              className="control-select"
              value={filters.department}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  department: event.target.value,
                }))
              }
            >
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.name}>
                  {department.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setFilters(INITIAL_PUBLIC_RECORD_FILTERS);
                setActivePreset("all");
              }}
            >
              Reset Filters
            </button>

            <div className="space-y-2 pt-2">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                Presets
              </p>
              <div className="flex flex-wrap gap-2">
                {PUBLIC_RECORD_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`btn btn-outline ${activePreset === preset.id ? "!border-blue-200 !bg-blue-50 !text-blue-700" : ""}`}
                    onClick={() => applyPreset(preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          <div className="panel">
            <div className="panel-body flex flex-wrap items-center justify-between gap-3">
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
                <select
                  className="control-select"
                  value={filters.sort}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      sort: event.target.value,
                    }))
                  }
                >
                  <option value="most_recent">Sort: Most Recent</option>
                  <option value="a_z">Sort: A-Z</option>
                  <option value="most_complete">
                    Sort: Most Complete Metadata
                  </option>
                  <option value="longest_abstract">
                    Sort: Longest Abstract
                  </option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <section className="panel">
              <div className="panel-body text-sm text-slate-600">
                Loading records...
              </div>
            </section>
          ) : filtered.rows.length === 0 ? (
            <section className="panel">
              <div className="panel-body text-sm text-slate-600">
                No public records match the current filters.
              </div>
            </section>
          ) : (
            <div className="space-y-3">
              {pagedRows.map((record) => (
                <article
                  key={record.id}
                  className="panel cursor-pointer border-l-4 border-l-[var(--border-strong)] transition hover:border-l-[var(--brand)] hover:shadow-sm"
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
                  <div className="panel-body space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {highlightText(record.title, filtered.terms)}
                        </h3>
                        <p className="text-xs uppercase tracking-[0.08em] text-slate-500">
                          {(record.year || "-") +
                            " � " +
                            (centerById[record.research_center_id] ||
                              "Unknown Center") +
                            " � " +
                            (departmentById[record.department_id] ||
                              "Unknown Department") +
                            " � " +
                            (record.classification || "unspecified") +
                            " � " +
                            (record.status || "-")}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className={`status-chip status-${record.status}`}>
                          {record.status}
                        </span>
                        <span className="status-chip status-ongoing">
                          {record.classification || "unspecified"}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed text-slate-700">
                      {record.abstract
                        ? highlightText(record.abstract, filtered.terms)
                        : "No abstract available for this record."}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <span className="status-chip status-ongoing">
                        {record.abstract ? "Has abstract" : "No abstract"}
                      </span>
                      <span className="status-chip status-ongoing">
                        {timelineExists[record.id]
                          ? "Has timeline"
                          : "No timeline"}
                      </span>
                      <span className="status-chip status-ongoing">
                        {record.expected_outputs ? "Has outputs" : "No outputs"}
                      </span>
                      <span
                        className={`status-chip ${record.abstract && record.expected_outputs ? "status-completed" : "status-rejected"}`}
                      >
                        {record.abstract && record.expected_outputs
                          ? "Public-ready"
                          : "Needs enrichment"}
                      </span>
                    </div>

                    <dl className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                        <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                          Research Center
                        </dt>
                        <dd className="font-medium text-slate-800">
                          {centerById[record.research_center_id] || "-"}
                        </dd>
                      </div>

                      <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                        <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                          Department
                        </dt>
                        <dd className="font-medium text-slate-800">
                          {departmentById[record.department_id] || "-"}
                        </dd>
                      </div>

                      <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                        <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                          Start Date
                        </dt>
                        <dd className="font-medium text-slate-800">
                          {record.start_date
                            ? new Date(record.start_date).toLocaleDateString()
                            : "-"}
                        </dd>
                      </div>

                      <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                        <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                          End Date
                        </dt>
                        <dd className="font-medium text-slate-800">
                          {record.end_date
                            ? new Date(record.end_date).toLocaleDateString()
                            : "-"}
                        </dd>
                      </div>
                    </dl>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          openDetails(record.id);
                        }}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </article>
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

      {selectedRecord ? (
        <div
          className="modal-overlay"
          onClick={() => setDetailProjectId(null)}
        >
          <aside
            className="ml-auto h-full w-full max-w-2xl overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-4 sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                Record Details
              </h3>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDetailProjectId(null)}
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div className="app-card app-card-compact">
                <p className="text-xs uppercase tracking-[0.08em] text-slate-500">
                  Title
                </p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {selectedRecord.title}
                </p>
              </div>

              <div className="app-card app-card-compact">
                <p className="mb-2 text-sm font-semibold">Tags</p>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`status-chip status-${selectedRecord.status}`}
                  >
                    {selectedRecord.status || "unknown"}
                  </span>
                  <span className="status-chip status-ongoing">
                    {selectedRecord.classification || "unspecified"}
                  </span>
                  <span className="status-chip status-ongoing">
                    {selectedRecord.year || "No year"}
                  </span>
                  <span className="status-chip status-ongoing">
                    {selectedCenter}
                  </span>
                  <span className="status-chip status-ongoing">
                    {selectedDepartment}
                  </span>
                </div>
              </div>

              <div className="app-card app-card-compact">
                <p className="mb-2 text-sm font-semibold">Full Abstract</p>
                <p className="text-sm text-slate-700">
                  {selectedRecord.abstract || "No abstract available."}
                </p>
              </div>

              <div className="app-card app-card-compact">
                <p className="mb-2 text-sm font-semibold">Related Outputs</p>
                <div className="flex flex-wrap gap-2">
                  {String(selectedRecord.expected_outputs || "")
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean).length === 0 ? (
                    <span className="text-sm text-slate-600">
                      No related outputs listed.
                    </span>
                  ) : (
                    String(selectedRecord.expected_outputs || "")
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean)
                      .map((output) => (
                        <span
                          key={output}
                          className="status-chip status-ongoing"
                        >
                          {output}
                        </span>
                      ))
                  )}
                </div>
              </div>

              <div className="app-card app-card-compact">
                <p className="mb-2 text-sm font-semibold">Timeline</p>
                {detailLoading ? (
                  <p className="text-sm text-slate-600">Loading timeline...</p>
                ) : selectedTimeline.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    No timeline entries available.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {selectedTimeline.map((entry) => (
                      <li
                        key={entry.id}
                        className="app-card app-card-micro"
                      >
                        <p className="font-semibold text-slate-900">
                          {entry.old_status || "none"} -&gt; {entry.new_status}
                        </p>
                        <p className="text-slate-600">
                          {new Date(entry.changed_at).toLocaleString()}
                        </p>
                        {entry.remarks ? (
                          <p className="text-slate-700">{entry.remarks}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="app-card app-card-compact">
                <p className="mb-2 text-sm font-semibold">Cite This Record</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-slate-500">
                      APA
                    </p>
                    <p className="text-sm text-slate-700">{apaCitation}</p>
                    <button
                      type="button"
                      className="btn btn-outline mt-2"
                      onClick={() => copyCitation(apaCitation, "APA")}
                    >
                      Copy APA
                    </button>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-slate-500">
                      MLA
                    </p>
                    <p className="text-sm text-slate-700">{mlaCitation}</p>
                    <button
                      type="button"
                      className="btn btn-outline mt-2"
                      onClick={() => copyCitation(mlaCitation, "MLA")}
                    >
                      Copy MLA
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}






