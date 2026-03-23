import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";
import PaginationControls from "@/components/navigation/PaginationControls";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteAwardRecognitionRecord,
  listAwardRecognitionRecords,
  fetchAllProjects,
  fetchUserProjects,
} from "@/services/submissions";
import {
  Award,
  Building2,
  Download,
  ExternalLink,
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
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4010/api";
  const missingAffiliation =
    !isAdmin &&
    (!String(profile?.ckan_org_id || "").trim() ||
      !String(profile?.department || "").trim());
  const [rows, setRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [exportingType, setExportingType] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [projectOptions, setProjectOptions] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    const loadProjects = async () => {
      setLoadingProjects(true);
      const response = isAdmin
        ? await fetchAllProjects()
        : await fetchUserProjects({ userId: profile?.id });
      if (cancelled) return;
      if (response?.error) {
        setProjectOptions([]);
        setLoadingProjects(false);
        return;
      }
      setProjectOptions(Array.isArray(response?.data) ? response.data : []);
      setLoadingProjects(false);
    };

    loadProjects();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, profile?.id]);

  const filteredRows = useMemo(() => {
    const query = String(searchTerm || "")
      .trim()
      .toLowerCase();
    return rows.filter((row) => {
      const haystack = [
        row?.program_department,
        row?.work_title,
        row?.award_recognition,
        row?.awarding_body,
        row?.level,
        row?.year_received,
        row?.recipients,
        row?.supporting_movs,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return query ? haystack.includes(query) : true;
    });
  }, [rows, searchTerm]);

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

  const projectTitleById = useMemo(() => {
    const map = new Map();
    (projectOptions || []).forEach((item) => {
      const id = String(item?.id || item?.ckan_dataset_id || "").trim();
      const title = String(
        item?.title || item?.work_title || item?.name || "",
      ).trim();
      if (!id || !title || map.has(id)) return;
      map.set(id, title);
    });
    return map;
  }, [projectOptions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
    toast.success("Award record deleted", "The award record was removed.");
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
      project:
        projectTitleById.get(String(row?.project_id || "").trim()) ||
        row.work_title ||
        "-",
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
        "Project",
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
          row.project,
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
              <td>${row.project}</td>
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
                  <th>Project</th>
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
        <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6 shadow-sm">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Awards and Recognition
            </p>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
              Complete Your Profile First
            </h1>
            <p className="text-sm text-slate-600">
              Add your organization and department before reviewing awards and
              recognition records.
            </p>
          </div>
        </div>
        <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-amber-700">
              Please set your Organization (Research Center) and Department in
              My Profile first before accessing Awards and Recognition.
            </p>
            <Button asChild>
              <Link to="/my-profile">Go to My Profile</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="page-stack-lg">
      <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              ARMS Awards and Recognition
            </p>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
              Awards and Recognitions Workspace
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={!filteredRows.length || Boolean(exportingType)}
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={exportAsCsv}>
                    {exportingType === "csv" ? "Exporting..." : "Export CSV"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={exportAsPdf}>
                    {exportingType === "pdf" ? "Exporting..." : "Export PDF"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <Button asChild>
              <Link to="/awards-recognitions/add">Add Awards/Recognitions</Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Awards", value: analytics.total, icon: Award },
            {
              label: "National / Local",
              value: analytics.national,
              icon: Building2,
            },
            {
              label: "International",
              value: analytics.international,
              icon: Award,
            },
            {
              label: "Recognized Recipients",
              value: analytics.recipients,
              icon: Users,
            },
          ].map(({ label, value, icon: Icon }) => (
            <Card
              key={label}
              className="rounded-xl border border-slate-200/70 bg-white/80 shadow-sm"
            >
              <CardContent className="p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <Icon size={14} />
                  {label}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-slate-900">
                Awards and Recognition Records
              </CardTitle>
              <CardDescription>
                Showing {filteredRows.length} record(s).
              </CardDescription>
            </div>

            <label className="relative w-full md:max-w-xl">
              <span className="sr-only">Search awards and recognitions</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search title, award, body, recipient, level, or year"
                className="pl-9"
              />
            </label>
          </div>
        </CardHeader>
        {filteredRows.length === 0 ? (
          <CardContent className="p-4">
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-sm text-slate-600">
              {loading
                ? "Loading award records..."
                : loadError ||
                  "No awards and recognition records found. Try a different search term once award records are available."}
            </div>
          </CardContent>
        ) : (
          <CardContent className="p-4">
            <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm">
              <Table className="min-w-[980px]">
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Title of Research/Creative Work</TableHead>
                    <TableHead>Award/Recognition</TableHead>
                    <TableHead>Awarding Body</TableHead>
                    <TableHead>Year Received</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Recipient(s)</TableHead>
                    <TableHead>Supporting MOVs</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((row, index) => (
                    <TableRow key={row.id || index}>
                      <TableCell>
                        {(currentPage - 1) * AWARDS_PAGE_SIZE + index + 1}
                      </TableCell>
                      <TableCell>{row.program_department || "-"}</TableCell>
                      <TableCell>{row.work_title || "-"}</TableCell>
                      <TableCell>{row.award_recognition || "-"}</TableCell>
                      <TableCell>{row.awarding_body || "-"}</TableCell>
                      <TableCell>{row.year_received || "-"}</TableCell>
                      <TableCell>{row.level || "-"}</TableCell>
                      <TableCell>{row.recipients || "-"}</TableCell>
                      <TableCell>
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
                          {row.supporting_mov_resource_id ? (
                            <a
                              href={`${apiBaseUrl}/submissions/resources/${encodeURIComponent(
                                row.supporting_mov_resource_id,
                              )}/download?download=1`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-900"
                            >
                              {row.supporting_mov_file_name ||
                                "Download MOV file"}
                            </a>
                          ) : null}
                          {!row.supporting_movs &&
                          !row.supporting_mov_resource_id
                            ? "-"
                            : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {(() => {
                            const ownerKey = String(
                              row?.submitted_by_user_id || "",
                            ).trim();
                            const currentUserKey = String(
                              profile?.id || "",
                            ).trim();
                            const canManage =
                              isAdmin ||
                              (ownerKey &&
                                currentUserKey &&
                                ownerKey === currentUserKey);
                            return canManage ? (
                              <>
                                {row?.project_id ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    asChild
                                  >
                                    <Link
                                      to={`/submit-project/${encodeURIComponent(
                                        String(row.project_id || "").trim(),
                                      )}`}
                                      aria-label="Open linked project"
                                      title="Open project"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEdit(row)}
                                  aria-label={`Edit ${row?.award_recognition || row?.work_title || "award record"}`}
                                  title="Edit"
                                >
                                  <PencilLine className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-[var(--danger)] hover:bg-red-50"
                                  onClick={() => setDeleteTarget(row)}
                                  aria-label={`Delete ${row?.award_recognition || row?.work_title || "award record"}`}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            ) : null;
                          })()}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {totalPages > 1 ? (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={11} className="px-3 py-3">
                        <PaginationControls
                          page={currentPage}
                          totalPages={totalPages}
                          onPageChange={setCurrentPage}
                          className="border-0 rounded-none shadow-none bg-transparent"
                        />
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                ) : null}
              </Table>
            </div>
          </CardContent>
        )}
      </Card>

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Delete Award Record"
        message={`Delete "${deleteTarget?.award_recognition || deleteTarget?.work_title || "this award record"}"? This will remove the dataset for this record.`}
        confirmLabel="Delete Record"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => (deleting ? null : setDeleteTarget(null))}
      />
    </section>
  );
}
