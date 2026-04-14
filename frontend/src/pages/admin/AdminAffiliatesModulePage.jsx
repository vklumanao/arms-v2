import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  Eye,
  LayoutGrid,
  List,
  Pencil,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";
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
import PaginationControls from "@/components/navigation/PaginationControls";
import { useToast } from "@/components/providers/ToastProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useReferenceData } from "@/hooks/useReferenceData";
import {
  buildAffiliateExportRows,
  buildCenterNameById,
  createAffiliateEditForm,
  createAffiliateModuleFilters,
  filterAndSortAffiliates,
  listAffiliateDepartments,
  paginateItemsWithMeta,
} from "@/utils/admin";
import {
  fetchAffiliateRegistry,
  updateAffiliateProfile,
} from "@/services/admin";

export default function AdminAffiliatesModulePage() {
  const navigate = useNavigate();
  const PAGE_SIZE = 10;
  const DIRECTORY_SKELETON_COUNT = 6;
  const sanitizeDigits = (value, maxLength = null) => {
    const digitsOnly = String(value || "").replace(/\D+/g, "");
    if (maxLength == null) return digitsOnly;
    return digitsOnly.slice(0, maxLength);
  };
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState([]);
  const [centers, setCenters] = useState([]);
  const [filters, setFilters] = useState(createAffiliateModuleFilters());
  const [quickFilter, setQuickFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [dataLoading, setDataLoading] = useState(true);
  const [exportingType, setExportingType] = useState("");
  const [editingAffiliate, setEditingAffiliate] = useState(null);
  const [editForm, setEditForm] = useState(createAffiliateEditForm({}));
  const [savingEdit, setSavingEdit] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { profile } = useAuth();
  const isAdmin =
    String(profile?.role || "")
      .trim()
      .toLowerCase() === "admin";
  const toast = useToast();
  const { departments: referenceDepartments } = useReferenceData();

  useEffect(() => {
    if (error) toast.error("Load failed", error);
  }, [error, toast]);

  useEffect(() => {
    if (message) toast.success("Action completed", message);
  }, [message, toast]);

  const loadData = useCallback(async () => {
    setError("");
    setMessage("");
    setDataLoading(true);
    try {
      const payload = await fetchAffiliateRegistry();
      setRows(payload?.rows || []);
      setCenters(payload?.centers || []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load affiliate data.");
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadData();
    }, 15000);
    return () => clearInterval(timer);
  }, [loadData]);

  const centerNameById = useMemo(() => buildCenterNameById(centers), [centers]);

  const departments = useMemo(() => listAffiliateDepartments(rows), [rows]);
  const affiliateMetrics = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((row) => row.is_active).length;
    const gsFaculty = rows.filter((row) => row.is_gs_faculty).length;
    return {
      total,
      active,
      gsFaculty,
    };
  }, [rows]);

  const quickFilterChips = useMemo(
    () => [
      {
        key: "all",
        label: "All Affiliates",
        count: rows.length,
      },
      {
        key: "faculty",
        label: "Faculty",
        count: rows.filter(
          (row) =>
            String(row.role || "")
              .trim()
              .toLowerCase() === "faculty",
        ).length,
      },
      {
        key: "student",
        label: "Student",
        count: rows.filter(
          (row) =>
            String(row.role || "")
              .trim()
              .toLowerCase() === "student",
        ).length,
      },
      {
        key: "gs",
        label: "GS Faculty",
        count: rows.filter((row) => row.is_gs_faculty).length,
      },
    ],
    [rows],
  );

  const hasActiveDirectoryFilters =
    quickFilter !== "all" ||
    filters.search.trim().length > 0 ||
    String(filters.sortBy || "").trim() !== "name_asc" ||
    String(filters.centerId || "").trim() !== "all" ||
    String(filters.department || "").trim() !== "all";
  const departmentOptions = useMemo(() => {
    const seen = new Set();
    const options = [];

    (Array.isArray(referenceDepartments) ? referenceDepartments : []).forEach(
      (row) => {
        const id = String(row?.id || "").trim();
        const name = String(row?.name || "").trim();
        if (!id || !name || seen.has(id)) return;
        seen.add(id);
        options.push({ id, name });
      },
    );

    departments.forEach((name) => {
      const label = String(name || "").trim();
      if (!label) return;
      const existing = options.find(
        (option) => option.name.toLowerCase() === label.toLowerCase(),
      );
      if (existing) return;
      options.push({ id: label, name: label });
    });

    return options.sort((a, b) => a.name.localeCompare(b.name));
  }, [departments, referenceDepartments]);

  const baseFilteredRows = useMemo(
    () => filterAndSortAffiliates(rows, filters),
    [rows, filters],
  );

  const filteredRows = useMemo(() => {
    if (quickFilter === "gs") {
      return baseFilteredRows.filter((row) => row.is_gs_faculty);
    }
    if (quickFilter === "faculty") {
      return baseFilteredRows.filter(
        (row) =>
          String(row.role || "")
            .trim()
            .toLowerCase() === "faculty",
      );
    }
    if (quickFilter === "student") {
      return baseFilteredRows.filter(
        (row) =>
          String(row.role || "")
            .trim()
            .toLowerCase() === "student",
      );
    }
    return baseFilteredRows;
  }, [baseFilteredRows, quickFilter]);

  const pagination = useMemo(
    () => paginateItemsWithMeta(filteredRows, currentPage, PAGE_SIZE),
    [filteredRows, currentPage],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, quickFilter]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, pagination.totalPages));
  }, [pagination.totalPages]);

  const goToAffiliateDetail = (row) => {
    const id = String(row?.id || "").trim();
    if (!id) return;
    navigate(`/admin/affiliates/${encodeURIComponent(id)}`);
  };

  const openEditModal = (row) => {
    if (row.source === "ckan_only") {
      setError(
        "CKAN-only users are read-only in this page. Update details directly in CKAN.",
      );
      return;
    }
    const matchedDepartment =
      departmentOptions.find((option) => option.id === row.ckan_group_id) ||
      departmentOptions.find(
        (option) =>
          option.name.toLowerCase() ===
          String(row.department || "")
            .trim()
            .toLowerCase(),
      ) ||
      null;
    setEditingAffiliate(row);
    setEditForm({
      ...createAffiliateEditForm(row),
      ckan_group_id: matchedDepartment?.id || row.ckan_group_id || "",
      department: matchedDepartment?.name || row.department || "",
    });
  };

  const updateRowById = (rowId, patch) => {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  };

  const saveAffiliateEdit = async () => {
    if (!editingAffiliate?.id) return;
    setSavingEdit(true);
    setError("");
    setMessage("");
    if (!String(editForm.first_name || "").trim()) {
      setError("First name is required.");
      setSavingEdit(false);
      return;
    }
    if (!String(editForm.last_name || "").trim()) {
      setError("Last name is required.");
      setSavingEdit(false);
      return;
    }
    const payload = {
      ...editForm,
      ckan_group_id: editForm.ckan_group_id || null,
      ckan_org_id: editForm.ckan_org_id || null,
      first_name: String(editForm.first_name || "").trim() || null,
      middle_initial: String(editForm.middle_initial || "").trim() || null,
      last_name: String(editForm.last_name || "").trim() || null,
      publication_count: Number(editForm.publication_count || 0),
      research_project_count: Number(editForm.research_project_count || 0),
      creative_work_count: Number(editForm.creative_work_count || 0),
      awards_count: Number(editForm.awards_count || 0),
      ip_count: Number(editForm.ip_count || 0),
    };

    try {
      const response = await updateAffiliateProfile(
        editingAffiliate.id,
        payload,
      );
      const updated = response?.data || response || payload;
      updateRowById(editingAffiliate.id, updated);
      setMessage(
        `Affiliate updated: ${editingAffiliate.full_name || editingAffiliate.email || editingAffiliate.id}`,
      );
      setEditingAffiliate(null);
    } catch (saveError) {
      setError(saveError.message || "Unable to update affiliate.");
    } finally {
      setSavingEdit(false);
    }
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
    buildAffiliateExportRows(filteredRows, centerNameById);

  const exportAsCsv = () => {
    if (!filteredRows.length) return;
    setExportingType("csv");
    try {
      const headers = [
        "No.",
        "Name",
        "Research Center",
        "Department",
        "Role",
        "GS Faculty",
        "Projects",
        "Awards",
        "Publications",
        "IPs",
        "Creative Works",
      ];
      const lines = buildExportRows().map((row) =>
        [
          row.no,
          row.name,
          row.center,
          row.department,
          row.role,
          row.gs,
          row.projects,
          row.awards,
          row.publications,
          row.ips,
          row.creativeWorks,
        ]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(","),
      );
      const csv = [headers.join(","), ...lines].join("\n");
      triggerDownload(
        `affiliate-records-${new Date().toISOString().slice(0, 10)}.csv`,
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
      const rowsHtml = buildExportRows()
        .map(
          (row) => `
            <tr>
              <td>${row.no}</td>
              <td>${row.name}</td>
              <td>${row.center}</td>
              <td>${row.department}</td>
              <td>${row.role}</td>
              <td>${row.gs}</td>
              <td>${row.projects}</td>
              <td>${row.awards}</td>
              <td>${row.publications}</td>
              <td>${row.ips}</td>
              <td>${row.creativeWorks}</td>
            </tr>
          `,
        )
        .join("");

      const printWindow = window.open("", "_blank", "width=1200,height=800");
      if (!printWindow) {
        setError("Unable to open print window for PDF export.");
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>affiliate-records-filtered</title>
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
            <h1>Affiliate Records Report</h1>
            <p>Generated: ${timestamp} | Scope: filtered | Rows: ${filteredRows.length}</p>
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Name</th>
                  <th>Research Center</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>GS Faculty</th>
                  <th>Projects</th>
                  <th>Awards</th>
                  <th>Publications</th>
                  <th>IPs</th>
                  <th>Creative Works</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="12">No records found.</td></tr>'}
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

  return (
    <section className="page-stack-lg">
      <div className="relative overflow-hidden rounded-3xl border border-black/20 bg-gradient-to-br from-zinc-100 via-white to-zinc-50 p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-16 h-52 w-52 rounded-full bg-zinc-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-zinc-300/40 blur-3xl" />
        <div className="relative">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black">
                Admin Workspace
              </p>
              <h1 className="text-2xl font-bold text-black md:text-3xl">
                Affiliate Workspace
              </h1>
              <p className="max-w-2xl text-sm text-black">
                Manage affiliate records, review membership status, and export
                directory reports from one panel.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!filteredRows.length || Boolean(exportingType)}
                    className="border-gray-300 bg-white text-black hover:bg-gray-100 active:bg-gray-200"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-white border border-gray-300 shadow-md"
                >
                  <DropdownMenuItem
                    className="text-black hover:bg-gray-100 focus:bg-gray-100"
                    onSelect={exportAsCsv}
                    disabled={!filteredRows.length || Boolean(exportingType)}
                  >
                    {exportingType === "csv" ? "Exporting..." : "Export CSV"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-black hover:bg-gray-100 focus:bg-gray-100"
                    onSelect={exportAsPdf}
                    disabled={!filteredRows.length || Boolean(exportingType)}
                  >
                    {exportingType === "pdf" ? "Exporting..." : "Export PDF"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9">
            <div className="rounded-xl border border-black/20 bg-white/90 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black">
                  Affiliates
                </p>
                <Users className="h-4 w-4 text-black" />
              </div>
              <p className="mt-2 text-2xl font-bold text-black">
                {affiliateMetrics.total}
              </p>
            </div>
            <div className="rounded-xl border border-black/20 bg-white/90 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black">
                  Active
                </p>
                <Users className="h-4 w-4 text-black" />
              </div>
              <p className="mt-2 text-2xl font-bold text-black">
                {affiliateMetrics.active}
              </p>
            </div>
            <div className="rounded-xl border border-black/20 bg-white/90 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black">
                  GS Faculty
                </p>
                <Users className="h-4 w-4 text-black" />
              </div>
              <p className="mt-2 text-2xl font-bold text-black">
                {affiliateMetrics.gsFaculty}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/20 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-black">
              Affiliate Directory
            </h2>
            <p className="text-sm text-black">
              Showing {filteredRows.length} filtered affiliate record(s).
            </p>
          </div>

          <div className="inline-flex w-full items-center justify-between gap-1 rounded-full border border-black/20 bg-slate-50 p-1 lg:w-auto">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              type="button"
              className={cn(
                "rounded-full",
                viewMode === "grid"
                  ? "bg-white text-black shadow-sm"
                  : "text-black",
              )}
            >
              <LayoutGrid size={14} />
              Grid
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              type="button"
              className={cn(
                "rounded-full",
                viewMode === "list"
                  ? "bg-white text-black shadow-sm"
                  : "text-black",
              )}
            >
              <List size={14} />
              List
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_14rem] xl:items-center xl:justify-between">
          <label className="relative w-full">
            <span className="sr-only">Search affiliates</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
            <Input
              className="border-black/20 bg-white pl-8"
              placeholder="Search name, email, role, department, or id"
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  search: event.target.value,
                }))
              }
            />
          </label>

          <Select
            value={filters.sortBy}
            onValueChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                sortBy: value,
              }))
            }
          >
            <SelectTrigger className="border-black/20 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Sort: Name A-Z</SelectItem>
              <SelectItem value="name_desc">Sort: Name Z-A</SelectItem>
              <SelectItem value="recent_desc">
                Sort: Recently updated
              </SelectItem>
              <SelectItem value="recent_asc">
                Sort: Least recently updated
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {quickFilterChips.map((chip) => (
            <Button
              key={chip.key}
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "rounded-full border-black/20 px-4 text-xs",
                quickFilter === chip.key
                  ? "bg-zinc-200 text-black hover:bg-zinc-200"
                  : "bg-white text-black hover:bg-slate-50",
              )}
              onClick={() => setQuickFilter(chip.key)}
            >
              {chip.label}
              <span
                className={cn(
                  "ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  quickFilter === chip.key
                    ? "bg-black/10 text-black"
                    : "bg-slate-100 text-black",
                )}
              >
                {chip.count}
              </span>
            </Button>
          ))}

          {isAdmin ? (
            <Select
              value={filters.centerId}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  centerId: value,
                }))
              }
            >
              <SelectTrigger className="h-8 w-[160px] rounded-full border-black/20 bg-white px-4 text-xs">
                <SelectValue placeholder="Research Center" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Research Center</SelectItem>
                {centers.map((center) => (
                  <SelectItem key={center.id} value={center.id}>
                    {center.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <Select
            value={filters.department}
            onValueChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                department: value,
              }))
            }
          >
            <SelectTrigger className="h-8 w-[160px] rounded-full border-black/20 bg-white px-4 text-xs">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Department</SelectItem>
              {departmentOptions.map((department) => (
                <SelectItem
                  key={department.id}
                  value={String(department.name || "").trim()}
                >
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="rounded-full text-xs text-black hover:text-black"
            onClick={() => {
              setQuickFilter("all");
              setFilters(createAffiliateModuleFilters());
            }}
          >
            Reset all
          </Button>
        </div>

        {hasActiveDirectoryFilters ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-black">
              Active Filters
            </span>
            {filters.search.trim() ? (
              <button
                type="button"
                className="rounded-full border border-black/20 bg-zinc-100 px-3 py-1 text-xs font-semibold text-black"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    search: "",
                  }))
                }
              >
                Search: "{filters.search.trim()}" x
              </button>
            ) : null}
            {quickFilter !== "all" ? (
              <button
                type="button"
                className="rounded-full border border-black/20 bg-zinc-100 px-3 py-1 text-xs font-semibold text-black"
                onClick={() => setQuickFilter("all")}
              >
                {quickFilterChips.find((chip) => chip.key === quickFilter)
                  ?.label || "Quick filter"}{" "}
                x
              </button>
            ) : null}
            {String(filters.centerId || "").trim() !== "all" ? (
              <button
                type="button"
                className="rounded-full border border-black/20 bg-zinc-100 px-3 py-1 text-xs font-semibold text-black"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    centerId: "all",
                  }))
                }
              >
                Center x
              </button>
            ) : null}
            {String(filters.department || "").trim() !== "all" ? (
              <button
                type="button"
                className="rounded-full border border-black/20 bg-zinc-100 px-3 py-1 text-xs font-semibold text-black"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    department: "all",
                  }))
                }
              >
                Department x
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <Card className="overflow-hidden border-black/20 shadow-sm">
        <CardContent className="p-4">
          {dataLoading ? (
            viewMode === "grid" ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: DIRECTORY_SKELETON_COUNT }).map(
                  (_, index) => (
                    <Card
                      key={`affiliate-skeleton-grid-${index}`}
                      className="rounded-2xl border border-black/20 bg-white/80 p-5 shadow-sm"
                    >
                      <div className="animate-pulse space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="w-full space-y-2">
                            <div className="h-3 w-24 rounded-full bg-slate-200/80" />
                            <div className="h-5 w-3/4 rounded-full bg-slate-200/70" />
                            <div className="h-3 w-1/2 rounded-full bg-slate-200/60" />
                          </div>
                          <div className="h-6 w-16 rounded-full bg-slate-200/70" />
                        </div>
                        <div className="flex gap-2">
                          <div className="h-6 w-20 rounded-full bg-slate-200/70" />
                          <div className="h-6 w-24 rounded-full bg-slate-200/70" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="h-24 rounded-lg bg-slate-200/60" />
                          <div className="h-24 rounded-lg bg-slate-200/60" />
                        </div>
                        <div className="flex gap-2">
                          <div className="h-9 w-9 rounded-lg bg-slate-200/70" />
                          <div className="h-9 w-9 rounded-lg bg-slate-200/70" />
                        </div>
                      </div>
                    </Card>
                  ),
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-black/20 bg-white shadow-sm p-4">
                <div className="animate-pulse space-y-3">
                  <div className="h-8 w-full rounded-lg bg-slate-200/60" />
                  {Array.from({ length: DIRECTORY_SKELETON_COUNT }).map(
                    (_, index) => (
                      <div
                        key={`affiliate-skeleton-list-${index}`}
                        className="h-12 w-full rounded-lg bg-slate-200/60"
                      />
                    ),
                  )}
                </div>
              </div>
            )
          ) : null}

          {!dataLoading && filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-600">
              No affiliate records found.
            </div>
          ) : null}

          {!dataLoading && viewMode === "grid" && filteredRows.length > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pagination.items.map((row, index) => (
                  <Card
                    key={row.id || `${row.email}-${index}`}
                    className="group rounded-2xl border border-black/20 bg-gradient-to-b from-white to-slate-50/50 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-black">
                            #{pagination.start + index + 1} ·{" "}
                            {String(row.role || "affiliate")}
                          </p>
                          <h3 className="mt-1 truncate text-base font-bold text-black">
                            {row.full_name || "-"}
                          </h3>
                          <p className="mt-1 truncate text-sm text-black">
                            {row.email || "-"}
                          </p>
                        </div>

                        <Badge variant="outline" className="shrink-0 font-mono">
                          {row.id || "-"}
                        </Badge>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge
                          variant="secondary"
                          className="bg-zinc-100 text-black"
                        >
                          Dept: {row.department || "-"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-black/20 text-black"
                        >
                          Center:{" "}
                          {row.ckan_org_id
                            ? centerNameById[row.ckan_org_id] || "-"
                            : "-"}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="bg-zinc-100 text-black"
                        >
                          GS: {row.is_gs_faculty ? "Yes" : "No"}
                        </Badge>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-black/20 bg-zinc-100/70 p-3 text-left">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black">
                            Projects
                          </p>
                          <p className="mt-2 text-2xl font-bold text-black">
                            {Number(row.research_project_count || 0)}
                          </p>
                          <p className="mt-1 text-xs text-black">
                            Publications {Number(row.publication_count || 0)}
                          </p>
                        </div>

                        <div className="rounded-lg border border-black/20 bg-zinc-100/70 p-3 text-left">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black">
                            Outputs
                          </p>
                          <p className="mt-2 text-2xl font-bold text-black">
                            {Number(row.awards_count || 0)}
                          </p>
                          <p className="mt-1 text-xs text-black">
                            IPs {Number(row.ip_count || 0)} · Works{" "}
                            {Number(row.creative_work_count || 0)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => goToAffiliateDetail(row)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          disabled={row.source === "ckan_only"}
                          onClick={() => openEditModal(row)}
                          title={
                            row.source === "ckan_only"
                              ? "Edit disabled (CKAN only)"
                              : "Edit"
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {pagination.totalPages > 1 ? (
                <div className="mt-3">
                  <PaginationControls
                    page={currentPage}
                    totalPages={pagination.totalPages}
                    onPageChange={setCurrentPage}
                    className="border-0 rounded-none shadow-none bg-transparent"
                  />
                </div>
              ) : null}
            </>
          ) : null}

          {!dataLoading && viewMode === "list" && filteredRows.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
              <Table>
                <TableHeader className="bg-gray-50/80">
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Research Center</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>GS Faculty</TableHead>
                    <TableHead>Projects</TableHead>
                    <TableHead>Awards</TableHead>
                    <TableHead>Publications</TableHead>
                    <TableHead>IPs</TableHead>
                    <TableHead>Creative Works</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.items.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-gray-600">
                        {pagination.start + index + 1}
                      </TableCell>

                      <TableCell>
                        <p className="font-semibold text-black">
                          {row.full_name || "-"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {row.email || "-"}
                        </p>
                      </TableCell>

                      <TableCell className="text-gray-700">
                        {row.ckan_org_id
                          ? centerNameById[row.ckan_org_id] || "-"
                          : "-"}
                      </TableCell>

                      <TableCell className="text-gray-700">
                        {row.department || "-"}
                      </TableCell>

                      <TableCell className="capitalize text-gray-700">
                        {row.role || "-"}
                      </TableCell>

                      <TableCell className="text-gray-700">
                        {row.is_gs_faculty ? "Yes" : "No"}
                      </TableCell>

                      <TableCell className="text-gray-700">
                        {Number(row.research_project_count || 0)}
                      </TableCell>

                      <TableCell className="text-gray-700">
                        {Number(row.awards_count || 0)}
                      </TableCell>

                      <TableCell className="text-gray-700">
                        {Number(row.publication_count || 0)}
                      </TableCell>

                      <TableCell className="text-gray-700">
                        {Number(row.ip_count || 0)}
                      </TableCell>

                      <TableCell className="text-gray-700">
                        {Number(row.creative_work_count || 0)}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => goToAffiliateDetail(row)}
                            aria-label={`View ${row?.full_name || "affiliate"}`}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={row.source === "ckan_only"}
                            onClick={() => openEditModal(row)}
                            aria-label={`Edit ${row?.full_name || "affiliate"}`}
                            title={
                              row.source === "ckan_only"
                                ? "Edit disabled (CKAN only)"
                                : "Edit"
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {pagination.totalPages > 1 ? (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={12} className="px-3 py-3">
                        <PaginationControls
                          page={currentPage}
                          totalPages={pagination.totalPages}
                          onPageChange={setCurrentPage}
                          className="border-0 rounded-none shadow-none bg-transparent"
                        />
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                ) : null}
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {editingAffiliate ? (
        <Dialog
          open={Boolean(editingAffiliate)}
          onOpenChange={(open) =>
            !open && !savingEdit && setEditingAffiliate(null)
          }
        >
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Edit Affiliate</DialogTitle>
              <DialogDescription>
                Update affiliate organization links and profile metrics.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2 sm:grid-cols-3 sm:col-span-2">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    First name
                  </span>
                  <Input
                    value={editForm.first_name || ""}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        first_name: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Middle initial
                  </span>
                  <Input
                    maxLength={2}
                    value={editForm.middle_initial || ""}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        middle_initial: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Last name
                  </span>
                  <Input
                    value={editForm.last_name || ""}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        last_name: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Department</span>
                <Select
                  value={editForm.ckan_group_id}
                  onValueChange={(value) => {
                    const nextGroupId = value === "__none__" ? "" : value;
                    const selectedDepartment = departmentOptions.find(
                      (option) => option.id === nextGroupId,
                    );
                    setEditForm((prev) => ({
                      ...prev,
                      ckan_group_id: nextGroupId,
                      department: selectedDepartment?.name || "",
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {departmentOptions.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Research Center
                </span>
                <Select
                  value={editForm.ckan_org_id}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({
                      ...prev,
                      ckan_org_id: value === "__none__" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {centers.map((center) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Designation
                </span>
                <Input
                  placeholder="e.g. Associate Professor"
                  value={editForm.designation}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      designation: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Employment Status
                </span>
                <Select
                  value={editForm.employment_status}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({
                      ...prev,
                      employment_status: value === "__none__" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    <SelectItem value="Permanent">Permanent</SelectItem>
                    <SelectItem value="Lecturer">Lecturer</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-semibold text-slate-700">
                  Google Scholar Link
                </span>
                <Input
                  type="url"
                  placeholder="https://scholar.google.com/..."
                  value={editForm.google_scholar_link}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      google_scholar_link: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={editForm.is_gs_faculty}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      is_gs_faculty: event.target.checked,
                    }))
                  }
                />
                GS faculty
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Publications
                </span>
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={editForm.publication_count}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      publication_count: sanitizeDigits(event.target.value, 6),
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Projects</span>
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={editForm.research_project_count}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      research_project_count: sanitizeDigits(
                        event.target.value,
                        6,
                      ),
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Creative Works
                </span>
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={editForm.creative_work_count}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      creative_work_count: sanitizeDigits(
                        event.target.value,
                        6,
                      ),
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Awards</span>
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={editForm.awards_count}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      awards_count: sanitizeDigits(event.target.value, 6),
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">IPs</span>
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={editForm.ip_count}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      ip_count: sanitizeDigits(event.target.value, 6),
                    }))
                  }
                />
              </label>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingAffiliate(null)}
                  disabled={savingEdit}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={saveAffiliateEdit}
                  disabled={savingEdit}
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
