import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/shared/components/layout/PageHeader";
import EmptyState from "@/shared/components/feedback/EmptyState";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";
import PaginationControls from "@/shared/components/navigation/PaginationControls";
import { useAuth } from "@/app/providers/AuthProvider";
import { useToast } from "@/app/providers/ToastProvider";
import {
  deleteAwardRecognitionRecord,
  listAwardRecognitionRecords,
} from "@/features/submissions/services";
import {
  Award,
  Building2,
  PencilLine,
  Search,
  Trash2,
  Users,
} from "lucide-react";

const AWARDS_PAGE_SIZE = 10;

export default function AwardsRecognitionPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const toast = useToast();
  const isAdmin = String(profile?.role || "").toLowerCase() === "admin";
  const missingAffiliation =
    !isAdmin &&
    (!String(profile?.ckan_org_id || "").trim() ||
      !String(profile?.department || "").trim());
  const [rows, setRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [exportingType, setExportingType] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const levelOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows.map((row) => String(row?.level || "").trim()).filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const loadAwards = useCallback(() => {
    setLoading(true);
    setLoadError("");

    return listAwardRecognitionRecords().then(({ data, error }) => {
      if (error) {
        setRows([]);
        setLoadError(error.message || "Unable to load award records.");
        toast.error(
          "Unable to load award records",
          error.message || "Please refresh the page.",
        );
      } else {
        setRows(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    });
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    loadAwards().then(() => {
      if (cancelled) return;
    });

    return () => {
      cancelled = true;
    };
  }, [loadAwards]);

  const yearOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => String(row?.year_received || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => b.localeCompare(a)),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const query = String(searchTerm || "")
      .trim()
      .toLowerCase();
    return rows.filter((row) => {
      const level = String(row?.level || "").trim();
      const year = String(row?.year_received || "").trim();
      const haystack = [
        row?.program_department,
        row?.work_title,
        row?.award_recognition,
        row?.awarding_body,
        row?.recipients,
        row?.supporting_movs,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      const matchesSearch = query ? haystack.includes(query) : true;
      const matchesLevel = levelFilter === "all" ? true : level === levelFilter;
      const matchesYear = yearFilter === "all" ? true : year === yearFilter;
      return matchesSearch && matchesLevel && matchesYear;
    });
  }, [levelFilter, rows, searchTerm, yearFilter]);

  const analytics = useMemo(() => {
    const uniqueRecipients = new Set();
    const base = {
      total: rows.length,
      national: 0,
      international: 0,
      recipients: 0,
    };

    rows.forEach((row) => {
      const level = String(row?.level || "")
        .trim()
        .toLowerCase();
      if (level.includes("international")) {
        base.international += 1;
      } else if (level) {
        base.national += 1;
      }

      String(row?.recipients || "")
        .split(/[,;]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((recipient) => uniqueRecipients.add(recipient));
    });

    base.recipients = uniqueRecipients.size;
    return base;
  }, [rows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, levelFilter, yearFilter]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRows.length / AWARDS_PAGE_SIZE)),
    [filteredRows.length],
  );

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * AWARDS_PAGE_SIZE;
    return filteredRows.slice(start, start + AWARDS_PAGE_SIZE);
  }, [currentPage, filteredRows]);

  const resetFilters = () => {
    setSearchTerm("");
    setLevelFilter("all");
    setYearFilter("all");
  };

  const openEdit = (row) => {
    const recordId = String(row?.id || row?.ckan_dataset_id || "").trim();
    if (!recordId) return;
    navigate(`/awards-recognitions/add?edit=${encodeURIComponent(recordId)}`);
  };

  const confirmDelete = async () => {
    const recordId = String(
      deleteTarget?.id || deleteTarget?.ckan_dataset_id || "",
    ).trim();
    if (!recordId) return;

    setDeleting(true);
    const { error } = await deleteAwardRecognitionRecord(recordId);
    if (error) {
      toast.error(
        "Unable to delete award record",
        error.message || "Please try again.",
      );
      setDeleting(false);
      return;
    }

    setRows((prev) =>
      prev.filter(
        (row) =>
          String(row?.id || row?.ckan_dataset_id || "").trim() !== recordId,
      ),
    );
    setDeleteTarget(null);
    setDeleting(false);
    toast.success(
      "Award record deleted",
      "The CKAN-backed award record was removed.",
    );
  };

  const triggerDownload = (filename, content, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const buildExportRows = () =>
    filteredRows.map((row, index) => ({
      no: index + 1,
      department: row.program_department || "-",
      title: row.work_title || "-",
      award: row.award_recognition || "-",
      body: row.awarding_body || "-",
      year: row.year_received || "-",
      level: row.level || "-",
      recipients: row.recipients || "-",
      movs: row.supporting_movs || "-",
    }));

  const exportAsCsv = () => {
    if (!filteredRows.length) return;
    setExportingType("csv");
    try {
      const headers = [
        "No.",
        "Department",
        "Title of Research",
        "Award/Recognition",
        "Awarding Body",
        "Year Received",
        "Level",
        "Recipient(s)",
        "Supporting MOVs",
      ];
      const lines = buildExportRows().map((row) =>
        [
          row.no,
          row.department,
          row.title,
          row.award,
          row.body,
          row.year,
          row.level,
          row.recipients,
          row.movs,
        ]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(","),
      );
      const csv = [headers.join(","), ...lines].join("\n");
      triggerDownload(
        `awards-recognition-${new Date().toISOString().slice(0, 10)}.csv`,
        csv,
        "text/csv;charset=utf-8;",
      );
    } finally {
      setExportingType("");
    }
  };

  const exportAsPdf = () => {
    if (!filteredRows.length) return;
    setExportingType("pdf");
    try {
      const timestamp = new Date().toLocaleString();
      const rowsForExport = buildExportRows();
      const rowsHtml = rowsForExport
        .map(
          (row) => `
            <tr>
              <td>${row.no}</td>
              <td>${row.department}</td>
              <td>${row.title}</td>
              <td>${row.award}</td>
              <td>${row.body}</td>
              <td>${row.year}</td>
              <td>${row.level}</td>
              <td>${row.recipients}</td>
              <td>${row.movs}</td>
            </tr>
          `,
        )
        .join("");

      const printWindow = window.open("", "_blank", "width=1200,height=800");
      if (!printWindow) {
        toast.error(
          "Export failed",
          "Unable to open print window for PDF export.",
        );
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>awards-recognition-records-filtered</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
              h1 { margin: 0 0 6px; font-size: 20px; }
              p { margin: 0 0 16px; color: #475569; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; }
              th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
              th { background: #f8fafc; }
            </style>
          </head>
          <body>
            <h1>Awards and Recognition Report</h1>
            <p>Generated: ${timestamp} | Scope: filtered | Rows: ${rowsForExport.length}</p>
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Department</th>
                  <th>Title of Research</th>
                  <th>Award/Recognition</th>
                  <th>Awarding Body</th>
                  <th>Year Received</th>
                  <th>Level</th>
                  <th>Recipient(s)</th>
                  <th>Supporting MOVs</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="9">No records found.</td></tr>'}
              </tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } finally {
      setExportingType("");
    }
  };

  if (missingAffiliation) {
    return (
      <section className="page-stack-lg">
        <PageHeader
          title="Awards and Recognition"
          description="Browse awards and recognition records using the same project-style workspace."
        />
        <div className="panel">
          <div className="panel-body space-y-3">
            <p className="text-sm text-amber-700">
              Please set your Organization (Research Center) and Department in
              My Profile first before accessing Awards and Recognition.
            </p>
            <Link className="btn btn-primary" to="/my-profile">
              Go to My Profile
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Awards and Recognition"
        description="Browse awards and recognition records using the same project-style workspace."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <Award size={14} />
            Total Awards
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.total}
          </p>
        </article>
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <Building2 size={14} />
            National / Local
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.national}
          </p>
        </article>
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <Award size={14} />
            International
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.international}
          </p>
        </article>
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <Users size={14} />
            Recognized Recipients
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.recipients}
          </p>
        </article>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
                Awards and Recognition Records ({filteredRows.length})
              </h2>
              <label className="relative min-w-[16rem] flex-1 md:max-w-[24rem]">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search title, award, body, recipient..."
                  className="control-input pl-8"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={exportAsCsv}
                    disabled={!filteredRows.length || Boolean(exportingType)}
                  >
                    {exportingType === "csv" ? "Exporting..." : "Export CSV"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={exportAsPdf}
                    disabled={!filteredRows.length || Boolean(exportingType)}
                  >
                    {exportingType === "pdf" ? "Exporting..." : "Export PDF"}
                  </button>
                </>
              ) : null}
              <Link to="/awards-recognitions/add" className="btn btn-primary">
                Add Awards/Recognitions
              </Link>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[12rem_10rem]">
            <select
              value={levelFilter}
              onChange={(event) => setLevelFilter(event.target.value)}
              className="control-select"
            >
              <option value="all">Filter by level</option>
              {levelOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <select
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
              className="control-select"
            >
              <option value="all">Filter by year</option>
              {yearOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="btn btn-outline"
              onClick={resetFilters}
            >
              Reset
            </button>
            <p className="text-sm text-slate-600">
              Showing{" "}
              <span className="font-semibold">{filteredRows.length}</span> award
              record(s).
            </p>
          </div>
        </div>
        {filteredRows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={
                loading
                  ? "Loading award records..."
                  : "No awards and recognition records found"
              }
              description={
                loadError ||
                (loading
                  ? "Fetching CKAN-backed award records for this workspace."
                  : "Try adjusting your filters once award records are available.")
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Department</th>
                  <th>Title of Research</th>
                  <th>Award/Recognition</th>
                  <th>Awarding Body</th>
                  <th>Year Received</th>
                  <th>Level</th>
                  <th>Recipient(s)</th>
                  <th>Supporting MOVs</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {paginatedRows.map((row, index) => (
                  <tr key={row.id || index}>
                    <td>{(currentPage - 1) * AWARDS_PAGE_SIZE + index + 1}</td>
                    <td>{row.program_department || "-"}</td>
                    <td>{row.work_title || "-"}</td>
                    <td>{row.award_recognition || "-"}</td>
                    <td>{row.awarding_body || "-"}</td>
                    <td>{row.year_received || "-"}</td>
                    <td>{row.level || "-"}</td>
                    <td>{row.recipients || "-"}</td>
                    <td>
                      <div className="space-y-1">
                        {row.supporting_movs ? (
                          <a
                            href={row.supporting_movs}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex text-sm font-medium text-sky-700 hover:text-sky-900"
                          >
                            Link / Reference
                          </a>
                        ) : null}
                        {row.supporting_mov_file_path ? (
                          <a
                            href={row.supporting_mov_file_path}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-900"
                          >
                            {row.supporting_mov_file_name ||
                              "Attached MOV file"}
                          </a>
                        ) : null}
                        {!row.supporting_movs && !row.supporting_mov_file_path
                          ? "-"
                          : null}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {isAdmin ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => openEdit(row)}
                            >
                              <PencilLine size={14} />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PaginationControls
        page={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Delete Award Record"
        message={`Delete "${deleteTarget?.award_recognition || deleteTarget?.work_title || "this award record"}"? This will remove the CKAN dataset for this record.`}
        confirmLabel="Delete Record"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => (deleting ? null : setDeleteTarget(null))}
      />
    </section>
  );
}
