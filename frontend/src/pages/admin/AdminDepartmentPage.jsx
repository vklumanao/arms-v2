import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  FolderKanban,
  LayoutGrid,
  Link2,
  List,
  Pencil,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";
import PaginationControls from "@/components/navigation/PaginationControls";
import { useToast } from "@/components/providers/ToastProvider";
import {
  deleteReference,
  createReference,
  fetchReferenceData,
  fetchReferenceLinks,
  fetchReferenceUsageCounts,
  updateReference,
} from "@/services/admin";

const INITIAL_FILTERS = {
  search: "",
};
const EMPTY_EDITING = {
  id: null,
  name: "",
  code: "",
  description: "",
  socialMediaLink: "",
  chairpersonId: "",
};

function validateDepartmentForm({ name, code, chairpersonId }) {
  const errors = {};
  const trimmedName = String(name || "").trim();
  const trimmedCode = String(code || "").trim();

  if (!trimmedName) {
    errors.name = "Department name is required.";
  } else if (trimmedName.length < 2) {
    errors.name = "Department name must be at least 2 characters.";
  }

  if (!trimmedCode) {
    errors.code = "Department code is required.";
  } else if (!/^[A-Za-z0-9_]{2,24}$/.test(trimmedCode)) {
    errors.code =
      "Department code must be 2-24 chars (letters, numbers, underscore).";
  }

  if (!String(chairpersonId || "").trim()) {
    errors.chairpersonId = "Chairperson is required.";
  }

  return errors;
}

export default function AdminDepartmentPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const PAGE_SIZE = 10;
  const DIRECTORY_SKELETON_COUNT = 6;
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [quickFilter, setQuickFilter] = useState("all");
  const [rows, setRows] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState(EMPTY_EDITING);
  const [editLoading, setEditLoading] = useState(false);
  const [deletingRow, setDeletingRow] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState("grid");
  const [exporting, setExporting] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newDepartmentCode, setNewDepartmentCode] = useState("");
  const [newDepartmentDescription, setNewDepartmentDescription] = useState("");
  const [newDepartmentSocialMediaLink, setNewDepartmentSocialMediaLink] =
    useState("");
  const [newChairpersonId, setNewChairpersonId] = useState("");
  const [chairpersonUsers, setChairpersonUsers] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
  });
  const [editErrors, setEditErrors] = useState({});
  const [createErrors, setCreateErrors] = useState({});

  const dashboardMetrics = useMemo(() => {
    const totalDepartments = rows.length;
    const totalAffiliates = rows.reduce(
      (sum, row) => sum + Number(row?.profileCount || 0),
      0,
    );
    const totalProjects = rows.reduce(
      (sum, row) => sum + Number(row?.projectCount || 0),
      0,
    );
    const totalLinks = rows.reduce(
      (sum, row) => sum + Number(row?.totalLinks || 0),
      0,
    );

    return {
      totalDepartments,
      totalAffiliates,
      totalProjects,
      totalLinks,
    };
  }, [rows]);

  const loadDepartmentRows = async () => {
    setDataLoading(true);
    setDataError("");
    try {
      const referencePayload = await fetchReferenceData();
      const centersData = referencePayload?.departmentsRes?.data || [];
      const ckanUsersData = referencePayload?.ckanUsersRes?.data || [];

      const usageByCenter = await Promise.all(
        centersData.map(async (center) => {
          const centerId = center?.id;
          try {
            const usage = await fetchReferenceUsageCounts({
              type: "department",
              id: centerId,
            });
            return {
              id: centerId,
              projectCount: usage?.projectCount || 0,
              profileCount: usage?.profileCount || 0,
              memberBreakdown: usage?.memberBreakdown || {
                adminCount: 0,
                editorCount: 0,
                memberCount: 0,
                totalCount: 0,
              },
            };
          } catch {
            return {
              id: center.id,
              projectCount: 0,
              profileCount: 0,
              memberBreakdown: {
                adminCount: 0,
                editorCount: 0,
                memberCount: 0,
                totalCount: 0,
              },
            };
          }
        }),
      );

      const usageMap = Object.fromEntries(
        usageByCenter.map((item) => [item.id, item]),
      );

      const mapped = centersData
        .map((item) => {
          const orgId = item.id;
          const chairpersonId = String(item?.chairperson_id || "").trim();
          const chairpersonName =
            String(item?.chairperson_name || "").trim() ||
            ckanUsersData.find(
              (user) => String(user?.id || "").trim() === chairpersonId,
            )?.name ||
            "";
          return {
            id: orgId,
            code: String(item?.code || "").trim() || String(orgId || "-"),
            name: item.title || item.display_name || item.name || "-",
            description: String(item?.description || "").trim(),
            socialMediaLink: String(item?.social_media_link || "").trim(),
            type: "Department",
            tag: "department",
            chairpersonId,
            chairpersonName: chairpersonName || "-",
            projectCount: usageMap[orgId]?.projectCount || 0,
            profileCount: usageMap[orgId]?.profileCount || 0,
            memberBreakdown: usageMap[orgId]?.memberBreakdown || {
              adminCount: 0,
              editorCount: 0,
              memberCount: 0,
              totalCount: 0,
            },
            totalLinks:
              (usageMap[orgId]?.projectCount || 0) +
              (usageMap[orgId]?.profileCount || 0),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      setRows(mapped);
      setChairpersonUsers(
        (ckanUsersData || [])
          .filter(
            (item) =>
              String(item?.state || "").toLowerCase() !== "deleted" &&
              String(item?.role || "").toLowerCase() === "faculty",
          )
          .map((item) => ({
            id: item.id,
            name:
              item.name ||
              item.fullname ||
              item.display_name ||
              item.username ||
              item.email ||
              "Unnamed Faculty User",
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (loadError) {
      setRows([]);
      setChairpersonUsers([]);
      setDataError(loadError.message || "Unable to load department data.");
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    loadDepartmentRows();
  }, []);

  useEffect(() => {
    if (!dataError) return;
    toast.error("Department data unavailable", dataError);
  }, [dataError, toast]);

  useEffect(() => {
    if (!actionError) return;
    toast.error("Department action failed", actionError);
  }, [actionError, toast]);

  useEffect(() => {
    if (!actionMessage) return;
    toast.success("Department action completed", actionMessage);
  }, [actionMessage, toast]);

  const filteredRows = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();

    return rows.filter((row) => {
      if (
        quickFilter === "with_projects" &&
        Number(row?.projectCount || 0) === 0
      )
        return false;
      if (
        quickFilter === "with_affiliates" &&
        Number(row?.profileCount || 0) === 0
      )
        return false;
      if (quickFilter === "with_links" && Number(row?.totalLinks || 0) === 0)
        return false;
      if (
        keyword &&
        !(
          row.name.toLowerCase().includes(keyword) ||
          row.code.toLowerCase().includes(keyword) ||
          String(row.chairpersonName || "")
            .toLowerCase()
            .includes(keyword) ||
          row.type.toLowerCase().includes(keyword) ||
          row.id.toLowerCase().includes(keyword)
        )
      ) {
        return false;
      }

      return true;
    });
  }, [rows, filters, quickFilter]);

  const quickFilterChips = useMemo(
    () => [
      {
        key: "all",
        label: "All Departments",
        count: rows.length,
      },
      {
        key: "with_projects",
        label: "With Projects",
        count: rows.filter((row) => Number(row?.projectCount || 0) > 0).length,
      },
      {
        key: "with_affiliates",
        label: "With Affiliates",
        count: rows.filter((row) => Number(row?.profileCount || 0) > 0).length,
      },
      {
        key: "with_links",
        label: "With Links",
        count: rows.filter((row) => Number(row?.totalLinks || 0) > 0).length,
      },
    ],
    [rows],
  );

  const hasActiveDirectoryFilters =
    quickFilter !== "all" || filters.search.trim().length > 0;

  const sortedFilteredRows = useMemo(() => {
    const source = [...filteredRows];
    const { key, direction } = sortConfig;
    const factor = direction === "asc" ? 1 : -1;

    source.sort((a, b) => {
      const av = a?.[key];
      const bv = b?.[key];

      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * factor;
      }

      return (
        String(av ?? "")
          .toLowerCase()
          .localeCompare(String(bv ?? "").toLowerCase()) * factor
      );
    });

    return source;
  }, [filteredRows, sortConfig]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedFilteredRows.length / PAGE_SIZE),
  );
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedFilteredRows.slice(start, start + PAGE_SIZE);
  }, [sortedFilteredRows, currentPage, PAGE_SIZE]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, rows.length, quickFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const toggleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return "\u2195";
    return sortConfig.direction === "asc" ? "\u2191" : "\u2193";
  };

  const editValidationErrors = useMemo(
    () =>
      validateDepartmentForm({
        name: editing.name,
        code: editing.code,
        chairpersonId: editing.chairpersonId,
      }),
    [editing],
  );

  const createValidationErrors = useMemo(
    () =>
      validateDepartmentForm({
        name: newDepartmentName,
        code: newDepartmentCode,
        chairpersonId: newChairpersonId,
      }),
    [newChairpersonId, newDepartmentCode, newDepartmentName],
  );

  const isEditFormValid = Object.keys(editValidationErrors).length === 0;
  const isCreateFormValid = Object.keys(createValidationErrors).length === 0;

  const startEdit = (row) => {
    setActionError("");
    setActionMessage("");
    setEditErrors({});
    setEditModalOpen(true);
    setEditing({
      ...EMPTY_EDITING,
      id: row.id,
      name: row.name === "-" ? "" : row.name,
      code: row.code === "-" ? "" : row.code,
      description: String(row?.description || "").trim(),
      socialMediaLink: String(row?.socialMediaLink || "").trim(),
      chairpersonId: row.chairpersonId || "",
    });
    setEditLoading(false);
  };

  const cancelEdit = () => {
    if (actionLoading) return;
    setEditModalOpen(false);
    setEditErrors({});
    setEditing(EMPTY_EDITING);
  };

  const saveEdit = async () => {
    const nextName = editing.name.trim();
    const nextCode = editing.code.trim();
    const errors = validateDepartmentForm({
      name: nextName,
      code: nextCode,
      chairpersonId: editing.chairpersonId,
    });
    setEditErrors(errors);
    if (!editing.id || Object.keys(errors).length > 0) {
      return;
    }
    setActionLoading(true);
    setActionError("");
    setActionMessage("");

    const { error: updateError } = await updateReference({
      type: "department",
      id: editing.id,
      name: nextName,
      code: nextCode,
      description: editing.description,
      social_media_link: editing.socialMediaLink,
      chairperson_id: editing.chairpersonId,
    });

    if (updateError) {
      setActionError(updateError.message || "Unable to update department.");
      setActionLoading(false);
      return;
    }

    setActionMessage("Department updated successfully.");
    setActionLoading(false);
    cancelEdit();
    await loadDepartmentRows();
  };

  const confirmDelete = async () => {
    if (!deletingRow?.id) return;

    setActionLoading(true);
    setActionError("");
    setActionMessage("");

    const { error: deleteError } = await deleteReference({
      type: "department",
      id: deletingRow.id,
    });

    if (deleteError) {
      setActionError(
        deleteError.message ||
          "Unable to delete department. It may still be referenced by records.",
      );
      setActionLoading(false);
      return;
    }

    setRows((prev) => prev.filter((row) => row.id !== deletingRow.id));
    setActionMessage("Department deleted successfully.");
    setActionLoading(false);
    setDeletingRow(null);
  };

  const goToDepartmentDetail = (row, tab = null) => {
    const id = String(row?.id || "").trim();
    if (!id) return;
    const query = tab ? `?tab=${encodeURIComponent(tab)}` : "";
    navigate(`/admin/departments/${encodeURIComponent(id)}${query}`);
  };

  const createDepartment = async () => {
    const name = newDepartmentName.trim();
    const code = newDepartmentCode.trim();
    const errors = validateDepartmentForm({
      name,
      code,
      chairpersonId: newChairpersonId,
    });
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setCreateLoading(true);
    setActionError("");
    setActionMessage("");

    const { error: createError } = await createReference({
      type: "department",
      name,
      code,
      description: newDepartmentDescription,
      social_media_link: newDepartmentSocialMediaLink,
      chairperson_id: newChairpersonId,
    });

    if (createError) {
      setActionError(createError.message || "Unable to create department.");
      setCreateLoading(false);
      return;
    }

    setActionMessage("Department created successfully.");
    setCreateLoading(false);
    setCreateModalOpen(false);
    setCreateErrors({});
    setNewDepartmentName("");
    setNewDepartmentCode("");
    setNewDepartmentDescription("");
    setNewDepartmentSocialMediaLink("");
    setNewChairpersonId("");
    await loadDepartmentRows();
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

  const exportRowsAsCsv = (dataset, suffix = "filtered") => {
    setExporting(true);
    try {
      const headers = [
        "department_code",
        "department_name",
        "department_type",
        "linked_affiliates",
        "linked_projects",
        "total_links",
      ];
      const lines = dataset.map((row) =>
        [
          row.code,
          row.name,
          row.type,
          row.profileCount,
          row.projectCount,
          row.totalLinks,
        ]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(","),
      );
      const csv = [headers.join(","), ...lines].join("\n");
      triggerDownload(
        `department-records-${suffix}.csv`,
        csv,
        "text/csv;charset=utf-8;",
      );
    } finally {
      setExporting(false);
    }
  };

  const exportRowsAsPdf = (dataset, suffix = "filtered") => {
    setExporting(true);
    try {
      const timestamp = new Date().toLocaleString();
      const rowsHtml = dataset
        .map(
          (row, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${row.code}</td>
              <td>${row.name}</td>
              <td>${row.type}</td>
              <td>${row.profileCount}</td>
              <td>${row.projectCount}</td>
              <td>${row.totalLinks}</td>
            </tr>
          `,
        )
        .join("");

      const printWindow = window.open("", "_blank", "width=1200,height=800");
      if (!printWindow) {
        setActionError("Unable to open print window for PDF export.");
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>department-records-${suffix}</title>
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
            <h1>Department Records Report</h1>
            <p>Generated: ${timestamp} | Scope: ${suffix} | Rows: ${dataset.length}</p>
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Department Code</th>
                  <th>Department Name</th>
                  <th>Department Type</th>
                  <th>Linked Affiliates</th>
                  <th>Linked Projects</th>
                  <th>Total Links</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="7">No records found.</td></tr>'}
              </tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } finally {
      setExporting(false);
    }
  };

  const deleteGuard = (() => {
    if (!deletingRow) {
      return {
        blocked: false,
        confirmLabel: "Delete",
        message: "",
      };
    }

    const projectCount = Number(deletingRow?.projectCount || 0);
    const editorCount = Number(deletingRow?.memberBreakdown?.editorCount || 0);
    const memberCount = Number(deletingRow?.memberBreakdown?.memberCount || 0);
    const nonAdminAffiliates = editorCount + memberCount;

    const reasons = [];
    if (projectCount > 0) reasons.push(`${projectCount} linked project(s)`);
    if (nonAdminAffiliates > 0) {
      reasons.push(`${nonAdminAffiliates} linked affiliate(s)`);
    }

    const blocked = reasons.length > 0;
    const name = String(deletingRow?.name || "").trim();

    return {
      blocked,
      confirmLabel: blocked ? "Close" : "Delete",
      message: blocked
        ? `Cannot delete "${name}". This department has ${reasons.join(" and ")}. Remove/reassign them first.`
        : `Delete "${name}"? This action cannot be undone.`,
    };
  })();

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
                Department Workspace
              </h1>
              <p className="max-w-2xl text-sm text-black">
                Manage department records, monitor affiliations, and track
                project coverage from one control panel.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={exporting || filteredRows.length === 0}
                    className="border-zinc-300 bg-white text-black hover:bg-zinc-100 active:bg-zinc-200"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-white border border-zinc-300 shadow-md"
                >
                  <DropdownMenuItem
                    className="text-black hover:bg-zinc-100 focus:bg-zinc-100"
                    onSelect={() =>
                      exportRowsAsCsv(sortedFilteredRows, "filtered")
                    }
                  >
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-black hover:bg-zinc-100 focus:bg-zinc-100"
                    onSelect={() =>
                      exportRowsAsPdf(sortedFilteredRows, "filtered")
                    }
                  >
                    Export PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="mono"
                onClick={() => {
                  setCreateErrors({});
                  setCreateModalOpen(true);
                }}
              >
                Create Department
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/20 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-black">
              Department Directory
            </h2>
            <p className="text-sm text-black">
              Showing {filteredRows.length} filtered department record(s).
            </p>
          </div>

          <div className="inline-flex w-full items-center justify-between gap-1 rounded-full border border-black/20 bg-zinc-50 p-1 lg:w-auto">
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

        <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <label className="relative w-full xl:max-w-lg">
            <span className="sr-only">Search departments</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
            <Input
              className="border-black/20 bg-white pl-8"
              placeholder="Search name, code, chairperson, or id"
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  search: event.target.value,
                }))
              }
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
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
                    : "bg-white text-black hover:bg-zinc-50",
                )}
                onClick={() => setQuickFilter(chip.key)}
              >
                {chip.label}
                <span
                  className={cn(
                    "ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    quickFilter === chip.key
                      ? "bg-black/10 text-black"
                      : "bg-zinc-100 text-black",
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
              className="rounded-full text-xs text-black hover:text-black"
              onClick={() => {
                setQuickFilter("all");
                setFilters(INITIAL_FILTERS);
              }}
            >
              Reset all
            </Button>
          </div>
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
                      key={`department-skeleton-grid-${index}`}
                      className="rounded-2xl border border-black/20 bg-white/80 p-5 shadow-sm"
                    >
                      <div className="animate-pulse space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="w-full space-y-2">
                            <div className="h-3 w-24 rounded-full bg-zinc-200/80" />
                            <div className="h-5 w-3/4 rounded-full bg-zinc-200/70" />
                            <div className="h-3 w-1/2 rounded-full bg-zinc-200/60" />
                          </div>
                          <div className="h-6 w-16 rounded-full bg-zinc-200/70" />
                        </div>
                        <div className="flex gap-2">
                          <div className="h-6 w-20 rounded-full bg-zinc-200/70" />
                          <div className="h-6 w-24 rounded-full bg-zinc-200/70" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="h-24 rounded-lg bg-zinc-200/60" />
                          <div className="h-24 rounded-lg bg-zinc-200/60" />
                        </div>
                        <div className="flex gap-2">
                          <div className="h-9 w-9 rounded-lg bg-zinc-200/70" />
                          <div className="h-9 w-9 rounded-lg bg-zinc-200/70" />
                          <div className="h-9 w-9 rounded-lg bg-zinc-200/70" />
                        </div>
                      </div>
                    </Card>
                  ),
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-black/20 bg-white shadow-sm p-4">
                <div className="animate-pulse space-y-3">
                  <div className="h-8 w-full rounded-lg bg-zinc-200/60" />
                  {Array.from({ length: DIRECTORY_SKELETON_COUNT }).map(
                    (_, index) => (
                      <div
                        key={`department-skeleton-list-${index}`}
                        className="h-12 w-full rounded-lg bg-zinc-200/60"
                      />
                    ),
                  )}
                </div>
              </div>
            )
          ) : null}

          {!dataLoading && filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-600">
              No department records found.
            </div>
          ) : null}

          {!dataLoading && viewMode === "grid" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {paginatedRows.map((row, index) => (
                  <Card
                    key={`${row.tag}-${row.id}`}
                    className="group rounded-2xl border border-black/20 bg-gradient-to-b from-white to-zinc-50/50"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-black">
                            #{(currentPage - 1) * PAGE_SIZE + index + 1} ·{" "}
                            {row.type}
                          </p>
                          <h3 className="mt-1 truncate text-base font-bold text-black">
                            {row.name}
                          </h3>
                          <p className="mt-1 truncate text-sm text-black">
                            Chairperson:{" "}
                            <span className="font-semibold text-black">
                              {row.chairpersonName || "-"}
                            </span>
                          </p>
                        </div>

                        <Badge variant="outline" className="shrink-0 font-mono">
                          {row.code}
                        </Badge>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge
                          variant="secondary"
                          className="bg-zinc-100 text-black"
                        >
                          Links: {row.totalLinks || 0}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="bg-zinc-100 text-black"
                        >
                          Affiliates: {row.profileCount || 0}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-black/20 text-black"
                        >
                          Projects: {row.projectCount || 0}
                        </Badge>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          className={cn(
                            "rounded-lg border border-black/20 bg-zinc-100/70 p-3 text-left transition-colors",
                            "hover:bg-zinc-100",
                          )}
                          onClick={() =>
                            goToDepartmentDetail(row, "affiliates")
                          }
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black">
                              Affiliates
                            </p>
                            <Users className="h-4 w-4 text-black" />
                          </div>
                          <p className="mt-2 text-2xl font-bold text-black">
                            {row.profileCount}
                          </p>
                          <p className="mt-1 text-xs text-black">
                            Admin {row.memberBreakdown?.adminCount || 0} ·
                            Editor {row.memberBreakdown?.editorCount || 0} ·
                            Member {row.memberBreakdown?.memberCount || 0}
                          </p>
                        </button>

                        <button
                          type="button"
                          className={cn(
                            "rounded-lg border border-black/20 bg-zinc-100/70 p-3 text-left transition-colors",
                            "hover:bg-zinc-100",
                          )}
                          onClick={() => goToDepartmentDetail(row, "projects")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black">
                              Projects
                            </p>
                            <FolderKanban className="h-4 w-4 text-black" />
                          </div>
                          <p className="mt-2 text-2xl font-bold text-black">
                            {row.projectCount}
                          </p>
                          <p className="mt-1 text-xs text-black">
                            Linked research projects.
                          </p>
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => goToDepartmentDetail(row)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => startEdit(row)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 text-black hover:bg-zinc-100"
                          onClick={() => setDeletingRow(row)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="mt-3">
                  <PaginationControls
                    page={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    className="border-0 rounded-none shadow-none bg-transparent"
                  />
                </div>
              ) : null}
            </>
          ) : !dataLoading ? (
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <Table className="min-w-[980px]">
                <TableHeader className="bg-zinc-50">
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSort("code")}
                      >
                        Code {getSortIndicator("code")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSort("name")}
                      >
                        Department {getSortIndicator("name")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSort("chairpersonName")}
                      >
                        Chairperson {getSortIndicator("chairpersonName")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSort("profileCount")}
                      >
                        Affiliates {getSortIndicator("profileCount")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSort("projectCount")}
                      >
                        Projects {getSortIndicator("projectCount")}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedRows.map((row, index) => (
                    <TableRow key={`${row.tag}-${row.id}`}>
                      <TableCell>
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.code}
                      </TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.chairpersonName || "-"}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            goToDepartmentDetail(row, "affiliates")
                          }
                        >
                          {row.profileCount}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => goToDepartmentDetail(row, "projects")}
                        >
                          {row.projectCount}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => goToDepartmentDetail(row)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(row)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingRow(row)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>

                {totalPages > 1 ? (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={7} className="px-3 py-3">
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
          ) : null}
        </CardContent>
      </Card>

      <ConfirmActionModal
        open={Boolean(deletingRow)}
        title="Delete Department"
        message={deleteGuard.message}
        confirmLabel={deleteGuard.confirmLabel}
        align="center"
        loading={deleteGuard.blocked ? false : actionLoading}
        onCancel={() => setDeletingRow(null)}
        onConfirm={
          deleteGuard.blocked ? () => setDeletingRow(null) : confirmDelete
        }
      />

      {editModalOpen ? (
        <Dialog
          open={editModalOpen}
          onOpenChange={(open) => !open && cancelEdit()}
        >
          <DialogContent
            className="max-w-2xl"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Edit Department</DialogTitle>
              <DialogDescription>
                Update all department information.
              </DialogDescription>
            </DialogHeader>

            {editLoading ? (
              <p className="mt-4 text-sm text-zinc-600">
                Loading department details...
              </p>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    Department Name *
                  </label>
                  <Input
                    value={editing.name}
                    onChange={(e) => {
                      setEditing((p) => ({ ...p, name: e.target.value }));
                      setEditErrors((p) => ({ ...p, name: "" }));
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    Code *
                  </label>
                  <Input
                    value={editing.code}
                    onChange={(e) => {
                      setEditing((p) => ({
                        ...p,
                        code: e.target.value.toUpperCase().replace(/\s+/g, "_"),
                      }));
                      setEditErrors((p) => ({ ...p, code: "" }));
                    }}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    Description
                  </label>
                  <Textarea
                    value={editing.description}
                    onChange={(e) =>
                      setEditing((p) => ({ ...p, description: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    Social Media Link
                  </label>
                  <Input
                    value={editing.socialMediaLink}
                    onChange={(e) =>
                      setEditing((p) => ({
                        ...p,
                        socialMediaLink: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    Chairperson *
                  </label>
                  <Select
                    value={editing.chairpersonId}
                    onValueChange={(v) => {
                      setEditing((p) => ({ ...p, chairpersonId: v }));
                      setEditErrors((p) => ({ ...p, chairpersonId: "" }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Chairperson" />
                    </SelectTrigger>
                    <SelectContent>
                      {chairpersonUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button
                onClick={saveEdit}
                disabled={actionLoading || editLoading || !isEditFormValid}
              >
                {actionLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {createModalOpen ? (
        <Dialog
          open={createModalOpen}
          onOpenChange={(open) => !open && setCreateModalOpen(false)}
        >
          <DialogContent className="w-full max-w-4xl">
            <DialogHeader>
              <DialogTitle>Create Department</DialogTitle>
              <DialogDescription>
                Add a new department to the registry.
              </DialogDescription>
            </DialogHeader>

            <div className="mx-auto w-full max-w-3xl">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      Department Name *
                    </label>
                    <Input
                      className="w-full"
                      placeholder="e.g. Bachelor of Science in Information System"
                      value={newDepartmentName}
                      onChange={(e) => setNewDepartmentName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      Code *
                    </label>
                    <Input
                      className="w-full"
                      placeholder="e.g. BSIS"
                      value={newDepartmentCode}
                      onChange={(e) =>
                        setNewDepartmentCode(
                          e.target.value.toUpperCase().replace(/\s+/g, "_"),
                        )
                      }
                    />
                    <p className="text-xs text-zinc-400">
                      Use uppercase abbreviation.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      Description *
                    </label>
                    <Textarea
                      className="w-full"
                      placeholder="Short description about the department..."
                      value={newDepartmentDescription}
                      onChange={(e) =>
                        setNewDepartmentDescription(e.target.value)
                      }
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      Chairperson *
                    </label>
                    <Select
                      value={newChairpersonId}
                      onValueChange={setNewChairpersonId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select chairperson" />
                      </SelectTrigger>
                      <SelectContent>
                        {chairpersonUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-auto mt-6 flex w-full max-w-3xl justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={createDepartment} disabled={!isCreateFormValid}>
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
