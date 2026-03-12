import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  FolderKanban,
  LayoutGrid,
  Link2,
  List,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import PageHeader from "@/shared/components/layout/PageHeader";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";
import PaginationControls from "@/shared/components/navigation/PaginationControls";
import { useToast } from "@/app/providers/ToastProvider";
import {
  deleteReference,
  createReference,
  fetchReferenceData,
  fetchReferenceLinks,
  fetchReferenceUsageCounts,
  updateReference,
} from "@/features/admin/services";

const INITIAL_FILTERS = {
  search: "",
  code: "",
  linkedAffiliates: "all",
  linkedProjects: "all",
  linkageState: "all",
};
const EMPTY_EDITING = {
  id: null,
  name: "",
  code: "",
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
  const toast = useToast();
  const PAGE_SIZE = 10;
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [rows, setRows] = useState([]);
  const [viewRow, setViewRow] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState(EMPTY_EDITING);
  const [editLoading, setEditLoading] = useState(false);
  const [deletingRow, setDeletingRow] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");
  const [viewProfiles, setViewProfiles] = useState([]);
  const [projectLinksRow, setProjectLinksRow] = useState(null);
  const [projectLinksLoading, setProjectLinksLoading] = useState(false);
  const [projectLinksError, setProjectLinksError] = useState("");
  const [projectLinks, setProjectLinks] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState("grid");
  const [exporting, setExporting] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newDepartmentCode, setNewDepartmentCode] = useState("");
  const [newChairpersonId, setNewChairpersonId] = useState("");
  const [chairpersonUsers, setChairpersonUsers] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
  });
  const [editErrors, setEditErrors] = useState({});
  const [createErrors, setCreateErrors] = useState({});
  const viewModalRef = useRef(null);
  const projectModalRef = useRef(null);
  const editModalRef = useRef(null);
  const createModalRef = useRef(null);
  const lastFocusedElementRef = useRef(null);
  const modalLockScrollYRef = useRef(0);

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
    const codeKeyword = filters.code.trim().toLowerCase();

    return rows.filter((row) => {
      if (
        keyword &&
        !(
          row.name.toLowerCase().includes(keyword) ||
          row.code.toLowerCase().includes(keyword) ||
          row.type.toLowerCase().includes(keyword) ||
          row.id.toLowerCase().includes(keyword)
        )
      ) {
        return false;
      }

      if (codeKeyword && !row.code.toLowerCase().includes(codeKeyword)) {
        return false;
      }

      if (filters.linkedAffiliates === "with" && row.profileCount <= 0) {
        return false;
      }
      if (filters.linkedAffiliates === "without" && row.profileCount > 0) {
        return false;
      }

      if (filters.linkedProjects === "with" && row.projectCount <= 0) {
        return false;
      }
      if (filters.linkedProjects === "without" && row.projectCount > 0) {
        return false;
      }

      if (filters.linkageState === "active" && row.totalLinks <= 0) {
        return false;
      }
      if (filters.linkageState === "idle" && row.totalLinks > 0) {
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

  const stats = useMemo(
    () => ({
      total: rows.length,
      linkedAffiliates: rows.reduce(
        (total, row) => total + (row.profileCount || 0),
        0,
      ),
      linkedProjects: rows.reduce(
        (total, row) => total + (row.projectCount || 0),
        0,
      ),
      activeDepartments: rows.filter((row) => row.totalLinks > 0).length,
    }),
    [rows],
  );

  const activeModalRef = createModalOpen
    ? createModalRef
    : editModalOpen
      ? editModalRef
      : projectLinksRow
        ? projectModalRef
        : viewRow
          ? viewModalRef
          : null;
  const hasAnyModal = Boolean(
    viewRow || projectLinksRow || editModalOpen || createModalOpen,
  );

  useEffect(() => {
    if (hasAnyModal) {
      modalLockScrollYRef.current = window.scrollY || window.pageYOffset || 0;
      document.body.style.position = "fixed";
      document.body.style.top = `-${modalLockScrollYRef.current}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      lastFocusedElementRef.current = document.activeElement;
      const firstFocusable = activeModalRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (firstFocusable instanceof HTMLElement) {
        firstFocusable.focus();
      }
      return () => {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        window.scrollTo(0, modalLockScrollYRef.current || 0);
      };
    }

    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.overflow = "";
    if (lastFocusedElementRef.current instanceof HTMLElement) {
      lastFocusedElementRef.current.focus();
    }
  }, [activeModalRef, hasAnyModal]);

  useEffect(() => {
    if (!hasAnyModal) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (createModalOpen && !createLoading) {
          setCreateModalOpen(false);
          setCreateErrors({});
          return;
        }
        if (editModalOpen && !actionLoading) {
          setEditModalOpen(false);
          setEditErrors({});
          setEditing(EMPTY_EDITING);
          return;
        }
        if (projectLinksRow) {
          setProjectLinksRow(null);
          return;
        }
        if (viewRow) {
          setViewRow(null);
        }
      }

      if (event.key !== "Tab" || !activeModalRef?.current) return;
      const focusableElements = activeModalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusableElements.length) return;
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeModalRef,
    actionLoading,
    createLoading,
    createModalOpen,
    editModalOpen,
    hasAnyModal,
    projectLinksRow,
    viewRow,
  ]);

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

  const openView = async (row) => {
    setViewRow(row);
    setViewLoading(true);
    setViewError("");
    setViewProfiles([]);
    try {
      const result = await fetchReferenceLinks({
        type: "department",
        id: row.id,
      });
      setViewProfiles(result?.profiles || []);
    } catch (loadError) {
      setViewError(loadError.message || "Unable to load linked profiles.");
    } finally {
      setViewLoading(false);
    }
  };

  const openProjectLinks = async (row) => {
    setProjectLinksRow(row);
    setProjectLinksLoading(true);
    setProjectLinksError("");
    setProjectLinks([]);
    try {
      const result = await fetchReferenceLinks({
        type: "department",
        id: row.id,
      });
      setProjectLinks(result?.projects || []);
    } catch (loadError) {
      setProjectLinksError(
        loadError.message || "Unable to load linked projects.",
      );
    } finally {
      setProjectLinksLoading(false);
    }
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

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Department"
        description="Manage departments and inspect linked affiliates, members, and projects in one view."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <Building2 size={14} />
            Total Departments
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {stats.total}
          </p>
        </article>
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <Users size={14} />
            Linked Affiliates
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {stats.linkedAffiliates}
          </p>
        </article>
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <FolderKanban size={14} />
            Linked Projects
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {stats.linkedProjects}
          </p>
        </article>
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <Link2 size={14} />
            Active Departments
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {stats.activeDepartments}
          </p>
        </article>
      </div>

      <div className="panel">
        <div className="panel-header flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
          <SlidersHorizontal size={14} />
          Filters
        </div>
        <div className="panel-body grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="control-input pl-8"
              placeholder="Search name, code, or id"
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, search: event.target.value }))
              }
            />
          </label>
          <input
            className="control-input"
            placeholder="Department code"
            value={filters.code}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, code: event.target.value }))
            }
          />
          <select
            className="control-select"
            value={filters.linkedAffiliates}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                linkedAffiliates: event.target.value,
              }))
            }
          >
            <option value="all">All affiliate linkage</option>
            <option value="with">With affiliates</option>
            <option value="without">Without affiliates</option>
          </select>
          <select
            className="control-select"
            value={filters.linkedProjects}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                linkedProjects: event.target.value,
              }))
            }
          >
            <option value="all">All project linkage</option>
            <option value="with">With projects</option>
            <option value="without">Without projects</option>
          </select>
          <div className="flex gap-2">
            <select
              className="control-select"
              value={filters.linkageState}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  linkageState: event.target.value,
                }))
              }
            >
              <option value="all">All department states</option>
              <option value="active">Active links</option>
              <option value="idle">No links</option>
            </select>
            <button
              className="btn btn-outline"
              onClick={() => setFilters(INITIAL_FILTERS)}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
            Department Records ({filteredRows.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-lg bg-[var(--surface-muted)] p-1">
              <button
                className={`btn ${viewMode === "grid" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setViewMode("grid")}
                type="button"
              >
                <LayoutGrid size={14} />
                Grid
              </button>
              <button
                className={`btn ${viewMode === "list" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setViewMode("list")}
                type="button"
              >
                <List size={14} />
                List
              </button>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                setCreateErrors({});
                setCreateModalOpen(true);
              }}
            >
              Create Department
            </button>
            <button
              className="btn btn-outline"
              onClick={() => exportRowsAsCsv(sortedFilteredRows, "filtered")}
              disabled={exporting || filteredRows.length === 0}
            >
              Export CSV
            </button>
            <button
              className="btn btn-outline"
              onClick={() => exportRowsAsPdf(sortedFilteredRows, "filtered")}
              disabled={exporting || filteredRows.length === 0}
            >
              Export PDF
            </button>
          </div>
        </div>
        <div className="p-2">
          {!dataLoading && filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-sm text-slate-600">
              No department records found.
            </div>
          ) : null}
          {viewMode === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {paginatedRows.map((row, index) => (
                <article
                  key={`${row.tag}-${row.id}`}
                  className="metric-card transition hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        #{(currentPage - 1) * PAGE_SIZE + index + 1} |{" "}
                        {row.type}
                      </p>
                      <h3 className="mt-1 text-base font-bold text-slate-900">
                        {row.name}
                      </h3>
                    </div>
                    <span className="status-chip status-ongoing">
                      {row.code}
                    </span>
                  </div>

                  <div className="mb-2 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1">
                      Chairperson: {row.chairpersonName || "-"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="app-card-muted app-card-micro text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--brand-soft)]"
                      onClick={() => openView(row)}
                    >
                      <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">
                        Linked Affiliates
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {row.profileCount}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        Admin: {row.memberBreakdown?.adminCount || 0} Editor:{" "}
                        {row.memberBreakdown?.editorCount || 0} Member:{" "}
                        {row.memberBreakdown?.memberCount || 0}
                      </p>
                    </button>
                    <button
                      type="button"
                      className="app-card-muted app-card-micro text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--brand-soft)]"
                      onClick={() => openProjectLinks(row)}
                    >
                      <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">
                        Linked Projects
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {row.projectCount}
                      </p>
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="btn btn-outline"
                      onClick={() => startEdit(row)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-outline text-[var(--danger)] hover:bg-red-50"
                      onClick={() => setDeletingRow(row)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <div className="min-w-0">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>
                        <button
                          type="button"
                          className={`table-sort-btn ${sortConfig.key === "code" ? "active" : ""}`}
                          onClick={() => toggleSort("code")}
                        >
                          Code <span>{getSortIndicator("code")}</span>
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          className={`table-sort-btn ${sortConfig.key === "name" ? "active" : ""}`}
                          onClick={() => toggleSort("name")}
                        >
                          Department <span>{getSortIndicator("name")}</span>
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          className={`table-sort-btn ${sortConfig.key === "chairpersonName" ? "active" : ""}`}
                          onClick={() => toggleSort("chairpersonName")}
                        >
                          Chairperson{" "}
                          <span>{getSortIndicator("chairpersonName")}</span>
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          className={`table-sort-btn ${sortConfig.key === "profileCount" ? "active" : ""}`}
                          onClick={() => toggleSort("profileCount")}
                        >
                          Affiliates{" "}
                          <span>{getSortIndicator("profileCount")}</span>
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          className={`table-sort-btn ${sortConfig.key === "projectCount" ? "active" : ""}`}
                          onClick={() => toggleSort("projectCount")}
                        >
                          Projects{" "}
                          <span>{getSortIndicator("projectCount")}</span>
                        </button>
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row, index) => (
                      <tr key={`${row.tag}-${row.id}`}>
                        <td>{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                        <td>{row.code}</td>
                        <td>{row.name}</td>
                        <td>{row.chairpersonName || "-"}</td>
                        <td>
                          <button
                            type="button"
                            className="rounded-md px-2 py-1 font-semibold text-[var(--brand)] hover:bg-[var(--brand-soft)]"
                            onClick={() => openView(row)}
                          >
                            {row.profileCount}
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="rounded-md px-2 py-1 font-semibold text-[var(--brand)] hover:bg-[var(--brand-soft)]"
                            onClick={() => openProjectLinks(row)}
                          >
                            {row.projectCount}
                          </button>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="btn btn-outline"
                              onClick={() => startEdit(row)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-outline text-[var(--danger)] hover:bg-red-50"
                              onClick={() => setDeletingRow(row)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <PaginationControls
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          className="rounded-none border-0 border-t border-[var(--border)]"
        />
      </div>

      {viewRow ? (
        <div
          className="modal-overlay modal-overlay-centered"
          onClick={() => setViewRow(null)}
        >
          <aside
            className="modal-dialog modal-dialog-3xl min-h-[82vh]"
            ref={viewModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-center-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                  Department Details
                </p>
                <h3
                  id="view-center-title"
                  className="text-xl font-black text-slate-900"
                >
                  {viewRow.name}
                </h3>
              </div>
              <button
                className="btn btn-outline"
                onClick={() => setViewRow(null)}
              >
                Close
              </button>
            </div>
            <dl className="grid gap-3 text-sm md:grid-cols-4">
              <div className="app-card-muted app-card-compact">
                <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Department Code
                </dt>
                <dd className="mt-1 font-semibold text-slate-800">
                  {viewRow.code}
                </dd>
              </div>
              <div className="app-card-muted app-card-compact">
                <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Type
                </dt>
                <dd className="mt-1 font-semibold text-slate-800">
                  {viewRow.type}
                </dd>
              </div>
              <div className="app-card-muted app-card-compact">
                <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Chairperson
                </dt>
                <dd className="mt-1 font-semibold text-slate-800">
                  {viewRow.chairpersonName || "-"}
                </dd>
              </div>
              <div className="app-card-muted app-card-compact">
                <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Linked Affiliates
                </dt>
                <dd className="mt-1 font-semibold text-slate-800">
                  {viewRow.profileCount || 0}
                </dd>
              </div>
              <div className="app-card-muted app-card-compact">
                <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Linked Projects
                </dt>
                <dd className="mt-1 font-semibold text-slate-800">
                  {viewRow.projectCount || 0}
                </dd>
              </div>
            </dl>
            <div className="mt-5 overflow-hidden rounded-xl border border-[var(--border)]">
              <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600">
                  Linked Affiliates ({viewProfiles.length})
                </p>
              </div>
              <div className="max-h-80 overflow-auto">
                {viewLoading ? (
                  <p className="p-4 text-sm text-slate-600">
                    Loading linked records...
                  </p>
                ) : viewError ? (
                  <p className="p-4 text-sm text-red-700">{viewError}</p>
                ) : viewProfiles.length === 0 ? (
                  <p className="p-4 text-sm text-slate-600">
                    No affiliates are currently linked to this department.
                  </p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Full Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Department</th>
                        <th>Status</th>
                        <th>User ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewProfiles.map((profile, index) => (
                        <tr key={profile.id}>
                          <td>{index + 1}</td>
                          <td>{profile.full_name || "Unnamed user"}</td>
                          <td>{profile.email || "-"}</td>
                          <td className="capitalize">{profile.role || "-"}</td>
                          <td>{profile.department || "-"}</td>
                          <td>
                            <span
                              className={`status-chip ${
                                profile.is_active
                                  ? "status-completed"
                                  : "status-rejected"
                              }`}
                            >
                              {profile.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td>
                            <code>{profile.id}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {projectLinksRow ? (
        <div
          className="modal-overlay modal-overlay-centered"
          onClick={() => setProjectLinksRow(null)}
        >
          <aside
            className="modal-dialog modal-dialog-3xl min-h-[82vh]"
            ref={projectModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="linked-projects-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                  Linked Projects
                </p>
                <h3
                  id="linked-projects-title"
                  className="text-xl font-black text-slate-900"
                >
                  {projectLinksRow.name}
                </h3>
              </div>
              <button
                className="btn btn-outline"
                onClick={() => setProjectLinksRow(null)}
              >
                Close
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-[var(--border)]">
              <div className="max-h-[560px] overflow-auto">
                {projectLinksLoading ? (
                  <p className="p-4 text-sm text-slate-600">
                    Loading linked projects...
                  </p>
                ) : projectLinksError ? (
                  <p className="p-4 text-sm text-red-700">
                    {projectLinksError}
                  </p>
                ) : projectLinks.length === 0 ? (
                  <p className="p-4 text-sm text-slate-600">
                    No linked projects found for this department.
                  </p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Project Title</th>
                        <th>Status</th>
                        <th>Year</th>
                        <th>Lead Researcher</th>
                        <th>Department</th>
                        <th>Research Agenda</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectLinks.map((project, index) => (
                        <tr key={project.id}>
                          <td>{index + 1}</td>
                          <td>{project.title || "-"}</td>
                          <td className="capitalize">
                            {project.status || "-"}
                          </td>
                          <td>{project.year || "-"}</td>
                          <td>{project.lead_researcher || "-"}</td>
                          <td>{project.department_name || "-"}</td>
                          <td>{project.agenda_name || "-"}</td>
                          <td>
                            {project.start_date
                              ? new Date(
                                  project.start_date,
                                ).toLocaleDateString()
                              : "-"}
                          </td>
                          <td>
                            {project.end_date
                              ? new Date(project.end_date).toLocaleDateString()
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <ConfirmActionModal
        open={Boolean(deletingRow)}
        title="Delete Department"
        message={`Delete "${deletingRow?.name || ""}"? This action cannot be undone.`}
        confirmLabel="Delete"
        align="center"
        loading={actionLoading}
        onCancel={() => setDeletingRow(null)}
        onConfirm={confirmDelete}
      />

      {editModalOpen ? (
        <div
          className="modal-overlay modal-overlay-centered"
          onClick={cancelEdit}
        >
          <div
            className="modal-dialog modal-dialog-lg"
            ref={editModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-center-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="edit-center-title"
              className="modal-title text-xl font-bold text-slate-900"
            >
              Edit Department
            </h3>
            <p className="modal-subtitle mt-1 text-sm text-slate-600">
              Update all department information.
            </p>

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
                    <input
                      className={`control-input ${editErrors.name ? "input-error" : ""}`}
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
                    <input
                      className={`control-input ${editErrors.code ? "input-error" : ""}`}
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
                      Chairperson *
                    </label>
                    <select
                      className={`control-select ${editErrors.chairpersonId ? "input-error" : ""}`}
                      value={editing.chairpersonId}
                      onChange={(event) => {
                        setEditing((prev) => ({
                          ...prev,
                          chairpersonId: event.target.value,
                        }));
                        setEditErrors((prev) => ({ ...prev, chairpersonId: "" }));
                      }}
                    >
                      <option value="">Select Chairperson</option>
                      {chairpersonUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                    {editErrors.chairpersonId ? (
                      <p className="field-error">{editErrors.chairpersonId}</p>
                    ) : null}
                  </div>
                </div>
              </>
            )}

            <div className="modal-actions mt-6 flex justify-end gap-2">
              <button
                className="btn btn-outline"
                onClick={cancelEdit}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={saveEdit}
                disabled={actionLoading || editLoading || !isEditFormValid}
              >
                {actionLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createModalOpen ? (
        <div
          className="modal-overlay modal-overlay-centered"
          onClick={() => {
            if (!createLoading) {
              setCreateModalOpen(false);
              setCreateErrors({});
            }
          }}
        >
          <div
            className="modal-dialog modal-dialog-md"
            ref={createModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-center-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="create-center-title"
              className="modal-title text-lg font-bold text-slate-900"
            >
              Create Department
            </h3>
            <p className="modal-subtitle mt-1 text-sm text-slate-600">
              Add a new department to the department registry.
            </p>
            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Department Name *
              </label>
              <input
                className={`control-input ${createErrors.name ? "input-error" : ""}`}
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
                Code *
              </label>
              <input
                className={`control-input ${createErrors.code ? "input-error" : ""}`}
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
                Chairperson *
              </label>
              <select
                className={`control-select ${createErrors.chairpersonId ? "input-error" : ""}`}
                value={newChairpersonId}
                onChange={(event) => {
                  setNewChairpersonId(event.target.value);
                  setCreateErrors((prev) => ({ ...prev, chairpersonId: "" }));
                }}
              >
                <option value="">Select Chairperson</option>
                {chairpersonUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              {createErrors.chairpersonId ? (
                <p className="field-error">{createErrors.chairpersonId}</p>
              ) : null}
            </div>
            <div className="modal-actions mt-5 flex justify-end gap-2">
              <button
                className="btn btn-outline"
                onClick={() => {
                  setCreateModalOpen(false);
                  setCreateErrors({});
                }}
                disabled={createLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={createDepartment}
                disabled={createLoading || !isCreateFormValid}
              >
                {createLoading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
