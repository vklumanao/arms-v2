import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  fetchCenterChiefProjects,
  fetchUserProjects,
} from "@/services/submissions";
import { hasPermission, PERMISSIONS } from "@/services/permissions";
import {
  Award,
  Building2,
  Download,
  ExternalLink,
  PencilLine,
  Search,
  Trash2,
} from "lucide-react";

const AWARDS_PAGE_SIZE = 10;

export default function AwardsRecognitionPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const toast = useToast();
  const roleKeys = Array.isArray(profile?.roles)
    ? profile.roles.map((entry) => entry?.key)
    : profile?.role;
  const isAdmin = hasPermission(
    roleKeys,
    PERMISSIONS.ADMIN_CONTROLS_MANAGE,
    profile?.permissions,
  );
  const canCreateAwards = hasPermission(
    roleKeys,
    PERMISSIONS.AWARDS_CREATE,
    profile?.permissions,
  );
  const canEditAwards = hasPermission(
    roleKeys,
    PERMISSIONS.AWARDS_EDIT,
    profile?.permissions,
  );
  const canDeleteAwards = hasPermission(
    roleKeys,
    PERMISSIONS.AWARDS_DELETE,
    profile?.permissions,
  );
  const canExportAwards = hasPermission(
    roleKeys,
    PERMISSIONS.AWARDS_VIEW,
    profile?.permissions,
  );
  const isCenterChief =
    profile?.is_center_chief === true && Boolean(profile?.managed_center_id);
  const hasOrgId = String(profile?.ckan_org_id || "").trim();
  const canLoadOwnAwards = isAdmin || Boolean(hasOrgId);
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
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
  const [activeTab, setActiveTab] = useState(() => {
    const initialTab = searchParams.get("tab");
    return initialTab === "managed" ? initialTab : "records";
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [projectOptions, setProjectOptions] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const getLevelCategory = useCallback((level) => {
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
  }, []);

  const hasActiveRecordsFilters = useMemo(() => {
    const searchActive = String(searchTerm || "").trim().length > 0;
    const quickActive = recordsQuickFilter !== "all";
    return searchActive || quickActive;
  }, [recordsQuickFilter, searchTerm]);

  const resetRecordsFilters = useCallback(() => {
    setRecordsQuickFilter("all");
    setSearchTerm("");
    setCurrentPage(1);
  }, []);

  const hasActiveCenterChiefFilters = useMemo(() => {
    const searchActive = String(centerChiefSearch || "").trim().length > 0;
    const quickActive = centerChiefQuickFilter !== "all";
    return searchActive || quickActive;
  }, [centerChiefQuickFilter, centerChiefSearch]);

  const resetCenterChiefFilters = useCallback(() => {
    setCenterChiefQuickFilter("all");
    setCenterChiefSearch("");
    setCenterChiefPage(1);
  }, []);

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
    const tab = searchParams.get("tab");
    const nextTab = tab === "managed" ? "managed" : "records";
    setActiveTab(nextTab);
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (activeTab === "records") nextParams.delete("tab");
    else nextParams.set("tab", activeTab);
    if (nextParams.toString() === searchParams.toString()) return;
    setSearchParams(nextParams, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    const loadProjects = async () => {
      setLoadingProjects(true);
      const response = isAdmin
        ? await fetchAllProjects()
        : isCenterChief
          ? await fetchCenterChiefProjects()
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
  }, [isAdmin, isCenterChief, profile?.id]);

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
  const recordsQuickFilterOptions = useMemo(
    () => [
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
    ],
    [baseSearchRows, getLevelCategory],
  );
  const selectedRecordsQuickFilter = useMemo(
    () =>
      recordsQuickFilterOptions.find(
        (option) => option.key === recordsQuickFilter,
      ) || recordsQuickFilterOptions[0],
    [recordsQuickFilter, recordsQuickFilterOptions],
  );

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
  const centerChiefQuickFilterOptions = useMemo(
    () => [
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
    ],
    [baseCenterChiefRows, getLevelCategory],
  );
  const selectedCenterChiefQuickFilter = useMemo(
    () =>
      centerChiefQuickFilterOptions.find(
        (option) => option.key === centerChiefQuickFilter,
      ) || centerChiefQuickFilterOptions[0],
    [centerChiefQuickFilter, centerChiefQuickFilterOptions],
  );

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
      <section className="page-stack-lg">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="relative space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Awards and Recognition
            </p>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
              Complete Your Profile First
            </h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Add your organization (research center) before reviewing awards
              and recognition records.
            </p>
          </div>
        </div>

        <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-slate-900">
              Please set your Organization (Research Center) in My Profile first
              before accessing Awards and Recognition.
            </p>
            <Button
              asChild
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              <Link to="/profile">Go to My Profile</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="page-stack-lg">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="relative">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Submissions Workspace
              </p>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
                Awards and Recognition
              </h1>
              <p className="max-w-2xl text-sm text-slate-600">
                Track awards, recognitions, and related references linked to
                your research projects.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canExportAwards ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                      disabled={!filteredRows.length || Boolean(exportingType)}
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-white border border-slate-300 shadow-md"
                  >
                    <DropdownMenuItem
                      onSelect={exportAsCsv}
                      className="text-slate-700 hover:bg-slate-50 focus:bg-slate-50"
                    >
                      {exportingType === "csv" ? "Exporting..." : "Export CSV"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={exportAsPdf}
                      className="text-slate-700 hover:bg-slate-50 focus:bg-slate-50"
                    >
                      {exportingType === "pdf" ? "Exporting..." : "Export PDF"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}

              {canCreateAwards ? (
                <Button asChild variant="mono">
                  <Link to="/awards/new">Add Awards/Recognitions</Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9">
            {[
              { label: "Total Awards", value: analytics.total, icon: Award },
              {
                label: "Institutional",
                value: analytics.institutional,
                icon: Building2,
              },
              { label: "Local", value: analytics.local, icon: Building2 },
              { label: "Regional", value: analytics.regional, icon: Building2 },
              { label: "National", value: analytics.national, icon: Building2 },
              {
                label: "International",
                value: analytics.international,
                icon: Award,
              },
            ].map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                    {label}
                  </p>
                  <Icon className="h-4 w-4 text-slate-700" />
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-700">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 border border-slate-200 bg-white p-1 sm:w-fit sm:grid-cols-none sm:grid-flow-col sm:gap-1">
          <TabsTrigger
            value="records"
            className="
    min-h-10 rounded-md border-slate-200
    text-slate-600
    data-[state=active]:border-emerald-600
    data-[state=active]:bg-emerald-600
    data-[state=active]:text-white
    data-[state=active]:font-semibold
    data-[state=active]:shadow-sm
  "
          >
            Awards Records
          </TabsTrigger>
          {isCenterChief ? (
            <TabsTrigger
              value="managed"
              className="
    min-h-10 rounded-md border-slate-200
    text-slate-600
    data-[state=active]:border-emerald-600
    data-[state=active]:bg-emerald-600
    data-[state=active]:text-white
    data-[state=active]:font-semibold
    data-[state=active]:shadow-sm
  "
            >
              Managed Center Awards
            </TabsTrigger>
          ) : null}
        </TabsList>

        {isCenterChief ? (
          <Card
            className={cn(
              "overflow-hidden border border-slate-200 bg-white shadow-sm",
              activeTab === "managed" ? "block" : "hidden",
            )}
          >
            <CardHeader className="border-b border-slate-200 px-6 py-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold text-slate-700">
                    Managed Center Awards and Recognition
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Showing {centerChiefFilteredRows.length} record(s) from your
                    managed research center.
                  </CardDescription>
                </div>
                <p className="text-sm text-slate-600">
                  {centerChiefFilteredRows.length} row(s).
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
                <label className="relative block w-full md:max-w-xl">
                  <span className="sr-only">Search managed center awards</span>
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
                  <Input
                    value={centerChiefSearch}
                    onChange={(event) =>
                      setCenterChiefSearch(event.target.value)
                    }
                    placeholder="Search title, award, body, recipient, level, or year"
                    className="pl-9"
                  />
                </label>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Select
                    value={centerChiefQuickFilter}
                    onValueChange={setCenterChiefQuickFilter}
                  >
                    <SelectTrigger className="w-full bg-white text-xs text-slate-700 sm:w-[16rem]">
                      <SelectValue>
                        {selectedCenterChiefQuickFilter
                          ? `${selectedCenterChiefQuickFilter.label} (${selectedCenterChiefQuickFilter.count})`
                          : "Filter awards"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="border border-slate-200 bg-white shadow-md">
                      {centerChiefQuickFilterOptions.map((option) => (
                        <SelectItem key={option.key} value={option.key}>
                          {option.label} ({option.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-xs text-slate-700 hover:text-slate-700"
                    onClick={resetCenterChiefFilters}
                  >
                    Reset all
                  </Button>
                </div>

                {hasActiveCenterChiefFilters ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                      Active Filters
                    </span>
                    {String(centerChiefSearch || "").trim() ? (
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                        onClick={() => setCenterChiefSearch("")}
                      >
                        Search: "{String(centerChiefSearch || "").trim()}" x
                      </button>
                    ) : null}
                    {centerChiefQuickFilter !== "all" ? (
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                        onClick={() => setCenterChiefQuickFilter("all")}
                      >
                        {selectedCenterChiefQuickFilter?.label ||
                          centerChiefQuickFilter}{" "}
                        x
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </CardContent>
            {centerChiefLoading ? (
              <CardContent className="p-4">
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                  Loading managed center awards...
                </div>
              </CardContent>
            ) : centerChiefError ? (
              <CardContent className="p-4">
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-800">
                  {centerChiefError}
                </div>
              </CardContent>
            ) : sortedCenterChiefRows.length === 0 ? (
              <CardContent className="p-4">
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                  No awards and recognition records found for your managed
                  research center.
                </div>
              </CardContent>
            ) : centerChiefFilteredRows.length === 0 ? (
              <CardContent className="p-4">
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                  No managed center awards match your search.
                </div>
              </CardContent>
            ) : (
              <CardContent className="p-4">
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <Table className="min-w-[650px]">
                    <TableHeader className="bg-slate-50 text-slate-600">
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
                            {(centerChiefPage - 1) * AWARDS_PAGE_SIZE +
                              index +
                              1}
                          </TableCell>
                          <TableCell>{row.work_title || "-"}</TableCell>
                          <TableCell>{row.award_recognition || "-"}</TableCell>
                          <TableCell>{row.awarding_body || "-"}</TableCell>
                          <TableCell>{row.year_received || "-"}</TableCell>
                          <TableCell>{row.level || "-"}</TableCell>
                          <TableCell>{row.recipients || "-"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              {row.supporting_movs ? (
                                <a
                                  href={row.supporting_movs}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  View Reference
                                </a>
                              ) : null}
                              {row.supporting_mov_resource_id ? (
                                <a
                                  href={`${apiBaseUrl}/submissions/resources/${encodeURIComponent(
                                    row.supporting_mov_resource_id,
                                  )}/download?download=1`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={
                                    row.supporting_mov_file_name ||
                                    "Download MOV file"
                                  }
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Download MOV
                                </a>
                              ) : null}
                              {!row.supporting_movs &&
                              !row.supporting_mov_resource_id ? (
                                <span className="text-xs text-slate-600">
                                  No attachment
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center justify-end gap-1">
                              {row?.project_id ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
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
                              {canEditAwards ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                                  onClick={() => openEdit(row)}
                                  aria-label={`Edit ${row?.award_recognition || row?.work_title || "award record"}`}
                                  title="Edit"
                                >
                                  <PencilLine className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {canDeleteAwards ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-700 hover:bg-slate-50"
                                  onClick={() => setDeleteTarget(row)}
                                  aria-label={`Delete ${row?.award_recognition || row?.work_title || "award record"}`}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : null}
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

        <Card
          className={cn(
            "overflow-hidden border border-slate-200 bg-white shadow-sm",
            activeTab === "records" ? "block" : "hidden",
          )}
        >
          <CardHeader className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold text-slate-700">
                  Awards and Recognition Records
                </CardTitle>
                <CardDescription className="text-slate-600">
                  Showing {filteredRows.length} record(s).
                </CardDescription>
              </div>
              <p className="text-sm text-slate-600">
                {filteredRows.length} row(s).
              </p>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
              <label className="relative block w-full md:max-w-xl">
                <span className="sr-only">Search awards and recognitions</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search title, award, body, recipient, level, or year"
                  className="pl-9"
                />
              </label>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Select
                  value={recordsQuickFilter}
                  onValueChange={setRecordsQuickFilter}
                >
                  <SelectTrigger className="w-full bg-white text-xs text-slate-700 sm:w-[16rem]">
                    <SelectValue>
                      {selectedRecordsQuickFilter
                        ? `${selectedRecordsQuickFilter.label} (${selectedRecordsQuickFilter.count})`
                        : "Filter awards"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="border border-slate-200 bg-white shadow-md">
                    {recordsQuickFilterOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label} ({option.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-xs text-slate-700 hover:text-slate-700"
                  onClick={resetRecordsFilters}
                >
                  Reset all
                </Button>
              </div>

              {hasActiveRecordsFilters ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                    Active Filters
                  </span>
                  {String(searchTerm || "").trim() ? (
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                      onClick={() => setSearchTerm("")}
                    >
                      Search: "{String(searchTerm || "").trim()}" x
                    </button>
                  ) : null}
                  {recordsQuickFilter !== "all" ? (
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                      onClick={() => setRecordsQuickFilter("all")}
                    >
                      {selectedRecordsQuickFilter?.label || recordsQuickFilter}{" "}
                      x
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </CardContent>
          {filteredRows.length === 0 ? (
            <CardContent className="p-4">
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                {canLoadOwnAwards && loading
                  ? "Loading award records..."
                  : loadError ||
                    "No awards and recognition records found. Try a different search term once award records are available."}
              </div>
            </CardContent>
          ) : (
            <CardContent className="p-4">
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <Table className="min-w-[650px]">
                  <TableHeader className="bg-slate-50 text-slate-600">
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
                          <div className="flex flex-wrap items-center gap-2">
                            {row.supporting_movs ? (
                              <a
                                href={row.supporting_movs}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open Link
                              </a>
                            ) : null}
                            {row.supporting_mov_resource_id ? (
                              <a
                                href={`${apiBaseUrl}/submissions/resources/${encodeURIComponent(
                                  row.supporting_mov_resource_id,
                                )}/download?download=1`}
                                target="_blank"
                                rel="noreferrer"
                                title={
                                  row.supporting_mov_file_name ||
                                  "Download MOV file"
                                }
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Download MOV
                              </a>
                            ) : null}
                            {!row.supporting_movs &&
                            !row.supporting_mov_resource_id ? (
                              <span className="text-xs text-slate-600">
                                No attachment
                              </span>
                            ) : null}
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
                              const isOwner =
                                ownerKey &&
                                currentUserKey &&
                                ownerKey === currentUserKey;
                              const canEdit =
                                canEditAwards && (isAdmin || isOwner);
                              const canDelete =
                                canDeleteAwards && (isAdmin || isOwner);
                              return canEdit || canDelete ? (
                                <>
                                  {row?.project_id ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
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
                                  {canEdit ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                                      onClick={() => openEdit(row)}
                                      aria-label={`Edit ${row?.award_recognition || row?.work_title || "award record"}`}
                                      title="Edit"
                                    >
                                      <PencilLine className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                  {canDelete ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-700 hover:bg-slate-50"
                                      onClick={() => setDeleteTarget(row)}
                                      aria-label={`Delete ${row?.award_recognition || row?.work_title || "award record"}`}
                                      title="Delete"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  ) : null}
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
      </Tabs>

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
