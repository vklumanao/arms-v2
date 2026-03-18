import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  FolderKanban,
  LayoutGrid,
  List,
  Pencil,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import PageHeader from "@/components/layout/PageHeader";
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
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [filters, setFilters] = useState(INITIAL_FILTERS);
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
  const [newChairpersonId, setNewChairpersonId] = useState("");
  const [chairpersonUsers, setChairpersonUsers] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
  });
  const [editErrors, setEditErrors] = useState({});
  const [createErrors, setCreateErrors] = useState({});

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
  }, [rows, filters]);

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
  }, [filters, rows.length]);

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
      <PageHeader
        title="Department"
        description="Manage departments and inspect linked affiliates, members, and projects in one view."
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold text-slate-900">
                Department Records
              </CardTitle>
              <CardDescription>
                Showing {filteredRows.length} record(s).
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={exporting || filteredRows.length === 0}
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() =>
                      exportRowsAsCsv(sortedFilteredRows, "filtered")
                    }
                  >
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      exportRowsAsPdf(sortedFilteredRows, "filtered")
                    }
                  >
                    Export PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                onClick={() => {
                  setCreateErrors({});
                  setCreateModalOpen(true);
                }}
              >
                Create Department
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="relative w-full md:max-w-md">
              <span className="sr-only">Search departments</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-8"
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

            <div className="inline-flex w-full items-center justify-between gap-1 rounded-md border border-border bg-white p-1 md:w-auto">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                type="button"
              >
                <LayoutGrid size={14} />
                Grid
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                type="button"
              >
                <List size={14} />
                List
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          {!dataLoading && filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-sm text-slate-600">
              No department records found.
            </div>
          ) : null}
          {viewMode === "grid" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {paginatedRows.map((row, index) => (
                <Card
                  key={`${row.tag}-${row.id}`}
                  className="group border-border/60 bg-white transition-shadow hover:shadow-md"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                          #{(currentPage - 1) * PAGE_SIZE + index + 1} ·{" "}
                          {row.type}
                        </p>
                        <h3 className="mt-1 truncate text-base font-bold text-slate-900">
                          {row.name}
                        </h3>
                        <p className="mt-1 truncate text-sm text-slate-600">
                          Chairperson:{" "}
                          <span className="font-semibold text-slate-800">
                            {row.chairpersonName || "-"}
                          </span>
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 font-mono">
                        {row.code}
                      </Badge>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        Links: {row.totalLinks || 0}
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        className={cn(
                          "rounded-lg border border-border bg-muted/30 p-3 text-left transition-colors",
                          "hover:bg-muted/50",
                        )}
                        onClick={() => goToDepartmentDetail(row, "affiliates")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Affiliates
                          </p>
                          <Users className="h-4 w-4 text-slate-400" />
                        </div>
                        <p className="mt-2 text-2xl font-bold text-slate-900">
                          {row.profileCount}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Admin {row.memberBreakdown?.adminCount || 0} · Editor{" "}
                          {row.memberBreakdown?.editorCount || 0} · Member{" "}
                          {row.memberBreakdown?.memberCount || 0}
                        </p>
                      </button>

                      <button
                        type="button"
                        className={cn(
                          "rounded-lg border border-border bg-muted/30 p-3 text-left transition-colors",
                          "hover:bg-muted/50",
                        )}
                        onClick={() => goToDepartmentDetail(row, "projects")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Projects
                          </p>
                          <FolderKanban className="h-4 w-4 text-slate-400" />
                        </div>
                        <p className="mt-2 text-2xl font-bold text-slate-900">
                          {row.projectCount}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Linked research projects.
                        </p>
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToDepartmentDetail(row)}
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(row)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[var(--danger)] hover:bg-red-50"
                        onClick={() => setDeletingRow(row)}
                      >
                        Delete
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
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-white">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-8 px-0 font-medium hover:bg-transparent ${sortConfig.key === "code" ? "text-slate-900" : "text-muted-foreground"}`}
                        onClick={() => toggleSort("code")}
                      >
                        Code{" "}
                        <span
                          className={
                            sortConfig.key === "code"
                              ? "text-[var(--brand)]"
                              : "text-slate-400"
                          }
                        >
                          {getSortIndicator("code")}
                        </span>
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-8 px-0 font-medium hover:bg-transparent ${sortConfig.key === "name" ? "text-slate-900" : "text-muted-foreground"}`}
                        onClick={() => toggleSort("name")}
                      >
                        Department{" "}
                        <span
                          className={
                            sortConfig.key === "name"
                              ? "text-[var(--brand)]"
                              : "text-slate-400"
                          }
                        >
                          {getSortIndicator("name")}
                        </span>
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-8 px-0 font-medium hover:bg-transparent ${sortConfig.key === "chairpersonName" ? "text-slate-900" : "text-muted-foreground"}`}
                        onClick={() => toggleSort("chairpersonName")}
                      >
                        Chairperson{" "}
                        <span
                          className={
                            sortConfig.key === "chairpersonName"
                              ? "text-[var(--brand)]"
                              : "text-slate-400"
                          }
                        >
                          {getSortIndicator("chairpersonName")}
                        </span>
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-8 px-0 font-medium hover:bg-transparent ${sortConfig.key === "profileCount" ? "text-slate-900" : "text-muted-foreground"}`}
                        onClick={() => toggleSort("profileCount")}
                      >
                        Affiliates{" "}
                        <span
                          className={
                            sortConfig.key === "profileCount"
                              ? "text-[var(--brand)]"
                              : "text-slate-400"
                          }
                        >
                          {getSortIndicator("profileCount")}
                        </span>
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-8 px-0 font-medium hover:bg-transparent ${sortConfig.key === "projectCount" ? "text-slate-900" : "text-muted-foreground"}`}
                        onClick={() => toggleSort("projectCount")}
                      >
                        Projects{" "}
                        <span
                          className={
                            sortConfig.key === "projectCount"
                              ? "text-[var(--brand)]"
                              : "text-slate-400"
                          }
                        >
                          {getSortIndicator("projectCount")}
                        </span>
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
                          className="h-8 px-2 font-semibold text-[var(--brand)] hover:bg-[var(--brand-soft)]"
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
                          className="h-8 px-2 font-semibold text-[var(--brand)] hover:bg-[var(--brand-soft)]"
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
                            className="h-8 w-8"
                            onClick={() => goToDepartmentDetail(row)}
                            aria-label={`View ${row?.name || "department"}`}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => startEdit(row)}
                            aria-label={`Edit ${row?.name || "department"}`}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[var(--danger)] hover:bg-red-50"
                            onClick={() => setDeletingRow(row)}
                            aria-label={`Delete ${row?.name || "department"}`}
                            title="Delete"
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
          )}
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
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Edit Department</DialogTitle>
              <DialogDescription>
                Update all department information.
              </DialogDescription>
            </DialogHeader>

            {editLoading ? (
              <p className="mt-4 text-sm text-slate-600">
                Loading department details...
              </p>
            ) : (
              <>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Department Name *
                    </label>
                    <Input
                      className={editErrors.name ? "input-error" : ""}
                      value={editing.name}
                      onChange={(event) => {
                        setEditing((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }));
                        setEditErrors((prev) => ({ ...prev, name: "" }));
                      }}
                    />
                    {editErrors.name ? (
                      <p className="field-error">{editErrors.name}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Code *
                    </label>
                    <Input
                      className={editErrors.code ? "input-error" : ""}
                      value={editing.code}
                      onChange={(event) => {
                        setEditing((prev) => ({
                          ...prev,
                          code: event.target.value
                            .toUpperCase()
                            .replace(/\s+/g, "_"),
                        }));
                        setEditErrors((prev) => ({ ...prev, code: "" }));
                      }}
                    />
                    {editErrors.code ? (
                      <p className="field-error">{editErrors.code}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Description
                    </label>
                    <Textarea
                      value={editing.description}
                      placeholder="Optional short description about the department..."
                      onChange={(event) =>
                        setEditing((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Chairperson *
                    </label>
                    <Select
                      value={editing.chairpersonId}
                      onValueChange={(value) => {
                        setEditing((prev) => ({
                          ...prev,
                          chairpersonId: value,
                        }));
                        setEditErrors((prev) => ({
                          ...prev,
                          chairpersonId: "",
                        }));
                      }}
                    >
                      <SelectTrigger
                        className={
                          editErrors.chairpersonId ? "input-error" : ""
                        }
                      >
                        <SelectValue placeholder="Select Chairperson" />
                      </SelectTrigger>
                      <SelectContent>
                        {chairpersonUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editErrors.chairpersonId ? (
                      <p className="field-error">{editErrors.chairpersonId}</p>
                    ) : null}
                  </div>
                </div>
              </>
            )}

            <div className="modal-actions mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={cancelEdit}
                disabled={actionLoading}
              >
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
          onOpenChange={(open) => {
            if (!open && !createLoading) {
              setCreateModalOpen(false);
              setCreateErrors({});
            }
          }}
        >
          <DialogContent
            className="max-w-2xl mx-auto"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Create Department</DialogTitle>
              <DialogDescription>
                Add a new department to the department registry.
              </DialogDescription>
              <p className="text-xs text-slate-500">
                Fields marked with <span className="text-red-500">*</span> are
                required.
              </p>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Department Name <span className="text-red-500">*</span>
              </label>
              <Input
                className={createErrors.name ? "input-error" : ""}
                placeholder="e.g. Bachelor of Science in Information System"
                value={newDepartmentName}
                onChange={(event) => {
                  setNewDepartmentName(event.target.value);
                  setCreateErrors((prev) => ({ ...prev, name: "" }));
                }}
                required
              />
              {createErrors.name ? (
                <p className="field-error">{createErrors.name}</p>
              ) : null}
            </div>
            <div className="mt-3 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Code <span className="text-red-500">*</span>
              </label>
              <Input
                className={createErrors.code ? "input-error" : ""}
                placeholder="e.g. BSIS"
                value={newDepartmentCode}
                onChange={(event) => {
                  setNewDepartmentCode(
                    event.target.value.toUpperCase().replace(/\s+/g, "_"),
                  );
                  setCreateErrors((prev) => ({ ...prev, code: "" }));
                }}
                required
              />
              {createErrors.code ? (
                <p className="field-error">{createErrors.code}</p>
              ) : null}
            </div>
            <div className="mt-3 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Description <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={newDepartmentDescription}
                placeholder="Optional short description about the department..."
                onChange={(event) =>
                  setNewDepartmentDescription(event.target.value)
                }
                rows={4}
              />
            </div>
            <div className="mt-3 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Chairperson <span className="text-red-500">*</span>
              </label>
              <Select
                value={newChairpersonId}
                onValueChange={(value) => {
                  setNewChairpersonId(value);
                  setCreateErrors((prev) => ({ ...prev, chairpersonId: "" }));
                }}
              >
                <SelectTrigger
                  className={createErrors.chairpersonId ? "input-error" : ""}
                >
                  <SelectValue placeholder="Select Chairperson" />
                </SelectTrigger>
                <SelectContent>
                  {chairpersonUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createErrors.chairpersonId ? (
                <p className="field-error">{createErrors.chairpersonId}</p>
              ) : null}
            </div>
            <div className="modal-actions mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateModalOpen(false);
                  setCreateErrors({});
                }}
                disabled={createLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={createDepartment}
                disabled={createLoading || !isCreateFormValid}
              >
                {createLoading ? "Creating..." : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
