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
import { formatStatusLabel, normalizeStatus } from "@/utils/status";
import { formatDate } from "@/utils/submissions";
import {
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Pencil,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";

const PROJECTS_PAGE_SIZE = 10;
export default function ResearchProjectsPage() {
  const { user, profile } = useAuth();
  const isAdmin =
    String(profile?.role || user?.role || "")
      .trim()
      .toLowerCase() === "admin";
  const isCenterChief =
    String(profile?.role || user?.role || "")
      .trim()
      .toLowerCase() === "faculty" &&
    profile?.is_center_chief === true &&
    Boolean(profile?.managed_center_id);
  const hasOrgId = String(profile?.ckan_org_id || "").trim();
  const canSubmit = isAdmin || Boolean(hasOrgId);
  const needsOrganization = !canSubmit;
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
  const [filters, setFilters] = useState({
    search: "",
    sortBy: "submitted_desc",
  });
  const [quickFilter, setQuickFilter] = useState("all");
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
    fetchUserProjects({ userId: profile?.id })
      .then(({ data, error: loadError }) => {
        if (!isMounted) return;
        if (loadError) {
          setError(loadError.message || "Unable to load your projects.");
          return;
        }
        setProjects(Array.isArray(data) ? data : []);
      })
      .catch((queryError) => {
        if (!isMounted) return;
        setError(queryError.message || "Unable to load your projects.");
      });

    fetchLinkedProjects()
      .then(({ data, error: loadError }) => {
        if (!isMounted) return;
        if (loadError) {
          setError(loadError.message || "Unable to load linked projects.");
          return;
        }
        setLinkedProjects(Array.isArray(data) ? data : []);
      })
      .catch((queryError) => {
        if (!isMounted) return;
        setError(queryError.message || "Unable to load linked projects.");
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
    if (normalized === "proposal")
      return "border-[var(--warning)] bg-[var(--surface-muted)] text-[var(--warning)]";
    if (normalized === "ongoing")
      return "border-[var(--accent)] bg-[var(--surface-muted)] text-[var(--accent)]";
    if (normalized === "completed")
      return "border-[var(--success)] bg-[var(--surface-muted)] text-[var(--success)]";
    if (normalized === "rejected")
      return "border-[var(--danger)] bg-[var(--surface-muted)] text-[var(--danger)]";
    return "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]";
  };

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
    <section className="page-stack-lg text-[var(--text)]">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[var(--text)] md:text-3xl">
              Research Projects Workspace
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]"
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
                  className="border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                >
                  <DropdownMenuItem
                    onSelect={exportAsCsv}
                    className="focus:bg-[var(--surface-muted)] focus:text-[var(--text)]"
                  >
                    {exportingType === "csv" ? "Exporting..." : "Export CSV"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={exportAsPdf}
                    className="focus:bg-[var(--surface-muted)] focus:text-[var(--text)]"
                  >
                    {exportingType === "pdf" ? "Exporting..." : "Export PDF"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            {canSubmit ? (
              <Button
                asChild
                className="bg-[var(--brand)] text-[var(--surface)] hover:bg-[var(--brand-strong)]"
              >
                <Link to="/projects/submit">Submit Research Project</Link>
              </Button>
            ) : (
              <Button
                type="button"
                disabled
                className="bg-[var(--surface-strong)] text-[var(--text-muted)]"
                title="Set your Organization (Research Center) in My Profile to submit."
              >
                Submit Research Project
              </Button>
            )}
          </div>
        </div>

        {needsOrganization ? (
          <div className="mt-4 rounded-2xl border border-[var(--warning)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--warning)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                You can browse projects, but submitting requires an Organization
                (Research Center).
              </p>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]"
              >
                <Link to="/profile">Go to My Profile</Link>
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-8">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <FileText size={14} />
              Total Projects
            </p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">
              {analytics.total}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <FileText size={14} />
              Proposal
            </p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">
              {analytics.proposal}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <Clock3 size={14} />
              Ongoing
            </p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">
              {analytics.ongoing}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <CheckCircle2 size={14} />
              Completed
            </p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">
              {analytics.completed}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <XCircle size={14} />
              Rejected
            </p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">
              {analytics.rejected}
            </p>
          </div>
        </div>
      </div>

      {isCenterChief ? (
        <Card className="overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
          <CardHeader className="border-b border-[var(--border)] px-6 py-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold text-[var(--text)]">
                  Managed Center Projects
                </CardTitle>
                <CardDescription className="text-[var(--text-muted)]">
                  Showing {centerChiefFilteredRows.length} project(s) linked to
                  your research center.
                </CardDescription>
              </div>
              <div className="flex w-full flex-col gap-2 md:max-w-xl md:items-end">
                <label className="relative w-full">
                  <span className="sr-only">
                    Search managed center projects
                  </span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <Input
                    value={centerChiefSearch}
                    onChange={(event) =>
                      setCenterChiefSearch(event.target.value)
                    }
                    placeholder="Search title, lead, status, year, or center"
                    className="pl-9 border-[var(--border)] bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus-visible:ring-[var(--brand)]"
                  />
                </label>
                <span className="text-xs text-[var(--text-muted)]">
                  Scope: {profile?.managed_center_name || "My Center"}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
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
                    (project) => normalizeStatus(project.status) === "proposal",
                  ).length,
                },
                {
                  key: "ongoing",
                  label: "Ongoing",
                  count: baseCenterChiefRows.filter(
                    (project) => normalizeStatus(project.status) === "ongoing",
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
                    (project) => normalizeStatus(project.status) === "rejected",
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
                    "rounded-full border px-4 text-xs",
                    centerChiefQuickFilter === chip.key
                      ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--surface)] hover:bg-[var(--brand-strong)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
                  )}
                  onClick={() => setCenterChiefQuickFilter(chip.key)}
                >
                  {chip.label}
                  <span
                    className={cn(
                      "ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      centerChiefQuickFilter === chip.key
                        ? "bg-[var(--surface)] text-[var(--brand-strong)]"
                        : "bg-[var(--surface-strong)] text-[var(--text-muted)]",
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
                className="rounded-full text-xs text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                onClick={() => setCenterChiefQuickFilter("all")}
              >
                Clear filters
              </Button>
            </div>
          </CardHeader>
          {centerChiefLoading ? (
            <CardContent className="p-4">
              <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-6 text-center text-sm text-[var(--text-muted)]">
                Loading managed center projects...
              </div>
            </CardContent>
          ) : centerChiefRows.length === 0 ? (
            <CardContent className="p-4">
              <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-6 text-center text-sm text-[var(--text-muted)]">
                No projects found for your research center yet.
              </div>
            </CardContent>
          ) : centerChiefFilteredRows.length === 0 ? (
            <CardContent className="p-4">
              <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-6 text-center text-sm text-[var(--text-muted)]">
                No managed center projects match your search.
              </div>
            </CardContent>
          ) : (
            <CardContent className="p-4">
              <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <Table className="min-w-[980px]">
                  <TableHeader className="bg-[var(--surface-muted)] text-[var(--text-muted)]">
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
                          <TableCell className="whitespace-normal break-words font-medium text-[var(--text)]">
                            {project.title || "-"}
                          </TableCell>
                          <TableCell className="text-[var(--text-muted)]">
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
                              className={
                                project.private
                                  ? "border-[var(--danger)] bg-[var(--surface-muted)] text-[var(--danger)]"
                                  : "border-[var(--accent)] bg-[var(--surface-muted)] text-[var(--accent)]"
                              }
                            >
                              {project.private ? "Private" : "Public"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[var(--text-muted)]">
                            {project.year || "-"}
                          </TableCell>
                          <TableCell className="text-[var(--text-muted)]">
                            {formatDate(project.submitted_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
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
                                className="h-8 w-8 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
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
                                className="h-8 w-8 text-[var(--danger)] hover:bg-[var(--surface-strong)]"
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

      <Card className="overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
        <CardHeader className="border-b border-[var(--border)] px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-[var(--text)]">
                Research Project Records
              </CardTitle>
              <CardDescription className="text-[var(--text-muted)]">
                Showing {filteredProjects.length} project(s).
              </CardDescription>
            </div>
            <label className="relative w-full md:max-w-md">
              <span className="sr-only">Search projects</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                className="pl-8 border-[var(--border)] bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus-visible:ring-[var(--brand)]"
                placeholder="Search title, abstract, lead, status, year, or center"
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
              />
            </label>
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
              <Select
                value={filters.sortBy}
                onValueChange={(value) => updateFilter("sortBy", value)}
              >
                <SelectTrigger className="w-full border-[var(--border)] bg-[var(--surface)] text-[var(--text)] md:w-[16rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[var(--border)] bg-[var(--surface)] text-[var(--text)]">
                  <SelectItem
                    value="submitted_desc"
                    className="focus:bg-[var(--surface-muted)] focus:text-[var(--text)]"
                  >
                    Sort: Newest submitted
                  </SelectItem>
                  <SelectItem
                    value="submitted_asc"
                    className="focus:bg-[var(--surface-muted)] focus:text-[var(--text)]"
                  >
                    Sort: Oldest submitted
                  </SelectItem>
                  <SelectItem
                    value="title_asc"
                    className="focus:bg-[var(--surface-muted)] focus:text-[var(--text)]"
                  >
                    Sort: Title A-Z
                  </SelectItem>
                  <SelectItem
                    value="title_desc"
                    className="focus:bg-[var(--surface-muted)] focus:text-[var(--text)]"
                  >
                    Sort: Title Z-A
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
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
                  (project) => normalizeStatus(project.status) === "proposal",
                ).length,
              },
              {
                key: "ongoing",
                label: "Ongoing",
                count: baseFilteredProjects.filter(
                  (project) => normalizeStatus(project.status) === "ongoing",
                ).length,
              },
              {
                key: "completed",
                label: "Completed",
                count: baseFilteredProjects.filter(
                  (project) => normalizeStatus(project.status) === "completed",
                ).length,
              },
              {
                key: "rejected",
                label: "Rejected",
                count: baseFilteredProjects.filter(
                  (project) => normalizeStatus(project.status) === "rejected",
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
                count: baseFilteredProjects.filter((project) => project.private)
                  .length,
              },
            ].map((chip) => (
              <Button
                key={chip.key}
                type="button"
                size="sm"
                variant="outline"
                className={cn(
                  "rounded-full border px-4 text-xs",
                  quickFilter === chip.key
                    ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--surface)] hover:bg-[var(--brand-strong)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
                )}
                onClick={() => setQuickFilter(chip.key)}
              >
                {chip.label}
                <span
                  className={cn(
                    "ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    quickFilter === chip.key
                      ? "bg-[var(--surface)] text-[var(--brand-strong)]"
                      : "bg-[var(--surface-strong)] text-[var(--text-muted)]",
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
              className="rounded-full text-xs text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
              onClick={() => setQuickFilter("all")}
            >
              Clear filters
            </Button>
          </div>
        </CardHeader>
        {filteredProjects.length === 0 ? (
          <CardContent className="p-4">
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-sm text-[var(--text-muted)]">
              No research projects found. Try a different search term or submit
              a new research project.
            </div>
          </CardContent>
        ) : (
          <CardContent className="p-4">
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <Table className="min-w-[1120px] w-full table-fixed">
                <TableHeader className="bg-[var(--surface-muted)] text-[var(--text-muted)]">
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
                      Boolean(project?.ckan_dataset_id || project?.id);
                    const canToggleVisibility =
                      isAdmin && Boolean(project?.ckan_dataset_id);
                    const canEdit =
                      (isAdmin || isOwner) &&
                      Boolean(project?.ckan_dataset_id || project?.id);
                    return (
                      <TableRow key={project.id} className="align-top">
                        <TableCell>
                          {(currentPage - 1) * PROJECTS_PAGE_SIZE + index + 1}
                        </TableCell>
                        <TableCell className="whitespace-normal break-words font-medium text-[var(--text)]">
                          {project.title || "-"}
                        </TableCell>
                        <TableCell className="text-[var(--text-muted)]">
                          {project.year || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            {isDraft ? (
                              <Badge
                                variant="outline"
                                className="border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text-muted)]"
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
                              className={
                                project.private
                                  ? "border-[var(--danger)] bg-[var(--surface-muted)] text-[var(--danger)]"
                                  : "border-[var(--accent)] bg-[var(--surface-muted)] text-[var(--accent)]"
                              }
                            >
                              {project.private ? "Private" : "Public"}
                            </Badge>
                            {canToggleVisibility ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                                disabled={Boolean(
                                  visibilitySavingByDataset[
                                    project.ckan_dataset_id
                                  ],
                                )}
                                onClick={() => handleToggleVisibility(project)}
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
                        <TableCell className="whitespace-normal break-words text-[var(--text-muted)]">
                          {getProjectOrganization(project)}
                        </TableCell>
                        <TableCell className="text-[var(--text-muted)]">
                          {formatDate(project.submitted_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
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
                                className="h-8 w-8 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
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
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
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
                                className="h-8 w-8 text-[var(--danger)] hover:bg-[var(--surface-strong)]"
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
          </CardContent>
        )}
      </Card>

      <Card className="overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
        <CardHeader className="border-b border-[var(--border)] px-6 py-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-[var(--text)]">
                Linked Projects
              </CardTitle>
              <CardDescription className="text-[var(--text-muted)]">
                Linked content summary for your submitted research projects.
              </CardDescription>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              {linkedProjectFilteredRows.length} row(s).
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
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
                  (project) => normalizeStatus(project.status) === "completed",
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
                  "rounded-full border px-4 text-xs",
                  linkedProjectsQuickFilter === chip.key
                    ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--surface)] hover:bg-[var(--brand-strong)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
                )}
                onClick={() => setLinkedProjectsQuickFilter(chip.key)}
              >
                {chip.label}
                <span
                  className={cn(
                    "ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    linkedProjectsQuickFilter === chip.key
                      ? "bg-[var(--surface)] text-[var(--brand-strong)]"
                      : "bg-[var(--surface-strong)] text-[var(--text-muted)]",
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
              className="rounded-full text-xs text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
              onClick={() => setLinkedProjectsQuickFilter("all")}
            >
              Clear filters
            </Button>
          </div>
        </CardHeader>
        {linkedProjectFilteredRows.length === 0 ? (
          <CardContent className="p-4">
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-sm text-[var(--text-muted)]">
              This section will display project summaries once you are assigned
              to a research team or have submitted a research project.
            </div>
          </CardContent>
        ) : (
          <CardContent className="p-4">
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <Table className="min-w-[980px]">
                <TableHeader className="bg-[var(--surface-muted)] text-[var(--text-muted)]">
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
                      <TableCell className="font-medium text-[var(--text)]">
                        {project.title}
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)]">
                        {project.lead_researcher}
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)]">
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
                          className={
                            project.private
                              ? "border-[var(--danger)] bg-[var(--surface-muted)] text-[var(--danger)]"
                              : "border-[var(--accent)] bg-[var(--surface-muted)] text-[var(--accent)]"
                          }
                        >
                          {project.private ? "Private" : "Public"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)]">
                        {formatDate(project.submitted_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
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
                            className="h-8 w-8 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
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
                            className="h-8 w-8 text-[var(--danger)] hover:bg-[var(--surface-strong)]"
                            onClick={() => handleDeleteProject(project)}
                            aria-label={`Delete ${project?.title || "project"}`}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
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
