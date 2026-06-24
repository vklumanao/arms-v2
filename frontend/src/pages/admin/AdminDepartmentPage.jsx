import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Download,
  Eye,
  FolderKanban,
  Link2,
  List,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Card,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";
import { useToast } from "@/components/providers/ToastProvider";
import {
  createReference,
  deleteReference,
  fetchReferenceData,
  fetchReferenceUsageCounts,
  updateReference,
} from "@/services/admin";
import { DepartmentDirectoryPanel } from "./department/components/DepartmentPanels";

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

function buildAssignableChairpersonUsers(
  ckanUsersData,
  departmentsData,
  options = {},
) {
  const allowAssignedIds = new Set(
    (Array.isArray(options.allowAssignedIds) ? options.allowAssignedIds : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );

  const assignedChairpersonIds = new Set(
    (Array.isArray(departmentsData) ? departmentsData : [])
      .map((department) => String(department?.chairperson_id || "").trim())
      .filter(Boolean),
  );

  return (Array.isArray(ckanUsersData) ? ckanUsersData : [])
    .filter((item) => {
      const userId = String(item?.id || "").trim();
      const isFaculty = String(item?.role || "").toLowerCase() === "faculty";
      const isDeleted = String(item?.state || "").toLowerCase() === "deleted";
      const isAssignedElsewhere =
        assignedChairpersonIds.has(userId) && !allowAssignedIds.has(userId);
      return userId && isFaculty && !isDeleted && !isAssignedElsewhere;
    })
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
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function AdminDepartmentPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const PAGE_SIZE = 10;
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [quickFilter, setQuickFilter] = useState("all");
  const [rows, setRows] = useState([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(null);
  const [mobileDirectoryOpen, setMobileDirectoryOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState(EMPTY_EDITING);
  const [editLoading, setEditLoading] = useState(false);
  const [deletingRow, setDeletingRow] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
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
  const [createErrors, setCreateErrors] = useState({});
  const [editErrors, setEditErrors] = useState({});

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
      const departmentsData = referencePayload?.departmentsRes?.data || [];
      const ckanUsersData = referencePayload?.ckanUsersRes?.data || [];

      const usageByDepartment = await Promise.all(
        departmentsData.map(async (department) => {
          const departmentId = department?.id;
          try {
            const usage = await fetchReferenceUsageCounts({
              type: "department",
              id: departmentId,
            });
            return {
              id: departmentId,
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
              id: departmentId,
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
        usageByDepartment.map((item) => [item.id, item]),
      );

      const mapped = departmentsData
        .map((item) => {
          const departmentId = item.id;
          const chairpersonId = String(item?.chairperson_id || "").trim();
          const chairpersonName =
            String(item?.chairperson_name || "").trim() ||
            ckanUsersData.find(
              (user) => String(user?.id || "").trim() === chairpersonId,
            )?.name ||
            "";

          return {
            id: departmentId,
            code:
              String(item?.code || "").trim() || String(departmentId || "-"),
            name: item.title || item.display_name || item.name || "-",
            description: String(item?.description || "").trim(),
            socialMediaLink: String(item?.social_media_link || "").trim(),
            type: "Department",
            tag: "department",
            chairpersonId,
            chairpersonName: chairpersonName || "-",
            projectCount: usageMap[departmentId]?.projectCount || 0,
            profileCount: usageMap[departmentId]?.profileCount || 0,
            memberBreakdown: usageMap[departmentId]?.memberBreakdown || {
              adminCount: 0,
              editorCount: 0,
              memberCount: 0,
              totalCount: 0,
            },
            totalLinks:
              (usageMap[departmentId]?.projectCount || 0) +
              (usageMap[departmentId]?.profileCount || 0),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      setRows(mapped);
      setChairpersonUsers(
        buildAssignableChairpersonUsers(ckanUsersData, departmentsData),
      );
      setSelectedDepartmentId((prev) =>
        mapped.some((item) => item.id === prev)
          ? prev
          : (mapped[0]?.id ?? null),
      );
    } catch (loadError) {
      setRows([]);
      setChairpersonUsers([]);
      setSelectedDepartmentId(null);
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
      ) {
        return false;
      }
      if (
        quickFilter === "with_affiliates" &&
        Number(row?.profileCount || 0) === 0
      ) {
        return false;
      }
      if (quickFilter === "with_links" && Number(row?.totalLinks || 0) === 0) {
        return false;
      }
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

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, quickFilter, rows.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!filteredRows.length) {
      setSelectedDepartmentId(null);
      return;
    }
    if (!filteredRows.some((row) => row.id === selectedDepartmentId)) {
      setSelectedDepartmentId(filteredRows[0].id);
    }
  }, [filteredRows, selectedDepartmentId]);

  const workspaceDepartmentRow = useMemo(
    () =>
      filteredRows.find((row) => row.id === selectedDepartmentId) ||
      rows.find((row) => row.id === selectedDepartmentId) ||
      null,
    [filteredRows, rows, selectedDepartmentId],
  );

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
  const editChairpersonUsers = useMemo(() => {
    const currentChairpersonId = String(editing.chairpersonId || "").trim();
    if (!currentChairpersonId) return chairpersonUsers;
    if (chairpersonUsers.some((user) => user.id === currentChairpersonId)) {
      return chairpersonUsers;
    }

    const currentRow = rows.find(
      (row) => String(row?.chairpersonId || "").trim() === currentChairpersonId,
    );
    if (!currentRow) return chairpersonUsers;

    return [
      ...chairpersonUsers,
      {
        id: currentChairpersonId,
        name: currentRow.chairpersonName || "Unnamed Faculty User",
      },
    ].sort((a, b) => a.name.localeCompare(b.name));
  }, [chairpersonUsers, editing.chairpersonId, rows]);

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
      <div className="rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 sm:py-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Admin Workspace
            </p>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Departments
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Manage department records, chairperson assignments, and linked
                workspace details from a single view.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={exporting || filteredRows.length === 0}
                  className="min-h-10 w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 sm:w-auto"
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
                  onSelect={() => exportRowsAsCsv(filteredRows, "filtered")}
                >
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-slate-700 hover:bg-slate-50 focus:bg-slate-50"
                  onSelect={() => exportRowsAsPdf(filteredRows, "filtered")}
                >
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="mono"
              className="min-h-10 w-full sm:w-auto"
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

      <div className="xl:hidden">
        <Button
          type="button"
          variant="outline"
          className="min-h-10 w-full justify-start border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          onClick={() => setMobileDirectoryOpen(true)}
        >
          <List className="h-4 w-4" />
          {workspaceDepartmentRow?.name
            ? `Change Department: ${workspaceDepartmentRow.name}`
            : "Select Department"}
        </Button>
      </div>

      <div className={cn("grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]")}>
        <div className="hidden xl:block">
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Directory</p>
              <p className="mt-1 text-xs text-slate-500">
                Browse and switch between departments.
              </p>
            </div>
            <DepartmentDirectoryPanel
              rows={filteredRows}
              paginatedRows={paginatedRows}
              filters={filters}
              onSearchChange={(search) => setFilters({ search })}
              quickFilter={quickFilter}
              onQuickFilterChange={setQuickFilter}
              onResetFilters={() => {
                setQuickFilter("all");
                setFilters(INITIAL_FILTERS);
              }}
              quickFilterChips={quickFilterChips}
              selectedDepartmentId={workspaceDepartmentRow?.id}
              onSelectDepartment={setSelectedDepartmentId}
              metrics={dashboardMetrics}
              dataLoading={dataLoading}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              embedded
            />
          </div>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-5 px-4 py-4 sm:px-5 sm:py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Selected Department
                  </p>
                  <CardTitle className="text-xl font-bold uppercase text-slate-900 sm:text-3xl">
                    {workspaceDepartmentRow?.name || "Select a Department"}
                  </CardTitle>
                  {workspaceDepartmentRow ? (
                    <p className="pb-1 text-sm text-slate-500">
                      {workspaceDepartmentRow.code || "No Code"}
                    </p>
                  ) : null}
                  <CardDescription className="max-auto text-sm leading-6 text-slate-600">
                    {workspaceDepartmentRow
                      ? workspaceDepartmentRow.description ||
                        "No description has been added for this department yet."
                      : "Choose a department from the directory to load its workspace."}
                  </CardDescription>
                  {workspaceDepartmentRow ? (
                    <p className="pt-1 text-sm text-slate-600">
                      Chairperson:{" "}
                      <span className="font-medium text-slate-900">
                        {workspaceDepartmentRow.chairpersonName || "-"}
                      </span>
                    </p>
                  ) : null}
                </div>

                {workspaceDepartmentRow ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      className="min-h-10 border-slate-300 text-slate-700 hover:bg-slate-50"
                      onClick={() =>
                        goToDepartmentDetail(workspaceDepartmentRow)
                      }
                    >
                      <Eye className="h-4 w-4" />
                      Open Department
                    </Button>
                  </div>
                ) : null}
              </div>

              {!workspaceDepartmentRow ? (
                <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center">
                  <Building2 className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-3 text-base font-medium text-slate-900">
                    Select a department
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose a department from the directory to view its details,
                    affiliates, projects, and workspace links.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4 text-left hover:bg-slate-100"
                    onClick={() =>
                      goToDepartmentDetail(workspaceDepartmentRow, "projects")
                    }
                  >
                    <div className="flex items-center gap-2 text-slate-500">
                      <FolderKanban className="h-4 w-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                        Projects
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {workspaceDepartmentRow.projectCount || 0}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4 text-left hover:bg-slate-100"
                    onClick={() =>
                      goToDepartmentDetail(workspaceDepartmentRow, "affiliates")
                    }
                  >
                    <div className="flex items-center gap-2 text-slate-500">
                      <Users className="h-4 w-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                        Affiliates
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {workspaceDepartmentRow.profileCount || 0}
                    </p>
                  </button>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Link2 className="h-4 w-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                        Total Links
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {workspaceDepartmentRow.totalLinks || 0}
                    </p>
                  </div>
                </div>
              )}
            </CardHeader>
          </Card>
        </div>
      </div>

      <Sheet open={mobileDirectoryOpen} onOpenChange={setMobileDirectoryOpen}>
        <SheetContent
          side="left"
          className="w-[92vw] max-w-none overflow-y-auto border-r border-slate-300 bg-white p-3 sm:max-w-lg"
        >
          <SheetHeader className="px-2 pb-2">
            <SheetTitle className="text-slate-700">
              Select Department
            </SheetTitle>
            <SheetDescription>
              Search and pin a department to open its workspace.
            </SheetDescription>
          </SheetHeader>
          <DepartmentDirectoryPanel
            rows={filteredRows}
            paginatedRows={paginatedRows}
            filters={filters}
            onSearchChange={(search) => setFilters({ search })}
            quickFilter={quickFilter}
            onQuickFilterChange={setQuickFilter}
            onResetFilters={() => {
              setQuickFilter("all");
              setFilters(INITIAL_FILTERS);
            }}
            quickFilterChips={quickFilterChips}
            selectedDepartmentId={workspaceDepartmentRow?.id}
            onSelectDepartment={(departmentId) => {
              setSelectedDepartmentId(departmentId);
              setMobileDirectoryOpen(false);
            }}
            metrics={dashboardMetrics}
            dataLoading={dataLoading}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            embedded
          />
        </SheetContent>
      </Sheet>

      <ConfirmActionModal
        open={Boolean(deletingRow)}
        title={
          <span className="text-base font-semibold text-slate-700">
            Delete Department
          </span>
        }
        message={
          <p className="text-sm leading-relaxed text-slate-600">
            {deleteGuard.message}
          </p>
        }
        confirmLabel={deleteGuard.confirmLabel}
        align="center"
        loading={deleteGuard.blocked ? false : actionLoading}
        onCancel={() => setDeletingRow(null)}
        onConfirm={
          deleteGuard.blocked ? () => setDeletingRow(null) : confirmDelete
        }
        className="border border-slate-300 bg-white text-slate-700 shadow-md"
        cancelButtonClassName="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100"
        confirmButtonClassName={
          deleteGuard.blocked
            ? "bg-[#10B981] text-white hover:bg-[#059669] active:bg-[#047857] disabled:bg-slate-300 disabled:text-slate-500"
            : "bg-[#F97316] text-white hover:bg-[#EA580C] active:bg-[#C2410C] disabled:bg-slate-300 disabled:text-slate-500"
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
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Department Name *
                  </label>
                  <Input
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
                    <p className="text-xs text-rose-600">{editErrors.name}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Code *
                  </label>
                  <Input
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
                    <p className="text-xs text-rose-600">{editErrors.code}</p>
                  ) : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Description
                  </label>
                  <Textarea
                    value={editing.description}
                    onChange={(event) =>
                      setEditing((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Social Media Link
                  </label>
                  <Input
                    value={editing.socialMediaLink}
                    onChange={(event) =>
                      setEditing((prev) => ({
                        ...prev,
                        socialMediaLink: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Chairperson *
                  </label>
                  <Select
                    value={editing.chairpersonId}
                    onValueChange={(value) => {
                      setEditing((prev) => ({ ...prev, chairpersonId: value }));
                      setEditErrors((prev) => ({
                        ...prev,
                        chairpersonId: "",
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Chairperson" />
                    </SelectTrigger>
                    <SelectContent>
                      {editChairpersonUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editErrors.chairpersonId ? (
                    <p className="text-xs text-rose-600">
                      {editErrors.chairpersonId}
                    </p>
                  ) : null}
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
          <DialogContent
            className="w-full max-auto max-w-3xl"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
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
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Department Name *
                    </label>
                    <Input
                      className="w-full"
                      placeholder="e.g. Bachelor of Science in Information System"
                      value={newDepartmentName}
                      onChange={(event) =>
                        setNewDepartmentName(event.target.value)
                      }
                    />
                    {createErrors.name ? (
                      <p className="text-xs text-rose-600">
                        {createErrors.name}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Code *
                    </label>
                    <Input
                      className="w-full"
                      placeholder="e.g. BSIS"
                      value={newDepartmentCode}
                      onChange={(event) =>
                        setNewDepartmentCode(
                          event.target.value.toUpperCase().replace(/\s+/g, "_"),
                        )
                      }
                    />
                    <p className="text-xs text-slate-400">
                      Use uppercase abbreviation.
                    </p>
                    {createErrors.code ? (
                      <p className="text-xs text-rose-600">
                        {createErrors.code}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
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
                        {chairpersonUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {createErrors.chairpersonId ? (
                      <p className="text-xs text-rose-600">
                        {createErrors.chairpersonId}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Description
                    </label>
                    <Textarea
                      className="w-full"
                      placeholder="Short description about the department..."
                      value={newDepartmentDescription}
                      onChange={(event) =>
                        setNewDepartmentDescription(event.target.value)
                      }
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Social Media Link
                    </label>
                    <Input
                      className="w-full"
                      placeholder="https://..."
                      value={newDepartmentSocialMediaLink}
                      onChange={(event) =>
                        setNewDepartmentSocialMediaLink(event.target.value)
                      }
                    />
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
