import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { hasPermission, PERMISSIONS } from "@/services/permissions";
import { AffiliatesDirectoryContent } from "./affiliates-module/components/AffiliatesModulePanels";

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
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const { profile } = useAuth();
  const roleKeys = Array.isArray(profile?.roles)
    ? profile.roles.map((entry) => entry?.key)
    : profile?.role;
  const isAdmin =
    String(profile?.role || "")
      .trim()
      .toLowerCase() === "admin";
  const canEditAffiliates = hasPermission(
    roleKeys,
    PERMISSIONS.AFFILIATES_EDIT,
    profile?.permissions,
  );
  const canExportAffiliates = hasPermission(
    roleKeys,
    PERMISSIONS.AFFILIATES_VIEW,
    profile?.permissions,
  );
  const toast = useToast();
  const { departments: referenceDepartments } = useReferenceData();

  useEffect(() => {
    if (error) toast.error("Load failed", error);
  }, [error, toast]);

  useEffect(() => {
    if (message) toast.success("Action completed", message);
  }, [message, toast]);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    setError("");
    setMessage("");
    if (!silent) setDataLoading(true);
    try {
      const payload = await fetchAffiliateRegistry();
      setRows(payload?.rows || []);
      setCenters(payload?.centers || []);
      setLastSyncedAt(new Date());
    } catch (loadError) {
      setError(loadError.message || "Unable to load affiliate data.");
    } finally {
      if (!silent) setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleViewportChange = () => setIsMobile(mediaQuery.matches);
    handleViewportChange();
    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);

  useEffect(() => {
    if (isMobile && viewMode === "grid") {
      setViewMode("list");
    }
  }, [isMobile, viewMode]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadData({ silent: true });
    }, 15000);
    return () => clearInterval(timer);
  }, [loadData]);

  const centerNameById = useMemo(() => buildCenterNameById(centers), [centers]);

  const departments = useMemo(() => listAffiliateDepartments(rows), [rows]);
  const affiliateMetrics = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((row) => row.is_active).length;
    const faculty = rows.filter(
      (row) =>
        String(row.role || "")
          .trim()
          .toLowerCase() === "faculty",
    ).length;
    const gsFaculty = rows.filter((row) => row.is_gs_faculty).length;
    return {
      total,
      active,
      faculty,
      gsFaculty,
    };
  }, [rows]);

  const syncLabel = useMemo(() => {
    if (!lastSyncedAt) return "Not synced yet";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(lastSyncedAt);
  }, [lastSyncedAt]);

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

  const activeFilterPills = useMemo(() => {
    const pills = [];
    if (filters.search.trim()) {
      pills.push({
        key: "search",
        label: `Search: "${filters.search.trim()}"`,
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            search: "",
          })),
      });
    }
    if (quickFilter !== "all") {
      pills.push({
        key: "quickFilter",
        label:
          quickFilterChips.find((chip) => chip.key === quickFilter)?.label ||
          "Quick filter",
        onRemove: () => setQuickFilter("all"),
      });
    }
    if (String(filters.centerId || "").trim() !== "all") {
      pills.push({
        key: "center",
        label: "Center",
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            centerId: "all",
          })),
      });
    }
    if (String(filters.department || "").trim() !== "all") {
      pills.push({
        key: "department",
        label: "Department",
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            department: "all",
          })),
      });
    }
    return pills;
  }, [filters, quickFilter, quickFilterChips]);

  const effectiveViewMode = isMobile ? "list" : viewMode;
  const selectedQuickFilterChip = useMemo(
    () =>
      quickFilterChips.find((chip) => chip.key === quickFilter) ||
      quickFilterChips[0],
    [quickFilter, quickFilterChips],
  );
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

  const resetDirectoryFilters = useCallback(() => {
    setQuickFilter("all");
    setFilters(createAffiliateModuleFilters());
  }, []);

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
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="relative">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Admin Workspace
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Affiliate Directory
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Find, filter, review, and update affiliate records from one
              responsive admin workspace.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                  Total
                </p>
                <Users className="h-4 w-4 text-slate-700" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-700">
                {affiliateMetrics.total}
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                  Active
                </p>
                <Users className="h-4 w-4 text-slate-700" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-700">
                {affiliateMetrics.active}
              </p>
            </article>
            <article className="hidden rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:block">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                  Faculty
                </p>
                <Users className="h-4 w-4 text-slate-700" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-700">
                {affiliateMetrics.faculty}
              </p>
            </article>
            <article className="hidden rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:block">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                  GS Faculty
                </p>
                <Users className="h-4 w-4 text-slate-700" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-700">
                {affiliateMetrics.gsFaculty}
              </p>
            </article>
          </div>
        </div>
      </div>
      <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          More stats
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
              Faculty
            </p>
            <p className="mt-1 text-xl font-bold text-slate-700">
              {affiliateMetrics.faculty}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
              GS Faculty
            </p>
            <p className="mt-1 text-xl font-bold text-slate-700">
              {affiliateMetrics.gsFaculty}
            </p>
          </div>
        </div>
      </details>

      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-slate-700">
                  Affiliate Directory
                </h2>
                <p className="text-sm text-slate-600">
                  Showing {filteredRows.length} filtered affiliate record(s).
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                  <label className="relative w-full lg:max-w-md">
                    <span className="sr-only">Search affiliates</span>
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
                    <Input
                      className="pl-9"
                      placeholder="Search name, email, center, department, or role"
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
                    <SelectTrigger className="w-full lg:w-[16rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border border-slate-300 bg-white shadow-md">
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

                  <div className="inline-flex w-full items-center justify-between gap-1 rounded-full border border-slate-200 bg-white p-1 lg:w-auto">
                    <Button
                      variant={viewMode === "grid" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("grid")}
                      type="button"
                      className="rounded-full"
                      disabled={isMobile}
                    >
                      <LayoutGrid size={14} />
                      Grid
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                      type="button"
                      className="rounded-full"
                    >
                      <List size={14} />
                      List
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select value={quickFilter} onValueChange={setQuickFilter}>
                    <SelectTrigger className="w-full bg-white text-xs text-slate-700 sm:w-[16rem]">
                      <SelectValue>
                        {selectedQuickFilterChip
                          ? `${selectedQuickFilterChip.label} (${selectedQuickFilterChip.count})`
                          : "Filter affiliates"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="border border-slate-200 bg-white shadow-md">
                      {quickFilterChips.map((chip) => (
                        <SelectItem key={chip.key} value={chip.key}>
                          {chip.label} ({chip.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

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
                      <SelectTrigger className="w-full bg-white text-xs text-slate-700 sm:w-[16rem]">
                        <SelectValue placeholder="Research Center" />
                      </SelectTrigger>
                      <SelectContent className="border border-slate-200 bg-white shadow-md">
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
                    <SelectTrigger className="w-full bg-white text-xs text-slate-700 sm:w-[16rem]">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent className="border border-slate-200 bg-white shadow-md">
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
                    className="rounded-full text-xs text-slate-700 hover:text-slate-700"
                    onClick={resetDirectoryFilters}
                  >
                    Reset all
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => loadData()}
                  disabled={dataLoading}
                >
                  <RefreshCw
                    className={cn("h-4 w-4", dataLoading && "animate-spin")}
                  />
                  Refresh
                </Button>

                {canExportAffiliates ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          !filteredRows.length || Boolean(exportingType)
                        }
                        className="h-9 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      >
                        <Download className="h-4 w-4" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="border border-slate-300 bg-white shadow-md"
                    >
                      <DropdownMenuItem
                        className="text-slate-700 hover:bg-slate-50 focus:bg-slate-50"
                        onSelect={exportAsCsv}
                        disabled={
                          !filteredRows.length || Boolean(exportingType)
                        }
                      >
                        {exportingType === "csv"
                          ? "Exporting..."
                          : "Export CSV"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-slate-700 hover:bg-slate-50 focus:bg-slate-50"
                        onSelect={exportAsPdf}
                        disabled={
                          !filteredRows.length || Boolean(exportingType)
                        }
                      >
                        {exportingType === "pdf"
                          ? "Exporting..."
                          : "Export PDF"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </div>

            {hasActiveDirectoryFilters ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                  Active Filters
                </span>
                {activeFilterPills.map((pill) => (
                  <button
                    key={pill.key}
                    type="button"
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                    onClick={pill.onRemove}
                  >
                    {pill.label} x
                  </button>
                ))}
              </div>
            ) : null}

            <AffiliatesDirectoryContent
              dataLoading={dataLoading}
              viewMode={effectiveViewMode}
              directorySkeletonCount={DIRECTORY_SKELETON_COUNT}
              filteredRows={filteredRows}
              pagination={pagination}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              centerNameById={centerNameById}
              canEditAffiliates={canEditAffiliates}
              goToAffiliateDetail={goToAffiliateDetail}
              openEditModal={openEditModal}
            />
          </div>
        </div>
      </div>

      {!dataLoading ? (
        <div className="sticky bottom-3 z-10 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-md backdrop-blur">
          <div className="flex flex-col gap-1 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {isMobile
                ? `${filteredRows.length} results | Page ${pagination.page}/${pagination.totalPages}`
                : filteredRows.length
                  ? `Showing ${pagination.start + 1}-${pagination.end} of ${filteredRows.length} filtered affiliate record(s).`
                  : "Showing 0 records."}
            </p>
            {!isMobile ? (
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Page {pagination.page} of {pagination.totalPages}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {editingAffiliate && canEditAffiliates ? (
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
