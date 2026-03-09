import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GraduationCap,
  Search,
  SlidersHorizontal,
  UserCheck,
  UserRound,
  UserX,
  Users,
} from "lucide-react";
import PageHeader from "@/shared/components/layout/PageHeader";
import EmptyState from "@/shared/components/feedback/EmptyState";
import PaginationControls from "@/shared/components/navigation/PaginationControls";
import { useToast } from "@/app/providers/ToastProvider";
import { fetchCkanDatasets } from "@/shared/api/ckanApi";
import {
  buildAffiliateAnalytics,
  buildAffiliateExportRows,
  buildCenterNameById,
  createAffiliateEditForm,
  createAffiliateModuleFilters,
  filterAffiliateRelatedDatasets,
  filterAndSortAffiliates,
  listAffiliateDepartments,
  paginateItemsWithMeta,
} from "@/features/admin/utils";
import {
  fetchAffiliateRegistry,
  updateAffiliateProfile,
} from "@/features/admin/services";

export default function AdminAffiliatesModulePage() {
  const PAGE_SIZE = 10;
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState([]);
  const [centers, setCenters] = useState([]);
  const [filters, setFilters] = useState(createAffiliateModuleFilters());
  const [viewAffiliateId, setViewAffiliateId] = useState(null);
  const [exportingType, setExportingType] = useState("");
  const [editingAffiliate, setEditingAffiliate] = useState(null);
  const [editForm, setEditForm] = useState(createAffiliateEditForm({}));
  const [savingEdit, setSavingEdit] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [affiliateProjectsPanel, setAffiliateProjectsPanel] = useState({
    loading: false,
    error: "",
    rows: [],
  });
  const toast = useToast();

  useEffect(() => {
    if (error) toast.error("Load failed", error);
  }, [error, toast]);

  useEffect(() => {
    if (message) toast.success("Action completed", message);
  }, [message, toast]);

  const loadData = useCallback(async () => {
    setError("");
    setMessage("");
    try {
      const payload = await fetchAffiliateRegistry();
      setRows(payload?.rows || []);
      setCenters(payload?.centers || []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load affiliate data.");
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

  const analytics = useMemo(() => buildAffiliateAnalytics(rows), [rows]);

  const departments = useMemo(() => listAffiliateDepartments(rows), [rows]);

  const filteredRows = useMemo(
    () => filterAndSortAffiliates(rows, filters),
    [rows, filters],
  );

  const pagination = useMemo(
    () => paginateItemsWithMeta(filteredRows, currentPage, PAGE_SIZE),
    [filteredRows, currentPage],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, pagination.totalPages));
  }, [pagination.totalPages]);

  const selectedAffiliate = useMemo(
    () => filteredRows.find((row) => row.id === viewAffiliateId) || null,
    [filteredRows, viewAffiliateId],
  );

  useEffect(() => {
    if (!selectedAffiliate?.id) {
      setAffiliateProjectsPanel({
        loading: false,
        error: "",
        rows: [],
      });
      return;
    }

    let cancelled = false;
    setAffiliateProjectsPanel({
      loading: true,
      error: "",
      rows: [],
    });

    fetchCkanDatasets({ limit: 200 })
      .then((payload) => {
        if (cancelled) return;
        const datasets = Array.isArray(payload?.data) ? payload.data : [];
        const filtered = filterAffiliateRelatedDatasets(
          datasets,
          selectedAffiliate,
        );

        setAffiliateProjectsPanel({
          loading: false,
          error: "",
          rows: filtered,
        });
      })
      .catch((loadError) => {
        if (cancelled) return;
        setAffiliateProjectsPanel({
          loading: false,
          error:
            loadError?.message ||
            "Unable to load related projects for this affiliate.",
          rows: [],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedAffiliate?.ckan_user_id,
    selectedAffiliate?.ckan_username,
    selectedAffiliate?.email,
    selectedAffiliate?.full_name,
    selectedAffiliate?.id,
  ]);

  const clearFilters = () => {
    setFilters(createAffiliateModuleFilters());
  };

  const openEditModal = (row) => {
    if (row.source === "ckan_only") {
      setError(
        "CKAN-only users are read-only in this page. Update details directly in CKAN.",
      );
      return;
    }
    setEditingAffiliate(row);
    setEditForm(createAffiliateEditForm(row));
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
    const payload = {
      ...editForm,
      ckan_org_id: editForm.ckan_org_id || null,
      publication_count: Number(editForm.publication_count || 0),
      research_project_count: Number(editForm.research_project_count || 0),
      creative_work_count: Number(editForm.creative_work_count || 0),
      awards_count: Number(editForm.awards_count || 0),
      ip_count: Number(editForm.ip_count || 0),
    };

    try {
      await updateAffiliateProfile(editingAffiliate.id, payload);
      updateRowById(editingAffiliate.id, payload);
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
        "Email",
        "Role",
        "Department",
        "Research Center",
        "Status",
        "GS Faculty",
        "Publications",
        "Projects",
        "Creative Works",
        "Awards",
        "IPs",
      ];
      const lines = buildExportRows().map((row) =>
        [
          row.no,
          row.name,
          row.email,
          row.role,
          row.department,
          row.center,
          row.status,
          row.gs,
          row.publications,
          row.projects,
          row.creativeWorks,
          row.awards,
          row.ips,
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
              <td>${row.email}</td>
              <td>${row.role}</td>
              <td>${row.department}</td>
              <td>${row.center}</td>
              <td>${row.status}</td>
              <td>${row.gs}</td>
              <td>${row.publications}</td>
              <td>${row.projects}</td>
              <td>${row.creativeWorks}</td>
              <td>${row.awards}</td>
              <td>${row.ips}</td>
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
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Research Center</th>
                  <th>Status</th>
                  <th>GS Faculty</th>
                  <th>Publications</th>
                  <th>Projects</th>
                  <th>Creative Works</th>
                  <th>Awards</th>
                  <th>IPs</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="13">No records found.</td></tr>'}
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
      <PageHeader
        title="Affiliates"
        description="Monitor and review affiliate records with analytics, filtering, and export-ready reports."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <Users size={14} />
            Total Affiliates
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.total}
          </p>
        </article>
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <UserCheck size={14} />
            Active
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.active}
          </p>
        </article>
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <UserX size={14} />
            Inactive
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.inactive}
          </p>
        </article>
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <UserRound size={14} />
            Faculty
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.faculty}
          </p>
        </article>
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <GraduationCap size={14} />
            Students
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.student}
          </p>
        </article>
      </div>

      <div className="panel">
        <div className="panel-header flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
          <SlidersHorizontal size={14} />
          Filters
        </div>
        <div className="panel-body grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="control-input pl-8"
              placeholder="Search name/email/id"
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, search: event.target.value }))
              }
            />
          </label>
          <select
            className="control-select"
            value={filters.role}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, role: event.target.value }))
            }
          >
            <option value="all">All roles</option>
            <option value="faculty">Faculty</option>
            <option value="student">Student</option>
            <option value="admin">Admin</option>
          </select>
          <select
            className="control-select"
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, status: event.target.value }))
            }
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            className="control-select"
            value={filters.department}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                department: event.target.value,
              }))
            }
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              className="control-select"
              value={filters.sortBy}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, sortBy: event.target.value }))
              }
            >
              <option value="name_asc">Sort: Name A-Z</option>
              <option value="name_desc">Sort: Name Z-A</option>
              <option value="recent_desc">Sort: Recently updated</option>
              <option value="recent_asc">Sort: Least recently updated</option>
            </select>
            <button
              type="button"
              className="btn btn-outline"
              onClick={clearFilters}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
            Affiliate Records ({filteredRows.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No affiliates found"
              description="Try adjusting filters to find matching affiliate records."
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">No.</th>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Department</th>
                    <th className="px-4 py-3 font-semibold">Research Center</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">GS Faculty</th>
                    <th className="px-4 py-3 font-semibold">Publications</th>
                    <th className="px-4 py-3 font-semibold">Projects</th>
                    <th className="px-4 py-3 font-semibold">Creative Works</th>
                    <th className="px-4 py-3 font-semibold">Awards</th>
                    <th className="px-4 py-3 font-semibold">IPs</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.items.map((row, index) => (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--border)] align-top"
                    >
                      <td className="px-4 py-3 text-slate-600">
                        {pagination.start + index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {row.full_name || "-"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.email || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-700">
                        {row.role || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.department || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.ckan_org_id
                          ? centerNameById[row.ckan_org_id] || "-"
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`status-chip ${
                            row.is_active
                              ? "status-completed"
                              : "status-rejected"
                          }`}
                        >
                          {row.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.is_gs_faculty ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {Number(row.publication_count || 0)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {Number(row.research_project_count || 0)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {Number(row.creative_work_count || 0)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {Number(row.awards_count || 0)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {Number(row.ip_count || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => setViewAffiliateId(row.id)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            disabled={row.source === "ckan_only"}
                            onClick={() => openEditModal(row)}
                          >
                            Edit
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
      {filteredRows.length > 0 ? (
        <PaginationControls
          page={currentPage}
          totalPages={pagination.totalPages}
          onPageChange={setCurrentPage}
        />
      ) : null}

      {selectedAffiliate ? (
        <div className="modal-overlay" onClick={() => setViewAffiliateId(null)}>
          <aside
            className="ml-auto h-full w-full max-w-6xl overflow-y-auto border-l border-[var(--border)] bg-white px-4 pb-4 pt-0 shadow-2xl sm:px-5 sm:pb-5 sm:pt-0"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
              <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
                Affiliate Details
              </h2>
              <button
                className="btn btn-outline"
                onClick={() => setViewAffiliateId(null)}
              >
                Close
              </button>
            </div>
            <div className="grid gap-3 py-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Full Name
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {selectedAffiliate.full_name || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Email
                </p>
                <p className="text-sm text-slate-800">
                  {selectedAffiliate.email || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Role
                </p>
                <p className="text-sm capitalize text-slate-800">
                  {selectedAffiliate.role || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Department
                </p>
                <p className="text-sm text-slate-800">
                  {selectedAffiliate.department || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Research Center
                </p>
                <p className="text-sm text-slate-800">
                  {selectedAffiliate.ckan_org_id
                    ? centerNameById[selectedAffiliate.ckan_org_id] || "-"
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Status
                </p>
                <p className="text-sm text-slate-800">
                  {selectedAffiliate.is_active ? "Active" : "Inactive"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  GS Faculty
                </p>
                <p className="text-sm text-slate-800">
                  {selectedAffiliate.is_gs_faculty ? "Yes" : "No"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Google Scholar
                </p>
                <p className="text-sm break-all text-slate-800">
                  {selectedAffiliate.google_scholar_link || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Designation
                </p>
                <p className="text-sm text-slate-800">
                  {selectedAffiliate.designation || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Employment Status
                </p>
                <p className="text-sm text-slate-800">
                  {selectedAffiliate.employment_status || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Publications
                </p>
                <p className="text-sm text-slate-800">
                  {selectedAffiliate.publication_count || 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Projects
                </p>
                <p className="text-sm text-slate-800">
                  {selectedAffiliate.research_project_count || 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Creative Works
                </p>
                <p className="text-sm text-slate-800">
                  {selectedAffiliate.creative_work_count || 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Awards
                </p>
                <p className="text-sm text-slate-800">
                  {selectedAffiliate.awards_count || 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  IPs
                </p>
                <p className="text-sm text-slate-800">
                  {selectedAffiliate.ip_count || 0}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                  Related Projects ({affiliateProjectsPanel.rows.length})
                </p>
                <div className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)]">
                  <div className="max-h-[320px] overflow-auto">
                    {affiliateProjectsPanel.loading ? (
                      <p className="p-3 text-sm text-slate-600">
                        Loading related projects...
                      </p>
                    ) : affiliateProjectsPanel.error ? (
                      <p className="p-3 text-sm text-red-700">
                        {affiliateProjectsPanel.error}
                      </p>
                    ) : affiliateProjectsPanel.rows.length === 0 ? (
                      <p className="p-3 text-sm text-slate-600">
                        No related projects found for this affiliate.
                      </p>
                    ) : (
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>No.</th>
                            <th>Project Title</th>
                            <th>Status</th>
                            <th>Year</th>
                            <th>Organization</th>
                            <th>Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {affiliateProjectsPanel.rows.map((project, index) => (
                            <tr key={project.id}>
                              <td>{index + 1}</td>
                              <td>{project.title}</td>
                              <td className="capitalize">{project.status}</td>
                              <td>{project.year}</td>
                              <td>{project.organization}</td>
                              <td>
                                {project.updatedAt
                                  ? new Date(project.updatedAt).toLocaleString()
                                  : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  User ID
                </p>
                <code className="text-xs text-slate-700">
                  {selectedAffiliate.id}
                </code>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {editingAffiliate ? (
        <div className="modal-overlay modal-overlay-centered">
          <div className="panel w-full max-w-4xl">
            <div className="panel-header flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
                Edit Affiliate
              </h2>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setEditingAffiliate(null)}
                disabled={savingEdit}
              >
                Close
              </button>
            </div>
            <div className="panel-body grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Department</span>
                <input
                  className="control-input"
                  value={editForm.department}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      department: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Research Center
                </span>
                <select
                  className="control-select"
                  value={editForm.ckan_org_id}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      ckan_org_id: event.target.value,
                    }))
                  }
                >
                  <option value="">None</option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Designation
                </span>
                <input
                  className="control-input"
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
                <input
                  className="control-input"
                  value={editForm.employment_status}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      employment_status: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-semibold text-slate-700">
                  Google Scholar Link
                </span>
                <input
                  className="control-input"
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
                <input
                  type="number"
                  min="0"
                  className="control-input"
                  value={editForm.publication_count}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      publication_count: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Projects</span>
                <input
                  type="number"
                  min="0"
                  className="control-input"
                  value={editForm.research_project_count}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      research_project_count: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Creative Works
                </span>
                <input
                  type="number"
                  min="0"
                  className="control-input"
                  value={editForm.creative_work_count}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      creative_work_count: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Awards</span>
                <input
                  type="number"
                  min="0"
                  className="control-input"
                  value={editForm.awards_count}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      awards_count: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">IPs</span>
                <input
                  type="number"
                  min="0"
                  className="control-input"
                  value={editForm.ip_count}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      ip_count: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditingAffiliate(null)}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveAffiliateEdit}
                  disabled={savingEdit}
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
