import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PageHeader from "@/shared/components/layout/PageHeader";
import EmptyState from "@/shared/components/feedback/EmptyState";
import PaginationControls from "@/shared/components/navigation/PaginationControls";
import { useToast } from "@/app/providers/ToastProvider";
import { useReferenceData } from "@/shared/hooks/useReferenceData";
import {
  buildAffiliateExportRows,
  buildCenterNameById,
  createAffiliateEditForm,
  createAffiliateModuleFilters,
  filterAndSortAffiliates,
  listAffiliateDepartments,
  paginateItemsWithMeta,
} from "@/features/admin/utils";
import {
  fetchAffiliateRegistry,
  updateAffiliateProfile,
} from "@/features/admin/services";

export default function AdminAffiliatesModulePage() {
  const navigate = useNavigate();
  const PAGE_SIZE = 10;
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
  const [exportingType, setExportingType] = useState("");
  const [editingAffiliate, setEditingAffiliate] = useState(null);
  const [editForm, setEditForm] = useState(createAffiliateEditForm({}));
  const [savingEdit, setSavingEdit] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
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

  const departments = useMemo(() => listAffiliateDepartments(rows), [rows]);
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
      const response = await updateAffiliateProfile(editingAffiliate.id, payload);
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

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] px-4 py-3 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <CardTitle className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
                Affiliate Records ({filteredRows.length})
              </CardTitle>
              <label className="relative min-w-[16rem] flex-1 md:max-w-[24rem]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-8"
                  placeholder="Search name/email/id"
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      search: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={exportAsCsv}
                disabled={!filteredRows.length || Boolean(exportingType)}
              >
                {exportingType === "csv" ? "Exporting..." : "Export CSV"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={exportAsPdf}
                disabled={!filteredRows.length || Boolean(exportingType)}
              >
                {exportingType === "pdf" ? "Exporting..." : "Export PDF"}
              </Button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex w-full flex-wrap gap-2 md:w-auto">
              <Select
                value={filters.sortBy}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    sortBy: value,
                  }))
                }
              >
                <SelectTrigger className="w-full md:w-[14rem]">
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
            <p className="text-sm text-slate-600">
              Showing{" "}
              <span className="font-semibold">{filteredRows.length}</span>{" "}
              affiliate record(s).
            </p>
          </div>
        </CardHeader>

        {filteredRows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No affiliates found"
              description="Try a different search term to find matching affiliate records."
            />
          </div>
        ) : (
          <CardContent className="space-y-3 p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Research Center</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>GS Faculty</TableHead>
                    <TableHead>Publications</TableHead>
                    <TableHead>Projects</TableHead>
                    <TableHead>Creative Works</TableHead>
                    <TableHead>Awards</TableHead>
                    <TableHead>IPs</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.items.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-slate-600">
                        {pagination.start + index + 1}
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold text-slate-900">
                          {row.full_name || "-"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.email || "-"}
                        </p>
                      </TableCell>
                      <TableCell className="capitalize text-slate-700">
                        {row.role || "-"}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {row.department || "-"}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {row.ckan_org_id
                          ? centerNameById[row.ckan_org_id] || "-"
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={row.is_active ? "secondary" : "destructive"}
                        >
                          {row.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {row.is_gs_faculty ? "Yes" : "No"}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {Number(row.publication_count || 0)}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {Number(row.research_project_count || 0)}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {Number(row.creative_work_count || 0)}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {Number(row.awards_count || 0)}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {Number(row.ip_count || 0)}
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
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
      {filteredRows.length > 0 ? (
        <PaginationControls
          page={currentPage}
          totalPages={pagination.totalPages}
          onPageChange={setCurrentPage}
        />
      ) : null}

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
