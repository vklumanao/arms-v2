import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/components/providers/AuthProvider";
import { useReferenceData } from "@/hooks/useReferenceData";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";
import PaginationControls from "@/components/navigation/PaginationControls";
import { useToast } from "@/components/providers/ToastProvider";
import {
  deleteOwnedProject,
  fetchCenterChiefProjects,
  fetchLinkedProjects,
  fetchUserProjects,
  updateResearchOutputVisibility,
} from "@/services/submissions";
import { hasPermission, PERMISSIONS } from "@/services/permissions";
import { formatStatusLabel, normalizeStatus } from "@/utils/status";
import { formatDate } from "@/utils/submissions";
import {
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";

const PROJECTS_PAGE_SIZE = 10;
export default function ResearchProjectsPage() {
  const { user, profile } = useAuth();
  const roleKeys = Array.isArray(profile?.roles)
    ? profile.roles.map((entry) => entry?.key)
    : profile?.role || user?.role;
  const isAdmin = hasPermission(
    roleKeys,
    PERMISSIONS.ADMIN_CONTROLS_MANAGE,
    profile?.permissions,
  );
  const canCreateProjects = hasPermission(
    roleKeys,
    PERMISSIONS.PROJECTS_CREATE,
    profile?.permissions,
  );
  const canEditProjects = hasPermission(
    roleKeys,
    PERMISSIONS.PROJECTS_EDIT,
    profile?.permissions,
  );
  const canDeleteProjects = hasPermission(
    roleKeys,
    PERMISSIONS.PROJECTS_DELETE,
    profile?.permissions,
  );
  const canExportProjects = hasPermission(
    roleKeys,
    PERMISSIONS.PROJECTS_VIEW,
    profile?.permissions,
  );
  const isCenterChief =
    profile?.is_center_chief === true && Boolean(profile?.managed_center_id);
  const hasOrgId = String(profile?.ckan_org_id || "").trim();
  const hasSubmitContext = isAdmin || Boolean(hasOrgId);
  const canSubmit = canCreateProjects && hasSubmitContext;
  const needsOrganization = canCreateProjects && !hasSubmitContext;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { centers } = useReferenceData();
  const [projects, setProjects] = useState([]);
  const [linkedProjects, setLinkedProjects] = useState([]);
  const [centerChiefProjects, setCenterChiefProjects] = useState([]);
  const [centerChiefLoading, setCenterChiefLoading] = useState(false);
  const [centerChiefPage, setCenterChiefPage] = useState(1);
  const [centerChiefSearch, setCenterChiefSearch] = useState("");
  const [centerChiefQuickFilter, setCenterChiefQuickFilter] = useState("all");
  const [linkedProjectsQuickFilter, setLinkedProjectsQuickFilter] =
    useState("all");
  const [linkedViewMode, setLinkedViewMode] = useState("list");
  const [filters, setFilters] = useState({
    search: "",
    sortBy: "submitted_desc",
  });
  const [quickFilter, setQuickFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [dataLoading, setDataLoading] = useState(true);
  const DIRECTORY_SKELETON_COUNT = 6;
  const [deletingProjectId, setDeletingProjectId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exportingType, setExportingType] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [visibilitySavingByDataset, setVisibilitySavingByDataset] = useState(
    {},
  );
  const toast = useToast();

  const hasActiveDirectoryFilters = useMemo(() => {
    const searchActive = String(filters.search || "").trim().length > 0;
    const quickActive = quickFilter !== "all";
    const sortActive = String(filters.sortBy || "") !== "submitted_desc";
    return searchActive || quickActive || sortActive;
  }, [filters.search, filters.sortBy, quickFilter]);

  const resetDirectoryFilters = useCallback(() => {
    setQuickFilter("all");
    setFilters({
      search: "",
      sortBy: "submitted_desc",
    });
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

  const hasActiveLinkedFilters = useMemo(
    () => linkedProjectsQuickFilter !== "all",
    [linkedProjectsQuickFilter],
  );

  const resetLinkedFilters = useCallback(() => {
    setLinkedProjectsQuickFilter("all");
  }, []);

  useEffect(() => {
    if (error) toast.error("Action failed", error);
  }, [error, toast]);

  useEffect(() => {
    if (message) toast.success("Action completed", message);
  }, [message, toast]);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId) {
      navigate(`/projects/submit?edit=${encodeURIComponent(editId)}`, {
        replace: true,
      });
    }
  }, [navigate, searchParams]);

  const goToProjectDetail = (project) => {
    const id = String(project?.ckan_dataset_id || project?.id || "").trim();
    if (!id) return;
    navigate(`/projects/${encodeURIComponent(id)}`);
  };

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    setDataLoading(true);

    Promise.all([
      fetchUserProjects({ userId: profile?.id })
        .then(({ data, error: loadError }) => {
          if (!isMounted) return;
          if (loadError) {
            setError(loadError.message || "Unable to load your projects.");
            setProjects([]);
            return;
          }
          setProjects(Array.isArray(data) ? data : []);
        })
        .catch((queryError) => {
          if (!isMounted) return;
          setError(queryError.message || "Unable to load your projects.");
          setProjects([]);
        }),
      fetchLinkedProjects()
        .then(({ data, error: loadError }) => {
          if (!isMounted) return;
          if (loadError) {
            setError(loadError.message || "Unable to load linked projects.");
            setLinkedProjects([]);
            return;
          }
          setLinkedProjects(Array.isArray(data) ? data : []);
        })
        .catch((queryError) => {
          if (!isMounted) return;
          setError(queryError.message || "Unable to load linked projects.");
          setLinkedProjects([]);
        }),
    ]).finally(() => {
      if (!isMounted) return;
      setDataLoading(false);
    });

    if (isCenterChief) {
      setCenterChiefLoading(true);
      fetchCenterChiefProjects()
        .then(({ data, error: loadError }) => {
          if (!isMounted) return;
          if (loadError) {
            setError(
              loadError.message || "Unable to load managed center projects.",
            );
            setCenterChiefProjects([]);
            return;
          }
          setCenterChiefProjects(Array.isArray(data) ? data : []);
        })
        .catch((queryError) => {
          if (!isMounted) return;
          setError(
            queryError.message || "Unable to load managed center projects.",
          );
          setCenterChiefProjects([]);
        })
        .finally(() => {
          if (!isMounted) return;
          setCenterChiefLoading(false);
        });
    } else {
      setCenterChiefProjects([]);
    }

    return () => {
      isMounted = false;
    };
  }, [isCenterChief, profile?.id, user?.id]);

  const centerById = useMemo(
    () =>
      centers.reduce((acc, center) => {
        acc[center.id] = center.name;
        return acc;
      }, {}),
    [centers],
  );
  const getProjectOrganization = useCallback(
    (project) => {
      const submittedOrgName = String(
        project?.submitted_by_org_name || "",
      ).trim();
      if (submittedOrgName) return submittedOrgName;
      const submittedOrgId = String(project?.submitted_by_org_id || "").trim();
      if (submittedOrgId) return centerById[submittedOrgId] || submittedOrgId;
      const projectOrgId = String(project?.project_ckan_org_id || "").trim();
      if (projectOrgId) return centerById[projectOrgId] || projectOrgId;
      return centerById[project?.research_center_id] || "-";
    },
    [centerById],
  );

  const analytics = useMemo(() => {
    const base = {
      total: projects.length,
      proposal: 0,
      ongoing: 0,
      completed: 0,
      rejected: 0,
      draft: 0,
    };

    projects.forEach((project) => {
      const isDraft =
        String(project?.submission_state || "")
          .trim()
          .toLowerCase() === "draft";
      if (isDraft) {
        base.draft += 1;
        return;
      }
      const key = normalizeStatus(project.status);
      if (Object.prototype.hasOwnProperty.call(base, key)) {
        base[key] += 1;
      }
    });

    return base;
  }, [projects]);

  const baseFilteredProjects = useMemo(() => {
    const normalizedSearch = String(filters.search || "")
      .trim()
      .toLowerCase();

    const filtered = (projects || []).filter((project) => {
      const status = normalizeStatus(project.status);
      const title = String(project.title || "").toLowerCase();
      const abstract = String(project.abstract || "").toLowerCase();
      const leadResearcher = String(
        project.lead_researcher || "",
      ).toLowerCase();
      const year = String(project.year || "").toLowerCase();
      const organization = String(
        getProjectOrganization(project) || "",
      ).toLowerCase();

      if (
        normalizedSearch &&
        !title.includes(normalizedSearch) &&
        !abstract.includes(normalizedSearch) &&
        !leadResearcher.includes(normalizedSearch) &&
        !status.includes(normalizedSearch) &&
        !year.includes(normalizedSearch) &&
        !organization.includes(normalizedSearch)
      ) {
        return false;
      }

      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (filters.sortBy === "submitted_asc") {
        return new Date(a.submitted_at || 0) - new Date(b.submitted_at || 0);
      }
      if (filters.sortBy === "title_asc") {
        return String(a.title || "").localeCompare(String(b.title || ""));
      }
      if (filters.sortBy === "title_desc") {
        return String(b.title || "").localeCompare(String(a.title || ""));
      }
      return new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0);
    });

    return sorted;
  }, [filters, getProjectOrganization, projects]);

  const filteredProjects = useMemo(() => {
    if (quickFilter === "draft") {
      return baseFilteredProjects.filter(
        (project) =>
          String(project?.submission_state || "")
            .trim()
            .toLowerCase() === "draft",
      );
    }
    if (quickFilter === "public") {
      return baseFilteredProjects.filter((project) => !project.private);
    }
    if (quickFilter === "private") {
      return baseFilteredProjects.filter((project) => project.private);
    }
    if (quickFilter !== "all") {
      return baseFilteredProjects.filter(
        (project) => normalizeStatus(project.status) === quickFilter,
      );
    }
    return baseFilteredProjects;
  }, [baseFilteredProjects, quickFilter]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredProjects.length / PROJECTS_PAGE_SIZE)),
    [filteredProjects.length],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, quickFilter]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * PROJECTS_PAGE_SIZE;
    return filteredProjects.slice(start, start + PROJECTS_PAGE_SIZE);
  }, [currentPage, filteredProjects]);

  const linkedProjectRows = useMemo(
    () =>
      linkedProjects.map((project) => ({
        id: project.id,
        title: project.title || "-",
        lead_researcher: project.lead_researcher || "-",
        research_center: getProjectOrganization(project),
        linked_resources_count: Array.isArray(project.resources)
          ? project.resources.length
          : 0,
        private:
          typeof project?.private === "boolean"
            ? project.private
            : project?.project_public_visible === true
              ? false
              : project?.project_public_visible === false
                ? true
                : false,
        submitted_at: project.submitted_at || null,
        status: normalizeStatus(project.status),
      })),
    [getProjectOrganization, linkedProjects],
  );
  const linkedProjectFilteredRows = useMemo(() => {
    if (linkedProjectsQuickFilter === "all") return linkedProjectRows;
    if (linkedProjectsQuickFilter === "public") {
      return linkedProjectRows.filter((row) => !row.private);
    }
    if (linkedProjectsQuickFilter === "private") {
      return linkedProjectRows.filter((row) => row.private);
    }
    return linkedProjectRows.filter(
      (row) => normalizeStatus(row.status) === linkedProjectsQuickFilter,
    );
  }, [linkedProjectRows, linkedProjectsQuickFilter]);

  const centerChiefRows = useMemo(
    () =>
      centerChiefProjects
        .map((project) => ({
          id: project.id,
          title: project.title || "-",
          lead_researcher: project.lead_researcher || "-",
          research_center: getProjectOrganization(project),
          year: project.year || "-",
          status: normalizeStatus(project.status),
          submission_state: project.submission_state || "",
          private:
            typeof project?.private === "boolean"
              ? project.private
              : project?.project_public_visible === true
                ? false
                : project?.project_public_visible === false
                  ? true
                  : false,
          submitted_at: project.submitted_at || null,
        }))
        .sort(
          (a, b) =>
            new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0),
        ),
    [centerChiefProjects, getProjectOrganization],
  );
  const baseCenterChiefRows = useMemo(() => {
    const query = String(centerChiefSearch || "")
      .trim()
      .toLowerCase();
    return centerChiefRows.filter((row) => {
      const haystack = [
        row.title,
        row.lead_researcher,
        row.status,
        row.year,
        row.research_center,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return query ? haystack.includes(query) : true;
    });
  }, [centerChiefRows, centerChiefSearch]);
  const centerChiefFilteredRows = useMemo(() => {
    if (centerChiefQuickFilter === "draft") {
      return baseCenterChiefRows.filter(
        (row) =>
          String(row?.submission_state || "")
            .trim()
            .toLowerCase() === "draft",
      );
    }
    if (centerChiefQuickFilter === "public") {
      return baseCenterChiefRows.filter((row) => !row.private);
    }
    if (centerChiefQuickFilter === "private") {
      return baseCenterChiefRows.filter((row) => row.private);
    }
    if (centerChiefQuickFilter !== "all") {
      return baseCenterChiefRows.filter(
        (row) => normalizeStatus(row.status) === centerChiefQuickFilter,
      );
    }
    return baseCenterChiefRows;
  }, [baseCenterChiefRows, centerChiefQuickFilter]);

  const centerChiefTotalPages = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(centerChiefFilteredRows.length / PROJECTS_PAGE_SIZE),
      ),
    [centerChiefFilteredRows.length],
  );

  useEffect(() => {
    setCenterChiefPage(1);
  }, [centerChiefRows.length, centerChiefSearch, centerChiefQuickFilter]);

  useEffect(() => {
    setCenterChiefPage((prev) => Math.min(prev, centerChiefTotalPages));
  }, [centerChiefTotalPages]);

  const paginatedCenterChiefRows = useMemo(() => {
    const start = (centerChiefPage - 1) * PROJECTS_PAGE_SIZE;
    return centerChiefFilteredRows.slice(start, start + PROJECTS_PAGE_SIZE);
  }, [centerChiefPage, centerChiefFilteredRows]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const openEditModal = (project) => {
    const datasetId = String(
      project?.ckan_dataset_id || project?.id || "",
    ).trim();
    if (!datasetId) {
      setError("Project id is missing.");
      return;
    }
    navigate(`/projects/submit?edit=${encodeURIComponent(datasetId)}`);
  };

  const handleDeleteProject = async (project) => {
    if (!project?.id) return;
    setDeleteTarget(project);
  };

  const confirmDeleteProject = async () => {
    const project = deleteTarget;
    if (!project?.id) return;

    setDeletingProjectId(project.id);
    setMessage("");
    setError("");

    const { error: deleteError } = await deleteOwnedProject({
      projectId: project.id,
    });

    if (deleteError) {
      setError(deleteError.message || "Unable to delete project.");
      setDeletingProjectId("");
      return;
    }

    setProjects((prev) => prev.filter((item) => item.id !== project.id));
    setDeleteTarget(null);
    setDeletingProjectId("");
    setMessage("Project deleted successfully.");
  };

  const handleToggleVisibility = async (project) => {
    const datasetId = String(project?.ckan_dataset_id || "").trim();
    if (!datasetId) {
      setError("Dataset id is missing.");
      return;
    }

    const nextIsPublic = Boolean(project?.private);
    setVisibilitySavingByDataset((prev) => ({ ...prev, [datasetId]: true }));

    const { data, error: updateError } = await updateResearchOutputVisibility({
      datasetId,
      isPublic: nextIsPublic,
    });

    setVisibilitySavingByDataset((prev) => {
      const next = { ...prev };
      delete next[datasetId];
      return next;
    });

    if (updateError) {
      setError(updateError.message || "Unable to update project visibility.");
      return;
    }

    const isNowPublic = Boolean(data?.project_public_visible);
    setProjects((prev) =>
      prev.map((item) =>
        String(item?.ckan_dataset_id || "").trim() === datasetId
          ? {
              ...item,
              project_public_visible: isNowPublic,
              private: !isNowPublic,
            }
          : item,
      ),
    );
    setMessage(
      isNowPublic ? "Project is now public." : "Project is now private.",
    );
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

  const getStatusBadgeClass = (status) => {
    const normalized = normalizeStatus(status);
    if (normalized === "completed")
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (normalized === "ongoing")
      return "border-amber-200 bg-amber-50 text-amber-700";
    if (normalized === "delayed" || normalized === "rejected")
      return "border-red-200 bg-red-50 text-red-700";
    return "border-slate-300 bg-slate-50 text-blue-700";
  };

  const getVisibilityBadgeClass = (isPrivate) =>
    isPrivate
      ? "border-slate-200 bg-slate-50 text-slate-800"
      : "border-slate-200 bg-slate-50 text-slate-800";

  const buildExportRows = () =>
    filteredProjects.map((project, index) => ({
      no: index + 1,
      title: project.title || "-",
      submittedBy: project.submitted_by_name || "Unknown user",
      submittedEmail: project.submitted_by_email || project.submitted_by || "-",
      year: project.year || "-",
      status: formatStatusLabel(project.status) || "-",
      organization: getProjectOrganization(project),
      submittedDate: formatDate(project.submitted_at),
    }));

  const exportAsCsv = () => {
    if (!filteredProjects.length) return;
    setExportingType("csv");
    try {
      const headers = [
        "No.",
        "Title",
        "Submitted By",
        "Submitted Email",
        "Year",
        "Status",
        "Organization",
        "Submitted Date",
      ];
      const lines = buildExportRows().map((row) =>
        [
          row.no,
          row.title,
          row.submittedBy,
          row.submittedEmail,
          row.year,
          row.status,
          row.organization,
          row.submittedDate,
        ]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(","),
      );
      const csv = [headers.join(","), ...lines].join("\n");
      triggerDownload(
        `research-projects-${new Date().toISOString().slice(0, 10)}.csv`,
        csv,
        "text/csv;charset=utf-8;",
      );
    } finally {
      setExportingType("");
    }
  };

  const exportAsPdf = () => {
    if (!filteredProjects.length) return;
    setExportingType("pdf");
    try {
      const timestamp = new Date().toLocaleString();
      const rows = buildExportRows();
      const rowsHtml = rows
        .map(
          (row) => `
            <tr>
              <td>${row.no}</td>
              <td>${row.title}</td>
              <td>${row.submittedBy}</td>
              <td>${row.submittedEmail}</td>
              <td>${row.year}</td>
              <td>${row.status}</td>
              <td>${row.organization}</td>
              <td>${row.submittedDate}</td>
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
            <title>research-project-records-filtered</title>
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
            <h1>Research Project Records Report</h1>
            <p>Generated: ${timestamp} | Scope: filtered | Rows: ${rows.length}</p>
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Title</th>
                  <th>Submitted By</th>
                  <th>Email</th>
                  <th>Year</th>
                  <th>Status</th>
                  <th>Organization</th>
                  <th>Submitted Date</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="8">No records found.</td></tr>'}
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
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="relative">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Submissions Workspace
              </p>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
                Research Projects
              </h1>
              <p className="max-w-2xl text-sm text-slate-600">
                Browse projects, manage visibility, and submit new research
                projects from one place.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canExportProjects ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                      disabled={
                        !filteredProjects.length || Boolean(exportingType)
                      }
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
                      className="text-slate-700 hover:bg-slate-50 focus:bg-slate-50"
                      onSelect={exportAsCsv}
                    >
                      {exportingType === "csv" ? "Exporting..." : "Export CSV"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-slate-700 hover:bg-slate-50 focus:bg-slate-50"
                      onSelect={exportAsPdf}
                    >
                      {exportingType === "pdf" ? "Exporting..." : "Export PDF"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}

              {canSubmit ? (
                <Button asChild variant="mono">
                  <Link to="/projects/submit">Submit Research Project</Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled
                  className="bg-white text-slate-500 border border-slate-300"
                  title="Set your Organization (Research Center) in My Profile to submit."
                >
                  Submit Research Project
                </Button>
              )}
            </div>
          </div>

          {needsOrganization ? (
            <div className="mt-4 rounded-2xl border border-slate-300 bg-white/80 p-4 text-sm text-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>
                  You can browse projects, but submitting requires an
                  Organization (Research Center).
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link to="/profile">Go to My Profile</Link>
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9">
            <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                <FileText size={14} />
                Total Projects
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-700">
                {analytics.total}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                <FileText size={14} />
                Proposal
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-700">
                {analytics.proposal}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                <Clock3 size={14} />
                Ongoing
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-700">
                {analytics.ongoing}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                <CheckCircle2 size={14} />
                Completed
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-700">
                {analytics.completed}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                <XCircle size={14} />
                Rejected
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-700">
                {analytics.rejected}
              </p>
            </div>
          </div>
        </div>
      </div>

      {isCenterChief ? (
        <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold text-slate-700">
                  Managed Center Projects
                </CardTitle>
                <CardDescription className="text-slate-600">
                  Showing {centerChiefFilteredRows.length} project(s) linked to
                  your research center.
                </CardDescription>
              </div>
              <p className="text-sm text-slate-600">
                {centerChiefFilteredRows.length} row(s).
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <label className="relative w-full md:max-w-xl">
                  <span className="sr-only">
                    Search managed center projects
                  </span>
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
                  <Input
                    value={centerChiefSearch}
                    onChange={(event) =>
                      setCenterChiefSearch(event.target.value)
                    }
                    placeholder="Search title, lead, status, year, or center"
                    className="pl-9"
                  />
                </label>
                <span className="text-xs text-slate-600">
                  Scope: {profile?.managed_center_name || "My Center"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {[
                  {
                    key: "all",
                    label: "All Projects",
                    count: baseCenterChiefRows.length,
                  },
                  {
                    key: "proposal",
                    label: "Proposal",
                    count: baseCenterChiefRows.filter(
                      (project) =>
                        normalizeStatus(project.status) === "proposal",
                    ).length,
                  },
                  {
                    key: "ongoing",
                    label: "Ongoing",
                    count: baseCenterChiefRows.filter(
                      (project) =>
                        normalizeStatus(project.status) === "ongoing",
                    ).length,
                  },
                  {
                    key: "completed",
                    label: "Completed",
                    count: baseCenterChiefRows.filter(
                      (project) =>
                        normalizeStatus(project.status) === "completed",
                    ).length,
                  },
                  {
                    key: "rejected",
                    label: "Rejected",
                    count: baseCenterChiefRows.filter(
                      (project) =>
                        normalizeStatus(project.status) === "rejected",
                    ).length,
                  },
                  {
                    key: "draft",
                    label: "Drafts",
                    count: baseCenterChiefRows.filter(
                      (project) =>
                        String(project?.submission_state || "")
                          .trim()
                          .toLowerCase() === "draft",
                    ).length,
                  },
                  {
                    key: "public",
                    label: "Public",
                    count: baseCenterChiefRows.filter(
                      (project) => !project.private,
                    ).length,
                  },
                  {
                    key: "private",
                    label: "Private",
                    count: baseCenterChiefRows.filter(
                      (project) => project.private,
                    ).length,
                  },
                ].map((chip) => (
                  <Button
                    key={chip.key}
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(
                      "rounded-full border-slate-200 px-4 text-xs",
                      centerChiefQuickFilter === chip.key
                        ? "bg-[#1E3A8A] text-white hover:bg-[#1E3A8A]"
                        : "bg-white text-slate-700 hover:bg-slate-50",
                    )}
                    onClick={() => setCenterChiefQuickFilter(chip.key)}
                  >
                    {chip.label}
                    <span
                      className={cn(
                        "ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        centerChiefQuickFilter === chip.key
                          ? "bg-white/20 text-white"
                          : "bg-slate-50 text-slate-700",
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
                      {centerChiefQuickFilter} x
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </CardContent>

          {dataLoading ? (
            <CardContent className="p-4">
              {viewMode === "grid" ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: DIRECTORY_SKELETON_COUNT }).map(
                    (_, index) => (
                      <Card
                        key={`projects-skeleton-grid-${index}`}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                      >
                        <div className="animate-pulse space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="w-full space-y-2">
                              <div className="h-3 w-24 rounded-full bg-zinc-200/80" />
                              <div className="h-5 w-3/4 rounded-full bg-slate-200" />
                              <div className="h-3 w-1/2 rounded-full bg-slate-200" />
                            </div>
                            <div className="h-6 w-16 rounded-full bg-slate-200" />
                          </div>
                          <div className="flex gap-2">
                            <div className="h-6 w-24 rounded-full bg-slate-200" />
                            <div className="h-6 w-24 rounded-full bg-slate-200" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="h-24 rounded-lg bg-slate-200" />
                            <div className="h-24 rounded-lg bg-slate-200" />
                          </div>
                          <div className="flex gap-2">
                            <div className="h-9 w-9 rounded-lg bg-slate-200" />
                            <div className="h-9 w-9 rounded-lg bg-slate-200" />
                            <div className="h-9 w-9 rounded-lg bg-slate-200" />
                          </div>
                        </div>
                      </Card>
                    ),
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="animate-pulse space-y-3">
                    <div className="h-8 w-full rounded-lg bg-slate-200" />
                    {Array.from({ length: DIRECTORY_SKELETON_COUNT }).map(
                      (_, index) => (
                        <div
                          key={`projects-skeleton-list-${index}`}
                          className="h-12 w-full rounded-lg bg-slate-200"
                        />
                      ),
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          ) : null}
          {centerChiefLoading ? (
            <CardContent className="p-4">
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                Loading managed center projects...
              </div>
            </CardContent>
          ) : centerChiefRows.length === 0 ? (
            <CardContent className="p-4">
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                No projects found for your research center yet.
              </div>
            </CardContent>
          ) : centerChiefFilteredRows.length === 0 ? (
            <CardContent className="p-4">
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                No managed center projects match your search.
              </div>
            </CardContent>
          ) : (
            <CardContent className="p-4">
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <Table className="min-w-[980px]">
                  <TableHeader className="bg-slate-50 text-slate-600">
                    <TableRow>
                      <TableHead className="w-[40px]">No.</TableHead>
                      <TableHead className="w-[320px]">Title</TableHead>
                      <TableHead className="w-[180px]">
                        Lead Researcher
                      </TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[110px]">Visibility</TableHead>
                      <TableHead className="w-[80px]">Year</TableHead>
                      <TableHead className="w-[120px]">Submitted</TableHead>
                      <TableHead className="w-[80px] text-right">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCenterChiefRows.map((project, index) => {
                      const statusLabel =
                        formatStatusLabel(project.status) || "-";
                      const statusBadgeClass = getStatusBadgeClass(
                        project.status,
                      );
                      return (
                        <TableRow key={`managed-${project.id}-${index}`}>
                          <TableCell>
                            {(centerChiefPage - 1) * PROJECTS_PAGE_SIZE +
                              index +
                              1}
                          </TableCell>
                          <TableCell className="whitespace-normal break-words font-medium text-slate-700">
                            {project.title || "-"}
                          </TableCell>
                          <TableCell className="text-slate-700">
                            {project.lead_researcher || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={statusBadgeClass}
                            >
                              {statusLabel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getVisibilityBadgeClass(
                                project.private,
                              )}
                            >
                              {project.private ? "Private" : "Public"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-700">
                            {project.year || "-"}
                          </TableCell>
                          <TableCell className="text-slate-700">
                            {formatDate(project.submitted_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                                onClick={() => goToProjectDetail(project)}
                                aria-label={`View ${project?.title || "project"}`}
                                title="View"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                                onClick={() => openEditModal(project)}
                                aria-label={`Edit ${project?.title || "project"}`}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-700 hover:bg-slate-50"
                                onClick={() => handleDeleteProject(project)}
                                aria-label={`Delete ${project?.title || "project"}`}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  {centerChiefTotalPages > 1 ? (
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={7} className="px-3 py-3">
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

      <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-slate-700">
                Research Project Records
              </CardTitle>
              <CardDescription className="text-slate-600">
                Showing {filteredProjects.length} project(s).
              </CardDescription>
            </div>
            <p className="text-sm text-slate-600">
              {filteredProjects.length} row(s).
            </p>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="relative w-full sm:max-w-md">
                    <span className="sr-only">Search projects</span>
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
                    <Input
                      className="pl-9"
                      placeholder="Search title, abstract, lead, status, year, or center"
                      value={filters.search}
                      onChange={(e) => updateFilter("search", e.target.value)}
                    />
                  </label>

                  <Select
                    value={filters.sortBy}
                    onValueChange={(value) => updateFilter("sortBy", value)}
                  >
                    <SelectTrigger className="w-full sm:w-[16rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-slate-300 shadow-md">
                      <SelectItem value="submitted_desc">
                        Sort: Newest submitted
                      </SelectItem>
                      <SelectItem value="submitted_asc">
                        Sort: Oldest submitted
                      </SelectItem>
                      <SelectItem value="title_asc">Sort: Title A-Z</SelectItem>
                      <SelectItem value="title_desc">
                        Sort: Title Z-A
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="inline-flex w-full items-center justify-between gap-1 rounded-full border border-slate-200 bg-white p-1 sm:w-auto">
                    <Button
                      variant={viewMode === "grid" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("grid")}
                      type="button"
                      className="rounded-full"
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
                  {[
                    {
                      key: "all",
                      label: "All Projects",
                      count: baseFilteredProjects.length,
                    },
                    {
                      key: "proposal",
                      label: "Proposal",
                      count: baseFilteredProjects.filter(
                        (project) =>
                          normalizeStatus(project.status) === "proposal",
                      ).length,
                    },
                    {
                      key: "ongoing",
                      label: "Ongoing",
                      count: baseFilteredProjects.filter(
                        (project) =>
                          normalizeStatus(project.status) === "ongoing",
                      ).length,
                    },
                    {
                      key: "completed",
                      label: "Completed",
                      count: baseFilteredProjects.filter(
                        (project) =>
                          normalizeStatus(project.status) === "completed",
                      ).length,
                    },
                    {
                      key: "rejected",
                      label: "Rejected",
                      count: baseFilteredProjects.filter(
                        (project) =>
                          normalizeStatus(project.status) === "rejected",
                      ).length,
                    },
                    {
                      key: "draft",
                      label: "Drafts",
                      count: baseFilteredProjects.filter(
                        (project) =>
                          String(project?.submission_state || "")
                            .trim()
                            .toLowerCase() === "draft",
                      ).length,
                    },
                    {
                      key: "public",
                      label: "Public",
                      count: baseFilteredProjects.filter(
                        (project) => !project.private,
                      ).length,
                    },
                    {
                      key: "private",
                      label: "Private",
                      count: baseFilteredProjects.filter(
                        (project) => project.private,
                      ).length,
                    },
                  ].map((chip) => (
                    <Button
                      key={chip.key}
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(
                        "rounded-full border-slate-200 px-4 text-xs",
                        quickFilter === chip.key
                          ? "bg-[#1E3A8A] text-white hover:bg-[#1E3A8A]"
                          : "bg-white text-slate-700 hover:bg-slate-50",
                      )}
                      onClick={() => setQuickFilter(chip.key)}
                    >
                      {chip.label}
                      <span
                        className={cn(
                          "ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          quickFilter === chip.key
                            ? "bg-white/20 text-white"
                            : "bg-slate-50 text-slate-700",
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
                    className="rounded-full text-xs text-slate-700 hover:text-slate-700"
                    onClick={resetDirectoryFilters}
                  >
                    Reset all
                  </Button>
                </div>
              </div>
            </div>

            {hasActiveDirectoryFilters ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                  Active Filters
                </span>
                {String(filters.search || "").trim() ? (
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                    onClick={() => updateFilter("search", "")}
                  >
                    Search: "{String(filters.search || "").trim()}" x
                  </button>
                ) : null}
                {quickFilter !== "all" ? (
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                    onClick={() => setQuickFilter("all")}
                  >
                    {quickFilter} x
                  </button>
                ) : null}
                {String(filters.sortBy || "") !== "submitted_desc" ? (
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                    onClick={() => updateFilter("sortBy", "submitted_desc")}
                  >
                    Sort: {filters.sortBy} x
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardContent>
        {!dataLoading && filteredProjects.length === 0 ? (
          <CardContent className="p-4">
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
              No research projects found. Try a different search term or submit
              a new research project.
            </div>
          </CardContent>
        ) : !dataLoading ? (
          <CardContent className="p-4">
            {viewMode === "grid" ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {paginatedProjects.map((project, index) => {
                  const isDraft =
                    String(project?.submission_state || "")
                      .trim()
                      .toLowerCase() === "draft";
                  const status = normalizeStatus(project.status);
                  const statusLabel = formatStatusLabel(status) || "-";
                  const statusBadgeClass = getStatusBadgeClass(status);
                  const ownerKey = String(project?.submitted_by || "").trim();
                  const currentUserKey = String(
                    profile?.id || user?.id || "",
                  ).trim();
                  const isOwner =
                    ownerKey && currentUserKey && ownerKey === currentUserKey;
                  const canContinueDraft =
                    isDraft &&
                    ownerKey &&
                    currentUserKey &&
                    ownerKey === currentUserKey &&
                    Boolean(project?.ckan_dataset_id || project?.id) &&
                    canEditProjects;
                  const canToggleVisibility =
                    isAdmin &&
                    canEditProjects &&
                    Boolean(project?.ckan_dataset_id);
                  const canEdit =
                    canEditProjects &&
                    (isAdmin || isOwner) &&
                    Boolean(project?.ckan_dataset_id || project?.id);
                  const canDelete =
                    canDeleteProjects &&
                    (isAdmin || isOwner) &&
                    Boolean(project?.ckan_dataset_id || project?.id);

                  return (
                    <Card
                      key={project.id}
                      className="group rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                              #
                              {(currentPage - 1) * PROJECTS_PAGE_SIZE +
                                index +
                                1}{" "}
                              · {statusLabel}
                            </p>
                            <h3 className="mt-1 line-clamp-2 text-base font-bold text-slate-700">
                              {project.title || "-"}
                            </h3>
                            <p className="mt-1 truncate text-sm text-slate-600">
                              {project.research_center || "-"}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0",
                              getVisibilityBadgeClass(project.private),
                            )}
                          >
                            {project.private ? "Private" : "Public"}
                          </Badge>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {isDraft ? (
                            <Badge
                              variant="outline"
                              className="border-slate-200 bg-slate-50 text-slate-700"
                            >
                              Draft
                            </Badge>
                          ) : null}
                          <Badge variant="outline" className={statusBadgeClass}>
                            {statusLabel}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-slate-200 bg-slate-50 text-slate-800"
                          >
                            Year: {project.year || "-"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-slate-200 bg-slate-50 text-slate-800"
                          >
                            Submitted: {formatDate(project.submitted_at)}
                          </Badge>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => goToProjectDetail(project)}
                            aria-label={`View ${project?.title || "project"}`}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {canToggleVisibility ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              disabled={Boolean(
                                visibilitySavingByDataset[
                                  project.ckan_dataset_id
                                ],
                              )}
                              onClick={() => handleToggleVisibility(project)}
                              aria-label={
                                project.private ? "Make public" : "Make private"
                              }
                              title={
                                project.private ? "Make public" : "Make private"
                              }
                            >
                              {visibilitySavingByDataset[
                                project.ckan_dataset_id
                              ] ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : project.private ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          ) : null}

                          {canContinueDraft ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => openEditModal(project)}
                              aria-label={`Continue ${project?.title || "draft"}`}
                              title="Continue"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}

                          {canEdit ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => openEditModal(project)}
                              aria-label={`Edit ${project?.title || "project"}`}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}

                          {canDelete ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 text-slate-700 hover:bg-slate-50"
                              onClick={() => handleDeleteProject(project)}
                              disabled={deletingProjectId === project.id}
                              aria-label={`Delete ${project?.title || "project"}`}
                              title={
                                deletingProjectId === project.id
                                  ? "Deleting..."
                                  : "Delete"
                              }
                            >
                              {deletingProjectId === project.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <Table className="min-w-[1120px] w-full table-fixed">
                  <TableHeader className="bg-slate-50 text-slate-600">
                    <TableRow>
                      <TableHead className="w-[40px]">No.</TableHead>
                      <TableHead className="w-[500px]">Title</TableHead>
                      <TableHead>Project Year</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead>Research Center</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProjects.map((project, index) => {
                      const isDraft =
                        String(project?.submission_state || "")
                          .trim()
                          .toLowerCase() === "draft";
                      const status = normalizeStatus(project.status);
                      const statusLabel = formatStatusLabel(status) || "-";
                      const statusBadgeClass = getStatusBadgeClass(status);
                      const ownerKey = String(
                        project?.submitted_by || "",
                      ).trim();
                      const currentUserKey = String(
                        profile?.id || user?.id || "",
                      ).trim();
                      const isOwner =
                        ownerKey &&
                        currentUserKey &&
                        ownerKey === currentUserKey;
                      const canContinueDraft =
                        isDraft &&
                        ownerKey &&
                        currentUserKey &&
                        ownerKey === currentUserKey &&
                        Boolean(project?.ckan_dataset_id || project?.id) &&
                        canEditProjects;
                      const canToggleVisibility =
                        isAdmin &&
                        canEditProjects &&
                        Boolean(project?.ckan_dataset_id);
                      const canEdit =
                        canEditProjects &&
                        (isAdmin || isOwner) &&
                        Boolean(project?.ckan_dataset_id || project?.id);
                      const canDelete =
                        canDeleteProjects &&
                        (isAdmin || isOwner) &&
                        Boolean(project?.ckan_dataset_id || project?.id);
                      return (
                        <TableRow key={project.id} className="align-top">
                          <TableCell>
                            {(currentPage - 1) * PROJECTS_PAGE_SIZE + index + 1}
                          </TableCell>
                          <TableCell className="whitespace-normal break-words font-medium text-slate-700">
                            {project.title || "-"}
                          </TableCell>
                          <TableCell className="text-slate-700">
                            {project.year || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              {isDraft ? (
                                <Badge
                                  variant="outline"
                                  className="border-slate-200 bg-slate-50 text-slate-700"
                                >
                                  Draft
                                </Badge>
                              ) : null}
                              <Badge
                                variant="outline"
                                className={statusBadgeClass}
                              >
                                {statusLabel}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={getVisibilityBadgeClass(
                                  project.private,
                                )}
                              >
                                {project.private ? "Private" : "Public"}
                              </Badge>
                              {canToggleVisibility ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                                  disabled={Boolean(
                                    visibilitySavingByDataset[
                                      project.ckan_dataset_id
                                    ],
                                  )}
                                  onClick={() =>
                                    handleToggleVisibility(project)
                                  }
                                  aria-label={
                                    visibilitySavingByDataset[
                                      project.ckan_dataset_id
                                    ]
                                      ? "Saving visibility..."
                                      : project.private
                                        ? "Make public"
                                        : "Make private"
                                  }
                                  title={
                                    visibilitySavingByDataset[
                                      project.ckan_dataset_id
                                    ]
                                      ? "Saving..."
                                      : project.private
                                        ? "Make Public"
                                        : "Make Private"
                                  }
                                >
                                  {visibilitySavingByDataset[
                                    project.ckan_dataset_id
                                  ] ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : project.private ? (
                                    <Eye className="h-4 w-4" />
                                  ) : (
                                    <EyeOff className="h-4 w-4" />
                                  )}
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-normal break-words text-slate-700">
                            {getProjectOrganization(project)}
                          </TableCell>
                          <TableCell className="text-slate-700">
                            {formatDate(project.submitted_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                                onClick={() => goToProjectDetail(project)}
                                aria-label={`View ${project?.title || "project"}`}
                                title="View"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canContinueDraft ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                                  onClick={() => openEditModal(project)}
                                  aria-label={`Continue ${project?.title || "draft"}`}
                                  title="Continue"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {canDelete ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                                  onClick={() => openEditModal(project)}
                                  aria-label={`Edit ${project?.title || "project"}`}
                                  title="Edit"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {canEdit ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-700 hover:bg-slate-50"
                                  onClick={() => handleDeleteProject(project)}
                                  disabled={deletingProjectId === project.id}
                                  aria-label={`Delete ${project?.title || "project"}`}
                                  title={
                                    deletingProjectId === project.id
                                      ? "Deleting..."
                                      : "Delete"
                                  }
                                >
                                  {deletingProjectId === project.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  {totalPages > 1 ? (
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={8} className="px-3 py-3">
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
        ) : null}
      </Card>

      <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-slate-700">
                Linked Projects
              </CardTitle>
              <CardDescription className="text-slate-600">
                Linked content summary for your submitted research projects.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
              <p className="text-sm text-slate-600">
                {linkedProjectFilteredRows.length} row(s).
              </p>

              <div className="inline-flex w-full items-center justify-between gap-1 rounded-full border border-slate-200 bg-white p-1 md:w-auto">
                <Button
                  variant={linkedViewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setLinkedViewMode("grid")}
                  type="button"
                  className="rounded-full"
                >
                  <LayoutGrid size={14} />
                  Grid
                </Button>
                <Button
                  variant={linkedViewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setLinkedViewMode("list")}
                  type="button"
                  className="rounded-full"
                >
                  <List size={14} />
                  List
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              {[
                {
                  key: "all",
                  label: "All Projects",
                  count: linkedProjectRows.length,
                },
                {
                  key: "proposal",
                  label: "Proposal",
                  count: linkedProjectRows.filter(
                    (project) => normalizeStatus(project.status) === "proposal",
                  ).length,
                },
                {
                  key: "ongoing",
                  label: "Ongoing",
                  count: linkedProjectRows.filter(
                    (project) => normalizeStatus(project.status) === "ongoing",
                  ).length,
                },
                {
                  key: "completed",
                  label: "Completed",
                  count: linkedProjectRows.filter(
                    (project) =>
                      normalizeStatus(project.status) === "completed",
                  ).length,
                },
                {
                  key: "rejected",
                  label: "Rejected",
                  count: linkedProjectRows.filter(
                    (project) => normalizeStatus(project.status) === "rejected",
                  ).length,
                },
                {
                  key: "public",
                  label: "Public",
                  count: linkedProjectRows.filter((project) => !project.private)
                    .length,
                },
                {
                  key: "private",
                  label: "Private",
                  count: linkedProjectRows.filter((project) => project.private)
                    .length,
                },
              ].map((chip) => (
                <Button
                  key={chip.key}
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    "rounded-full border-slate-200 px-4 text-xs",
                    linkedProjectsQuickFilter === chip.key
                      ? "bg-[#1E3A8A] text-white hover:bg-[#1E3A8A]"
                      : "bg-white text-slate-700 hover:bg-slate-50",
                  )}
                  onClick={() => setLinkedProjectsQuickFilter(chip.key)}
                >
                  {chip.label}
                  <span
                    className={cn(
                      "ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      linkedProjectsQuickFilter === chip.key
                        ? "bg-white/20 text-white"
                        : "bg-slate-50 text-slate-700",
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
                className="rounded-full text-xs text-slate-700 hover:text-slate-700"
                onClick={resetLinkedFilters}
              >
                Reset all
              </Button>
            </div>

            {hasActiveLinkedFilters ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                  Active Filters
                </span>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                  onClick={() => setLinkedProjectsQuickFilter("all")}
                >
                  {linkedProjectsQuickFilter} x
                </button>
              </div>
            ) : null}
          </div>

          {dataLoading ? (
            linkedViewMode === "grid" ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: DIRECTORY_SKELETON_COUNT }).map(
                  (_, index) => (
                    <Card
                      key={`linked-skeleton-grid-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="animate-pulse space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="w-full space-y-2">
                            <div className="h-3 w-24 rounded-full bg-zinc-200/80" />
                            <div className="h-5 w-3/4 rounded-full bg-slate-200" />
                            <div className="h-3 w-1/2 rounded-full bg-slate-200" />
                          </div>
                          <div className="h-6 w-16 rounded-full bg-slate-200" />
                        </div>
                        <div className="flex gap-2">
                          <div className="h-6 w-24 rounded-full bg-slate-200" />
                          <div className="h-6 w-24 rounded-full bg-slate-200" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="h-24 rounded-lg bg-slate-200" />
                          <div className="h-24 rounded-lg bg-slate-200" />
                        </div>
                        <div className="flex gap-2">
                          <div className="h-9 w-9 rounded-lg bg-slate-200" />
                          <div className="h-9 w-9 rounded-lg bg-slate-200" />
                          <div className="h-9 w-9 rounded-lg bg-slate-200" />
                        </div>
                      </div>
                    </Card>
                  ),
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="animate-pulse space-y-3">
                  <div className="h-8 w-full rounded-lg bg-slate-200" />
                  {Array.from({ length: DIRECTORY_SKELETON_COUNT }).map(
                    (_, index) => (
                      <div
                        key={`linked-skeleton-list-${index}`}
                        className="h-12 w-full rounded-lg bg-slate-200"
                      />
                    ),
                  )}
                </div>
              </div>
            )
          ) : null}

          {!dataLoading && linkedProjectFilteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
              This section will display project summaries once you are assigned
              to a research team or have submitted a research project.
            </div>
          ) : null}

          {!dataLoading &&
          linkedViewMode === "grid" &&
          linkedProjectFilteredRows.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {linkedProjectFilteredRows.map((project, index) => (
                <Card
                  key={`linked-card-${project.id}-${index}`}
                  className="group rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                          #{index + 1} ·{" "}
                          {formatStatusLabel(project.status) || "-"}
                        </p>
                        <h3 className="mt-1 line-clamp-2 text-base font-bold text-slate-700">
                          {project.title || "-"}
                        </h3>
                        <p className="mt-1 truncate text-sm text-slate-600">
                          {project.research_center || "-"}
                        </p>
                        <p className="mt-1 truncate text-sm text-slate-600">
                          Lead:{" "}
                          <span className="font-semibold text-slate-700">
                            {project.lead_researcher || "-"}
                          </span>
                        </p>
                      </div>

                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0",
                          getVisibilityBadgeClass(project.private),
                        )}
                      >
                        {project.private ? "Private" : "Public"}
                      </Badge>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={getStatusBadgeClass(project.status)}
                      >
                        {formatStatusLabel(project.status) || "-"}
                      </Badge>
                      <Badge variant="secondary">
                        Submitted: {formatDate(project.submitted_at)}
                      </Badge>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => goToProjectDetail(project)}
                        aria-label={`View ${project?.title || "project"}`}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEditProjects ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => openEditModal(project)}
                          aria-label={`Edit ${project?.title || "project"}`}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {canDeleteProjects ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 text-slate-700 hover:bg-slate-50"
                          onClick={() => handleDeleteProject(project)}
                          aria-label={`Delete ${project?.title || "project"}`}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          {!dataLoading &&
          linkedViewMode === "list" &&
          linkedProjectFilteredRows.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <Table className="min-w-[980px]">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-[50px]">No.</TableHead>
                    <TableHead className="w-[350px]">Title</TableHead>
                    <TableHead className="w-[180px]">Lead Researcher</TableHead>
                    <TableHead className="w-[220px]">Research Center</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[110px]">Visibility</TableHead>
                    <TableHead className="w-[120px]">Submitted</TableHead>
                    <TableHead className="w-[80px] text-right">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedProjectFilteredRows.map((project, index) => (
                    <TableRow key={`linked-${project.id}`}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium text-slate-700">
                        {project.title}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {project.lead_researcher}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {project.research_center}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getStatusBadgeClass(project.status)}
                        >
                          {formatStatusLabel(project.status) || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getVisibilityBadgeClass(project.private)}
                        >
                          {project.private ? "Private" : "Public"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {formatDate(project.submitted_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => goToProjectDetail(project)}
                            aria-label={`View ${project?.title || "project"}`}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEditProjects ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditModal(project)}
                              aria-label={`Edit ${project?.title || "project"}`}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {canDeleteProjects ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-700 hover:bg-slate-50"
                              onClick={() => handleDeleteProject(project)}
                              aria-label={`Delete ${project?.title || "project"}`}
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
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Delete Research Project"
        message={`Delete "${deleteTarget?.title || "Untitled"}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={Boolean(deletingProjectId)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteProject}
      />
    </section>
  );
}




