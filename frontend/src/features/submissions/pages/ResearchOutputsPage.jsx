import PageHeader from "@/shared/components/layout/PageHeader";
import EmptyState from "@/shared/components/feedback/EmptyState";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { useReferenceData } from "@/shared/hooks/useReferenceData";
import { fetchMyResearchOutputs } from "@/features/submissions/services";
import { EXPECTED_OUTPUT_TYPE_OPTIONS } from "@/features/submissions/utils";
import PaginationControls from "@/shared/components/navigation/PaginationControls";
import { useToast } from "@/app/providers/ToastProvider";

export default function ResearchOutputsPage() {
  const toast = useToast();
  const { profile } = useAuth();
  const { centers } = useReferenceData();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewTarget, setViewTarget] = useState(null);
  const pageSize = 10;

  const isAdmin = String(profile?.role || "").toLowerCase() === "admin";

  useEffect(() => {
    if (!error) return;
    toast.error("Research output load failed", error);
  }, [error, toast]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const payload = await fetchMyResearchOutputs();
        if (!cancelled) {
          setRows(Array.isArray(payload?.data) ? payload.data : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            String(e?.message || "Unable to load research output resources."),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          new Date(
            b?.updated_at || b?.created_at || b?.ckan_last_synced_at || 0,
          ).getTime() -
          new Date(
            a?.updated_at || a?.created_at || a?.ckan_last_synced_at || 0,
          ).getTime(),
      ),
    [rows],
  );

  const centerNameById = useMemo(
    () =>
      (centers || []).reduce((acc, center) => {
        const id = String(center?.id || "").trim();
        if (!id) return acc;
        acc[id] = String(center?.name || "").trim() || id;
        return acc;
      }, {}),
    [centers],
  );

  const outputTypeLabelByValue = useMemo(
    () =>
      (EXPECTED_OUTPUT_TYPE_OPTIONS || []).reduce((acc, item) => {
        const key = String(item?.value || "").trim();
        if (!key) return acc;
        let label = String(item?.label || "").trim();
        if (key === "patent_ip") label = "Patent/IP";
        acc[key] = label || key;
        return acc;
      }, {}),
    [],
  );

  const normalizeResourceName = useMemo(
    () => (value) => {
      const raw = String(value || "").trim();
      if (!raw) return "";

      const targetMatch = raw.match(/^(.+?)\s*\(Target:\s*\d+\)\s*$/i);
      const base = String(targetMatch?.[1] || raw).trim();
      const key = base.toLowerCase().replace(/\s+/g, "_");

      if (outputTypeLabelByValue[key]) return outputTypeLabelByValue[key];
      return base;
    },
    [outputTypeLabelByValue],
  );

  const tableRows = useMemo(
    () =>
      sortedRows.map((row) => {
        const outputTypeRaw = String(row?.output_type || "").trim();
        const outputType =
          outputTypeLabelByValue[outputTypeRaw] ||
          outputTypeRaw.replace(/_/g, "/");
        const orgRef = String(row?.project_ckan_org_id || "").trim();
        const orgLabel =
          String(row?.project_org_name || "").trim() ||
          centerNameById[orgRef] ||
          orgRef ||
          "-";
        const resourceName = normalizeResourceName(row?.file_name);
        const projectTitle = String(row?.project_title || "").trim();
        const datasetName =
          String(row?.ckan_dataset_name || "").trim() ||
          String(row?.ckan_dataset_id || "").trim() ||
          "-";

        return {
          id: row.id,
          title:
            resourceName ||
            [projectTitle, outputType].filter(Boolean).join(" - ") ||
            "Expected output file",
          subtitle: projectTitle || null,
          datasetName,
          datasetId: row?.ckan_dataset_id || null,
          resourceId: row?.ckan_resource_id || null,
          outputType: outputType || "-",
          resourceUrl: row?.file_path || null,
          mimeType: row?.mime_type || null,
          fileSize: Number(row?.file_size || 0) || null,
          notes: row?.notes || null,
          organization: orgLabel,
          private: !row?.project_public_visible,
          state: row?.ckan_sync_status || row?.project_status || "-",
          metadataModified:
            row?.updated_at || row?.created_at || row?.ckan_last_synced_at,
        };
      }),
    [centerNameById, normalizeResourceName, outputTypeLabelByValue, sortedRows],
  );

  const stateOptions = useMemo(
    () =>
      Array.from(
        new Set(
          tableRows
            .map((row) => String(row.state || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [tableRows],
  );

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return tableRows.filter((row) => {
      const rowState = String(row.state || "")
        .trim()
        .toLowerCase();
      const rowVisibility = row.private ? "private" : "public";
      const haystack = [
        row.title,
        row.subtitle,
        row.datasetName,
        row.organization,
        row.resourceId,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      const matchesSearch = query ? haystack.includes(query) : true;
      const matchesState =
        stateFilter === "all" ? true : rowState === stateFilter.toLowerCase();
      const matchesVisibility =
        visibilityFilter === "all" ? true : rowVisibility === visibilityFilter;

      return matchesSearch && matchesState && matchesVisibility;
    });
  }, [searchTerm, stateFilter, tableRows, visibilityFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, stateFilter, visibilityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [currentPage, filteredRows]);

  const resetFilters = () => {
    setSearchTerm("");
    setStateFilter("all");
    setVisibilityFilter("all");
    setCurrentPage(1);
  };

  const formatFileSize = (bytes) => {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value <= 0) return "-";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Research Outputs"
        description={
          isAdmin
            ? "All linked resource files from submitted project datasets."
            : "Your submitted resource files from project expected outputs."
        }
      />

      {loading ? (
        <div className="panel">
          <div className="panel-body text-sm text-slate-600">
            Loading research outputs...
          </div>
        </div>
      ) : null}

      {!loading && !error && !tableRows.length ? (
        <EmptyState
          title="No research outputs found"
          description="No linked expected output resources are available yet."
        />
      ) : null}

      {!loading && !error && tableRows.length ? (
        <div className="page-stack">
          <div className="panel">
            <div className="panel-header">
              <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
                Filters
              </h2>
            </div>
            <div className="panel-body grid gap-3 md:grid-cols-4">
              <label className="block space-y-1">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Search
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="File, dataset, project, org..."
                  className="control-input"
                />
              </label>

              <label className="block space-y-1">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  State
                </span>
                <select
                  value={stateFilter}
                  onChange={(event) => setStateFilter(event.target.value)}
                  className="control-select"
                >
                  <option value="all">All states</option>
                  {stateOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Visibility
                </span>
                <select
                  value={visibilityFilter}
                  onChange={(event) => setVisibilityFilter(event.target.value)}
                  className="control-select"
                >
                  <option value="all">All visibility</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </label>

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="btn btn-outline"
                >
                  Reset
                </button>
                <p className="text-xs text-slate-500">
                  {filteredRows.length} result
                  {filteredRows.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                <tr>
                  <th>No.</th>
                  <th>Resource/File</th>
                  <th>Dataset</th>
                  <th>Organization</th>
                  <th>Visibility</th>
                  <th>State</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
                </thead>
                <tbody className="text-slate-700">
                {paginatedRows.map((row, index) => (
                  <tr key={row.id}>
                    <td>
                      {(currentPage - 1) * pageSize + index + 1}
                    </td>
                    <td>
                      <div className="font-medium">{row.title}</div>
                      {row.subtitle ? (
                        <div className="text-xs text-slate-500">
                          {row.subtitle}
                        </div>
                      ) : null}
                    </td>
                    <td>{row.datasetName || "-"}</td>
                    <td>{row.organization || "-"}</td>
                    <td>
                      <span
                        className={`status-chip ${row.private ? "status-rejected" : "status-completed"}`}
                      >
                        {row.private ? "Private" : "Public"}
                      </span>
                    </td>
                    <td>{row.state || "-"}</td>
                    <td>
                      {row.metadataModified
                        ? new Date(row.metadataModified).toLocaleString()
                        : "-"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setViewTarget(row)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>

          {!filteredRows.length ? (
            <div className="panel">
              <div className="panel-body text-sm text-slate-600">
                No matching results for the selected filters.
              </div>
            </div>
          ) : null}

          {filteredRows.length ? (
            <PaginationControls
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          ) : null}
        </div>
      ) : null}

      {viewTarget ? (
        <div
          className="modal-overlay modal-overlay-centered"
          onClick={() => setViewTarget(null)}
        >
          <aside
            className="modal-dialog modal-dialog-3xl max-h-[92vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-white pb-4">
              <div className="app-card app-card-compact">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                      Resource Details
                    </p>
                    <h2 className="mt-1 break-words text-2xl font-semibold text-slate-900">
                      {viewTarget.title || "-"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {viewTarget.subtitle || "No linked project title"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {viewTarget.resourceUrl ? (
                      <a
                        className="btn btn-outline"
                        href={viewTarget.resourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open Resource
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setViewTarget(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="status-chip status-ongoing">
                    {viewTarget.outputType || "-"}
                  </span>
                  <span
                    className={`status-chip ${viewTarget.private ? "status-rejected" : "status-completed"}`}
                  >
                    {viewTarget.private ? "Private" : "Public"}
                  </span>
                  <span className="status-chip status-proposal">
                    {viewTarget.state || "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="app-card">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                  File Information
                </p>
                <div className="mt-3 grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="app-card-muted app-card-micro">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        File Size
                      </p>
                      <p className="text-base font-semibold text-slate-800">
                        {formatFileSize(viewTarget.fileSize)}
                      </p>
                    </div>
                    <div className="app-card-muted app-card-micro">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        MIME Type
                      </p>
                      <p className="break-words text-base font-semibold text-slate-800">
                        {viewTarget.mimeType || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="app-card-muted app-card-micro">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Notes
                    </p>
                    <p className="text-base text-slate-800">
                      {viewTarget.notes || "-"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="app-card">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                  Project Context
                </p>
                <div className="mt-3 grid gap-3">
                  <div className="app-card-muted app-card-micro">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Organization
                    </p>
                    <p className="text-base font-semibold text-slate-800">
                      {viewTarget.organization || "-"}
                    </p>
                  </div>
                  <div className="app-card-muted app-card-micro">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Dataset
                    </p>
                    <p className="break-words text-base font-semibold text-slate-800">
                      {viewTarget.datasetName || "-"}
                    </p>
                  </div>
                  <div className="app-card-muted app-card-micro">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Last Updated
                    </p>
                    <p className="text-base font-semibold text-slate-800">
                      {viewTarget.metadataModified
                        ? new Date(viewTarget.metadataModified).toLocaleString()
                        : "-"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="app-card lg:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                  Technical IDs
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="app-card-muted app-card-micro">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Dataset ID
                    </p>
                    <p className="break-all text-sm font-semibold text-slate-800">
                      {viewTarget.datasetId || "-"}
                    </p>
                  </div>
                  <div className="app-card-muted app-card-micro">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Resource ID
                    </p>
                    <p className="break-all text-sm font-semibold text-slate-800">
                      {viewTarget.resourceId || "-"}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}



