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
import { cn } from "@/utils/cn";
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
  listCenterChiefAwardRecognitionRecords,
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
} from "lucide-react";
import { Colors } from "chart.js";

const AWARDS_PAGE_SIZE = 10;

export default function AwardsRecognitionPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const toast = useToast();
  const isAdmin = String(profile?.role || "").toLowerCase() === "admin";
  const isCenterChief =
    String(profile?.role || "")
      .trim()
      .toLowerCase() === "faculty" &&
    profile?.is_center_chief === true &&
    Boolean(profile?.managed_center_id);
  const hasOrgId = String(profile?.ckan_org_id || "").trim();
  const canLoadOwnAwards = isAdmin || Boolean(hasOrgId);
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4010/api";
  const missingAffiliation = !canLoadOwnAwards && !isCenterChief;
  const [rows, setRows] = useState([]);
  const [centerChiefRows, setCenterChiefRows] = useState([]);
  const [centerChiefSearch, setCenterChiefSearch] = useState("");
  const [centerChiefQuickFilter, setCenterChiefQuickFilter] = useState("all");
  const [recordsQuickFilter, setRecordsQuickFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [exportingType, setExportingType] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [centerChiefLoading, setCenterChiefLoading] = useState(false);
  const [centerChiefError, setCenterChiefError] = useState("");
  const [centerChiefPage, setCenterChiefPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [projectOptions, setProjectOptions] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const getLevelCategory = (level) => {
    const value = String(level || "")
      .trim()
      .toLowerCase();
    if (!value) return "";
    if (value.includes("international")) return "international";
    if (value.includes("national")) return "national";
    if (value.includes("regional")) return "regional";
    if (value.includes("local")) return "local";
    if (value.includes("institutional")) return "institutional";
    return "";
  };

  const loadAwards = useCallback(() => {
    if (!canLoadOwnAwards) {
      setRows([]);
      setLoading(false);
      setLoadError("");
      return Promise.resolve();
    }
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
  }, [canLoadOwnAwards, toast]);

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
    if (!isCenterChief) {
      setCenterChiefRows([]);
      setCenterChiefLoading(false);
      setCenterChiefError("");
      return () => {};
    }

    let cancelled = false;
    const loadCenterChiefAwards = async () => {
      setCenterChiefLoading(true);
      setCenterChiefError("");
      const { data, error } = await listCenterChiefAwardRecognitionRecords();
      if (cancelled) return;
      if (error) {
        setCenterChiefRows([]);
        setCenterChiefError(
          error.message || "Unable to load center chief award records.",
        );
      } else {
        setCenterChiefRows(Array.isArray(data) ? data : []);
      }
      setCenterChiefLoading(false);
    };

    loadCenterChiefAwards();
    return () => {
      cancelled = true;
    };
  }, [isCenterChief]);

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

  const baseSearchRows = useMemo(() => {
    const query = String(searchTerm || "")
      .trim()
      .toLowerCase();
    return rows.filter((row) => {
      const haystack = [
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
  const filteredRows = useMemo(() => {
    if (recordsQuickFilter === "all") return baseSearchRows;
    return baseSearchRows.filter(
      (row) => getLevelCategory(row?.level) === recordsQuickFilter,
    );
  }, [baseSearchRows, getLevelCategory, recordsQuickFilter]);

  const sortedCenterChiefRows = useMemo(
    () =>
      [...centerChiefRows].sort(
        (a, b) =>
          new Date(b?.updated_at || b?.created_at || 0).getTime() -
          new Date(a?.updated_at || a?.created_at || 0).getTime(),
      ),
    [centerChiefRows],
  );

  const baseCenterChiefRows = useMemo(() => {
    const query = String(centerChiefSearch || "")
      .trim()
      .toLowerCase();
    return sortedCenterChiefRows.filter((row) => {
      const haystack = [
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
  }, [centerChiefSearch, sortedCenterChiefRows]);
  const centerChiefFilteredRows = useMemo(() => {
    if (centerChiefQuickFilter === "all") return baseCenterChiefRows;
    return baseCenterChiefRows.filter(
      (row) => getLevelCategory(row?.level) === centerChiefQuickFilter,
    );
  }, [baseCenterChiefRows, centerChiefQuickFilter, getLevelCategory]);

  const analytics = useMemo(() => {
    const base = {
      total: rows.length,
      institutional: 0,
      local: 0,
      regional: 0,
      national: 0,
      international: 0,
    };

    rows.forEach((row) => {
      const category = getLevelCategory(row?.level);
      if (!category) return;
      base[category] += 1;
    });

    return base;
  }, [getLevelCategory, rows]);

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
  }, [recordsQuickFilter, searchTerm]);

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

  const centerChiefTotalPages = useMemo(
    () =>
      Math.max(1, Math.ceil(centerChiefFilteredRows.length / AWARDS_PAGE_SIZE)),
    [centerChiefFilteredRows.length],
  );

  useEffect(() => {
    setCenterChiefPage(1);
  }, [sortedCenterChiefRows.length, centerChiefSearch, centerChiefQuickFilter]);

  useEffect(() => {
    setCenterChiefPage((prev) => Math.min(prev, centerChiefTotalPages));
  }, [centerChiefTotalPages]);

  const centerChiefPaginatedRows = useMemo(() => {
    const start = (centerChiefPage - 1) * AWARDS_PAGE_SIZE;
    return centerChiefFilteredRows.slice(start, start + AWARDS_PAGE_SIZE);
  }, [centerChiefPage, centerChiefFilteredRows]);

  const openEdit = (row) => {
    const recordId = String(row?.id || row?.ckan_dataset_id || "").trim();
    if (!recordId) return;
    navigate(`/awards/new?edit=${encodeURIComponent(recordId)}`);
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
              :root {
                --bg: #e9eff7;
                --surface: #ffffff;
                --surface-muted: #f4f7fb;
                --border: #d2deec;
                --text: #142338;
                --text-muted: #546883;
              }
              body { font-family: Arial, sans-serif; padding: 24px; color: var(--text); background: var(--bg); }
              h1 { margin: 0 0 6px; font-size: 20px; }
              p { margin: 0 0 16px; color: var(--text-muted); font-size: 12px; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; background: var(--surface); }
              th, td { border: 1px solid var(--border); padding: 8px; text-align: left; vertical-align: top; }
              th { background: var(--surface-muted); }
            </style>
          </head>
          <body>
            <h1>Awards and Recognition Report</h1>
            <p>Generated: ${timestamp} | Scope: filtered | Rows: ${rowsForExport.length}</p>
            <table>
              <thead>
                <tr>
                  <th>No.</th>
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
      <section className="page-stack-lg text-[var(--text)]">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
              Awards and Recognition
            </p>
            <h1 className="text-2xl font-bold text-[var(--text)] md:text-3xl">
              Complete Your Profile First
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              Add your organization (research center) before reviewing awards
              and recognition records.
            </p>
          </div>
        </div>
        <Card className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-[var(--warning)]">
              Please set your Organization (Research Center) in My Profile first
              before accessing Awards and Recognition.
            </p>
            <Button
              asChild
              className="bg-[var(--brand)] text-[var(--surface)] hover:bg-[var(--brand-strong)]"
            >
              <Link to="/profile">Go to My Profile</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="page-stack-lg text-[var(--text)]">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[var(--text)] md:text-3xl">
              Awards and Recognitions Workspace
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]"
                    disabled={!filteredRows.length || Boolean(exportingType)}
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                >
                  <DropdownMenuItem
                    onSelect={exportAsCsv}
                    className="focus:bg-[var(--surface-muted)] focus:text-[var(--text)]"
                  >
                    {exportingType === "csv" ? "Exporting..." : "Export CSV"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={exportAsPdf}
                    className="focus:bg-[var(--surface-muted)] focus:text-[var(--text)]"
                  >
                    {exportingType === "pdf" ? "Exporting..." : "Export PDF"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <Button
              asChild
              className="bg-[var(--brand)] text-[var(--surface)] hover:bg-[var(--brand-strong)]"
            >
              <Link to="/awards/new">Add Awards/Recognitions</Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-8">
          {[
            { label: "Total Awards", value: analytics.total, icon: Award },
            {
              label: "Institutional",
              value: analytics.institutional,
              icon: Building2,
            },
            {
              label: "Local",
              value: analytics.local,
              icon: Building2,
            },
            {
              label: "Regional",
              value: analytics.regional,
              icon: Building2,
            },
            {
              label: "National",
              value: analytics.national,
              icon: Building2,
            },
            {
              label: "International",
              value: analytics.international,
              icon: Award,
            },
          ].map(({ label, value, icon: Icon }) => (
            <Card
              key={label}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)]"
            >
              <CardContent className="p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  <Icon size={14} />
                  {label}
                </p>
                <p className="mt-2 text-2xl font-bold text-[var(--text)]">
                  {value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {isCenterChief ? (
        <Card className="overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
          <CardHeader className="border-b border-[var(--border)] px-6 py-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold text-[var(--text)]">
                  Managed Center Awards and Recognition
                </CardTitle>
                <CardDescription className="text-[var(--text-muted)]">
                  Showing {centerChiefFilteredRows.length} record(s) from your
                  managed research center.
                </CardDescription>
              </div>
              <label className="relative w-full md:max-w-xl">
                <span className="sr-only">Search managed center awards</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  value={centerChiefSearch}
                  onChange={(event) => setCenterChiefSearch(event.target.value)}
                  placeholder="Search title, award, body, recipient, level, or year"
                  className="pl-9 border-[var(--border)] bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus-visible:ring-[var(--brand)]"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {[
                {
                  key: "all",
                  label: "All Awards",
                  count: baseCenterChiefRows.length,
                },
                {
                  key: "institutional",
                  label: "Institutional",
                  count: baseCenterChiefRows.filter(
                    (row) => getLevelCategory(row?.level) === "institutional",
                  ).length,
                },
                {
                  key: "local",
                  label: "Local",
                  count: baseCenterChiefRows.filter(
                    (row) => getLevelCategory(row?.level) === "local",
                  ).length,
                },
                {
                  key: "regional",
                  label: "Regional",
                  count: baseCenterChiefRows.filter(
                    (row) => getLevelCategory(row?.level) === "regional",
                  ).length,
                },
                {
                  key: "national",
                  label: "National",
                  count: baseCenterChiefRows.filter(
                    (row) => getLevelCategory(row?.level) === "national",
                  ).length,
                },
                {
                  key: "international",
                  label: "International",
                  count: baseCenterChiefRows.filter(
                    (row) => getLevelCategory(row?.level) === "international",
                  ).length,
                },
              ].map((chip) => (
                <Button
                  key={chip.key}
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    "rounded-full border-[var(--border)] px-4 text-xs",
                    centerChiefQuickFilter === chip.key
                      ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--surface)] hover:bg-[var(--brand-strong)]"
                      : "bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
                  )}
                  onClick={() => setCenterChiefQuickFilter(chip.key)}
                >
                  {chip.label}
                  <span
                    className={cn(
                      "ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      centerChiefQuickFilter === chip.key
                        ? "bg-[var(--surface)] text-[var(--brand-strong)]"
                        : "bg-[var(--surface-strong)] text-[var(--text-muted)]",
                    )}
                  >
                    {chip.count}
                  </span>
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="rounded-full text-xs text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                onClick={() => setCenterChiefQuickFilter("all")}
              >
                Clear filters
              </Button>
            </div>
          </CardHeader>
          {centerChiefLoading ? (
            <CardContent className="p-4 text-sm text-[var(--text-muted)]">
              Loading managed center awards...
            </CardContent>
          ) : centerChiefError ? (
            <CardContent className="p-4 text-sm text-[var(--danger)]">
              {centerChiefError}
            </CardContent>
          ) : sortedCenterChiefRows.length === 0 ? (
            <CardContent className="p-4 text-sm text-[var(--text-muted)]">
              No awards and recognition records found for your managed research
              center.
            </CardContent>
          ) : centerChiefFilteredRows.length === 0 ? (
            <CardContent className="p-4 text-sm text-[var(--text-muted)]">
              No managed center awards match your search.
            </CardContent>
          ) : (
            <CardContent className="p-4">
              <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <Table className="min-w-[980px]">
                  <TableHeader className="bg-[var(--surface-muted)] text-[var(--text-muted)]">
                    <TableRow>
                      <TableHead>No.</TableHead>
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
                    {centerChiefPaginatedRows.map((row, index) => (
                      <TableRow key={row.id || index}>
                        <TableCell>
                          {(centerChiefPage - 1) * AWARDS_PAGE_SIZE + index + 1}
                        </TableCell>
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
                                className="inline-flex text-sm font-medium text-[var(--accent)] hover:text-[var(--brand-strong)]"
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
                                className="inline-flex text-sm font-medium text-[var(--success)] hover:text-[var(--brand-strong)]"
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
                            {row?.project_id ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                                asChild
                              >
                                <Link
                                  to={`/projects/${encodeURIComponent(
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
                              className="h-8 w-8 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                              onClick={() => openEdit(row)}
                              aria-label={`Edit ${row?.award_recognition || row?.work_title || "award record"}`}
                              title="Edit"
                            >
                              <PencilLine className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-[var(--danger)] hover:bg-[var(--surface-strong)]"
                              onClick={() => setDeleteTarget(row)}
                              aria-label={`Delete ${row?.award_recognition || row?.work_title || "award record"}`}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {centerChiefTotalPages > 1 ? (
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={10} className="px-3 py-3">
                          <PaginationControls
                            page={centerChiefPage}
                            totalPages={centerChiefTotalPages}
                            onPageChange={setCenterChiefPage}
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
      ) : null}

      <Card className="overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
        <CardHeader className="border-b border-[var(--border)] px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-[var(--text)]">
                Awards and Recognition Records
              </CardTitle>
              <CardDescription className="text-[var(--text-muted)]">
                Showing {filteredRows.length} record(s).
              </CardDescription>
            </div>

            <label className="relative w-full md:max-w-xl">
              <span className="sr-only">Search awards and recognitions</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search title, award, body, recipient, level, or year"
                className="pl-9 border-[var(--border)] bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus-visible:ring-[var(--brand)]"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {[
              {
                key: "all",
                label: "All Awards",
                count: baseSearchRows.length,
              },
              {
                key: "institutional",
                label: "Institutional",
                count: baseSearchRows.filter(
                  (row) => getLevelCategory(row?.level) === "institutional",
                ).length,
              },
              {
                key: "local",
                label: "Local",
                count: baseSearchRows.filter(
                  (row) => getLevelCategory(row?.level) === "local",
                ).length,
              },
              {
                key: "regional",
                label: "Regional",
                count: baseSearchRows.filter(
                  (row) => getLevelCategory(row?.level) === "regional",
                ).length,
              },
              {
                key: "national",
                label: "National",
                count: baseSearchRows.filter(
                  (row) => getLevelCategory(row?.level) === "national",
                ).length,
              },
              {
                key: "international",
                label: "International",
                count: baseSearchRows.filter(
                  (row) => getLevelCategory(row?.level) === "international",
                ).length,
              },
            ].map((chip) => (
              <Button
                key={chip.key}
                type="button"
                size="sm"
                variant="outline"
                className={cn(
                  "rounded-full border-[var(--border)] px-4 text-xs",
                  recordsQuickFilter === chip.key
                    ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--surface)] hover:bg-[var(--brand-strong)]"
                    : "bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
                )}
                onClick={() => setRecordsQuickFilter(chip.key)}
              >
                {chip.label}
                <span
                  className={cn(
                    "ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    recordsQuickFilter === chip.key
                      ? "bg-[var(--surface)] text-[var(--brand-strong)]"
                      : "bg-[var(--surface-strong)] text-[var(--text-muted)]",
                  )}
                >
                  {chip.count}
                </span>
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-full text-xs text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
              onClick={() => setRecordsQuickFilter("all")}
            >
              Clear filters
            </Button>
          </div>
        </CardHeader>
        {filteredRows.length === 0 ? (
          <CardContent className="p-4">
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-sm text-[var(--text-muted)]">
              {canLoadOwnAwards && loading
                ? "Loading award records..."
                : loadError ||
                  "No awards and recognition records found. Try a different search term once award records are available."}
            </div>
          </CardContent>
        ) : (
          <CardContent className="p-4">
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <Table className="min-w-[980px]">
                <TableHeader className="bg-[var(--surface-muted)] text-[var(--text-muted)]">
                  <TableRow>
                    <TableHead>No.</TableHead>
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
                              className="inline-flex text-sm font-medium text-[var(--accent)] hover:text-[var(--brand-strong)]"
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
                              className="inline-flex text-sm font-medium text-[var(--success)] hover:text-[var(--brand-strong)]"
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
                                    className="h-8 w-8 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                                    asChild
                                  >
                                    <Link
                                      to={`/projects/${encodeURIComponent(
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
                                  className="h-8 w-8 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                                  onClick={() => openEdit(row)}
                                  aria-label={`Edit ${row?.award_recognition || row?.work_title || "award record"}`}
                                  title="Edit"
                                >
                                  <PencilLine className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-[var(--danger)] hover:bg-[var(--surface-strong)]"
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
                      <TableCell colSpan={10} className="px-3 py-3">
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
