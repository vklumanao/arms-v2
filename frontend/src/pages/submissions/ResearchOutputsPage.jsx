import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createResearchOutput,
  createResearchOutputWithFile,
  fetchCenterChiefResearchOutputs,
  fetchUserProjects,
  fetchMyResearchOutputs,
  deleteResearchOutput,
  updateResearchOutput,
  updateResearchOutputVisibility,
} from "@/services/submissions";
import { hasPermission, PERMISSIONS } from "@/services/permissions";
import { EXPECTED_OUTPUT_TYPE_OPTIONS } from "@/utils/submissions";
import PaginationControls from "@/components/navigation/PaginationControls";
import { useToast } from "@/components/providers/ToastProvider";
import {
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";

const PRODUCT_SOFTWARE_SPECIFIC_OUTPUT_OPTIONS = [
  "Software Applications",
  "Video Games",
  "Websites and Web Systems",
  "Digital Art and Generative Art",
  "Interactive Media Projects",
  "Data Visualization Projects",
  "Artificial Intelligence Creations",
  "Educational Technology Tools",
];
const MAX_OUTPUT_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export default function ResearchOutputsPage() {
  const toast = useToast();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { centers } = useReferenceData();
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
  const roleKeys = Array.isArray(profile?.roles)
    ? profile.roles.map((entry) => entry?.key)
    : profile?.role;
  const isAdmin = hasPermission(
    roleKeys,
    PERMISSIONS.ADMIN_CONTROLS_MANAGE,
    profile?.permissions,
  );
  const canCreateOutputs = hasPermission(
    roleKeys,
    PERMISSIONS.OUTPUTS_CREATE,
    profile?.permissions,
  );
  const canEditOutputs = hasPermission(
    roleKeys,
    PERMISSIONS.OUTPUTS_EDIT,
    profile?.permissions,
  );
  const canDeleteOutputs = hasPermission(
    roleKeys,
    PERMISSIONS.OUTPUTS_DELETE,
    profile?.permissions,
  );
  const canExportOutputs = hasPermission(
    roleKeys,
    PERMISSIONS.OUTPUTS_VIEW,
    profile?.permissions,
  );
  const isCenterChief =
    profile?.is_center_chief === true && Boolean(profile?.managed_center_id);
  const hasOrgId = String(profile?.ckan_org_id || "").trim();
  const canLoadOwnOutputs = isAdmin || Boolean(hasOrgId);
  const missingAffiliation = !canLoadOwnOutputs && !isCenterChief;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [centerChiefOutputs, setCenterChiefOutputs] = useState([]);
  const [centerChiefLoading, setCenterChiefLoading] = useState(false);
  const [centerChiefError, setCenterChiefError] = useState("");
  const [centerChiefPage, setCenterChiefPage] = useState(1);
  const [centerChiefSearch, setCenterChiefSearch] = useState("");
  const [centerChiefQuickFilter, setCenterChiefQuickFilter] = useState("all");
  const [recordsQuickFilter, setRecordsQuickFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingTarget, setEditingTarget] = useState(null);
  const [editForm, setEditForm] = useState({
    file_name: "",
    notes: "",
    file_path: "",
    mime_type: "",
    file_size: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingByResource, setDeletingByResource] = useState({});
  const [visibilitySavingByDataset, setVisibilitySavingByDataset] = useState(
    {},
  );
  const [showAddOutputModal, setShowAddOutputModal] = useState(false);
  const [projectOptions, setProjectOptions] = useState([]);
  const [addingOutput, setAddingOutput] = useState(false);
  const [exportingType, setExportingType] = useState("");
  const [activeTab, setActiveTab] = useState("records");
  const [addOutputForm, setAddOutputForm] = useState({
    project_id: "",
    output_type: "",
    specific_output: "",
    target_count: 1,
    notes: "",
  });
  const [addOutputFile, setAddOutputFile] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const DIRECTORY_SKELETON_COUNT = 6;
  const pageSize = 10;

  const getVisibilityBadgeClass = (isPrivate) =>
    isPrivate
      ? "border-slate-200 bg-slate-50 text-slate-800"
      : "border-slate-200 bg-slate-50 text-slate-800";

  const hasActiveRecordsFilters = useMemo(() => {
    const searchActive = String(searchTerm || "").trim().length > 0;
    const quickActive = recordsQuickFilter !== "all";
    return searchActive || quickActive;
  }, [recordsQuickFilter, searchTerm]);

  const resetRecordsFilters = () => {
    setRecordsQuickFilter("all");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const hasActiveCenterChiefFilters = useMemo(() => {
    const searchActive = String(centerChiefSearch || "").trim().length > 0;
    const quickActive = centerChiefQuickFilter !== "all";
    return searchActive || quickActive;
  }, [centerChiefQuickFilter, centerChiefSearch]);

  const resetCenterChiefFilters = () => {
    setCenterChiefQuickFilter("all");
    setCenterChiefSearch("");
    setCenterChiefPage(1);
  };

  const goToOutputProject = (row) => {
    const datasetId = String(row?.datasetId || "").trim();
    if (!datasetId) {
      toast.error("Unable to open project", "Dataset id is missing.");
      return;
    }
    navigate(`/projects/${encodeURIComponent(datasetId)}`);
  };
  const openAddOutputForProject = (project, options = {}) => {
    const projectId = String(project?.id || "").trim();
    if (!projectId) {
      toast.error("Unable to add output", "Project id is missing.");
      return;
    }
    const outputType = String(options?.output_type || "").trim();
    const targetCount = Number(options?.target_count || 0);
    setAddOutputForm((prev) => ({
      ...prev,
      project_id: projectId,
      output_type: outputType || prev.output_type,
      target_count: targetCount > 0 ? targetCount : prev.target_count,
    }));
    setAddOutputFile(null);
    setShowAddOutputModal(true);
  };

  useEffect(() => {
    if (!error) return;
    toast.error("Research output load failed", error);
  }, [error, toast]);

  useEffect(() => {
    if (!canLoadOwnOutputs) {
      setRows([]);
      setLoading(false);
      return () => {};
    }
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const payload = await fetchMyResearchOutputs();
        if (import.meta.env.DEV) {
          const dataRows = Array.isArray(payload?.data) ? payload.data : [];
          const missingOutputType = dataRows.filter(
            (row) => !String(row?.output_type || "").trim(),
          );
          if (missingOutputType.length) {
            console.warn(
              "[ResearchOutputs] Missing output_type in API rows:",
              missingOutputType.slice(0, 5),
            );
          }
        }
        if (!cancelled) {
          setRows(Array.isArray(payload?.data) ? payload.data : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            String(e?.message || "Unable to load research output resources."),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [canLoadOwnOutputs, profile?.id]);

  useEffect(() => {
    if (!canLoadOwnOutputs) {
      setProjectOptions([]);
      return;
    }
    let cancelled = false;
    fetchUserProjects({ userId: profile?.id })
      .then(({ data }) => {
        if (cancelled) return;
        setProjectOptions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setProjectOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canLoadOwnOutputs, profile?.id]);

  useEffect(() => {
    if (!isCenterChief) {
      setCenterChiefOutputs([]);
      setCenterChiefLoading(false);
      setCenterChiefError("");
      return () => {};
    }

    let cancelled = false;
    const load = async () => {
      try {
        setCenterChiefLoading(true);
        setCenterChiefError("");
        const payload = await fetchCenterChiefResearchOutputs();
        if (!cancelled) {
          setCenterChiefOutputs(
            Array.isArray(payload?.data) ? payload.data : [],
          );
        }
      } catch (e) {
        if (!cancelled) {
          setCenterChiefError(
            String(
              e?.message ||
                "Unable to load research outputs for the managed center.",
            ),
          );
        }
      } finally {
        if (!cancelled) setCenterChiefLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isCenterChief, profile?.id]);

  const missingAffiliationContent = (
    <section className="page-stack-lg">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="relative space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Research Outputs
          </p>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
            Complete Your Profile First
          </h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Add your organization (research center) before managing research
            outputs.
          </p>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-3 p-5">
          <p className="text-sm text-slate-900">
            Please set your Organization (Research Center) in My Profile first
            before accessing Research Outputs.
          </p>
          <Button
            asChild
            variant="outline"
            className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            <Link to="/profile">Go to My Profile</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );

  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          new Date(
            b?.updated_at || b?.created_at || b?.ckan_last_synced_at || 0,
          ).getTime() -
          new Date(
            a?.updated_at || a?.created_at || a?.ckan_last_synced_at || 0,
          ).getTime(),
      ),
    [rows],
  );

  const centerNameById = useMemo(
    () =>
      (centers || []).reduce((acc, center) => {
        const id = String(center?.id || "").trim();
        if (!id) return acc;
        acc[id] = String(center?.name || "").trim() || id;
        return acc;
      }, {}),
    [centers],
  );

  const outputTypeLabelByValue = useMemo(
    () =>
      (EXPECTED_OUTPUT_TYPE_OPTIONS || []).reduce((acc, item) => {
        const key = String(item?.value || "").trim();
        if (!key) return acc;
        let label = String(item?.label || "").trim();
        if (key === "patent_ip") label = "Patent/IP";
        acc[key] = label || key;
        return acc;
      }, {}),
    [],
  );

  const normalizeResourceName = useMemo(
    () => (value) => {
      const raw = String(value || "").trim();
      if (!raw) return "";

      const targetMatch = raw.match(/^(.+?)\s*\(Target:\s*\d+\)\s*$/i);
      const base = String(targetMatch?.[1] || raw).trim();
      const key = base.toLowerCase().replace(/\s+/g, "_");

      if (outputTypeLabelByValue[key]) return outputTypeLabelByValue[key];
      return base;
    },
    [outputTypeLabelByValue],
  );

  const mapOutputRow = useMemo(
    () => (row) => {
      const outputTypeRaw = String(row?.output_type || "").trim();
      const outputType = outputTypeLabelByValue[outputTypeRaw] || "-";
      const orgRef = String(row?.project_ckan_org_id || "").trim();
      const orgLabel =
        String(row?.project_org_name || "").trim() ||
        centerNameById[orgRef] ||
        orgRef ||
        "-";
      const rawFileName = String(row?.file_name || "").trim();
      const resourceName = normalizeResourceName(rawFileName);
      const targetMatch = rawFileName.match(/\(target:\s*(\d+)\)/i);
      const targetCount = Math.max(1, Number(targetMatch?.[1] || 1) || 1);
      const projectTitle = String(row?.project_title || "").trim();
      const datasetName =
        String(row?.ckan_dataset_name || "").trim() ||
        String(row?.ckan_dataset_id || "").trim() ||
        "-";
      const resourceUrl = String(row?.file_path || "").trim();
      const resourceMime = String(row?.mime_type || "").trim();
      const resourceSize = Number(row?.file_size || 0) || null;
      const isFallbackUrl = /\/dataset\/?$/.test(resourceUrl);
      const isPendingOutput = isFallbackUrl && !resourceSize && !resourceMime;

      return {
        id: row.id,
        title:
          resourceName ||
          [projectTitle, outputType].filter(Boolean).join(" - ") ||
          "Expected output file",
        subtitle: projectTitle || null,
        datasetName,
        datasetId: row?.ckan_dataset_id || null,
        resourceId: row?.ckan_resource_id || null,
        outputType,
        outputTypeValue: outputTypeRaw || "",
        targetCount,
        resourceUrl: resourceUrl || null,
        mimeType: resourceMime || null,
        fileSize: resourceSize,
        notes: row?.notes || null,
        organization: orgLabel,
        private: !row?.project_public_visible,
        state: row?.ckan_sync_status || row?.project_status || "-",
        metadataModified:
          row?.updated_at || row?.created_at || row?.ckan_last_synced_at,
        isPendingOutput,
      };
    },
    [centerNameById, normalizeResourceName, outputTypeLabelByValue],
  );

  const baseRows = useMemo(
    () => sortedRows.map(mapOutputRow),
    [mapOutputRow, sortedRows],
  );
  const sortedCenterChiefRows = useMemo(
    () =>
      [...centerChiefOutputs].sort(
        (a, b) =>
          new Date(
            b?.updated_at || b?.created_at || b?.ckan_last_synced_at || 0,
          ).getTime() -
          new Date(
            a?.updated_at || a?.created_at || a?.ckan_last_synced_at || 0,
          ).getTime(),
      ),
    [centerChiefOutputs],
  );
  const centerChiefRows = useMemo(
    () => sortedCenterChiefRows.map(mapOutputRow),
    [mapOutputRow, sortedCenterChiefRows],
  );
  const baseCenterChiefSearchRows = useMemo(() => {
    const query = String(centerChiefSearch || "")
      .trim()
      .toLowerCase();
    return centerChiefRows.filter((row) => {
      const haystack = [
        row.title,
        row.subtitle,
        row.datasetName,
        row.organization,
        row.outputType,
        row.state,
        row.private ? "private" : "public",
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return query ? haystack.includes(query) : true;
    });
  }, [centerChiefRows, centerChiefSearch]);
  const centerChiefFilteredRows = useMemo(() => {
    if (centerChiefQuickFilter === "all") return baseCenterChiefSearchRows;
    return baseCenterChiefSearchRows.filter(
      (row) =>
        String(row?.outputTypeValue || "").trim() === centerChiefQuickFilter,
    );
  }, [baseCenterChiefSearchRows, centerChiefQuickFilter]);
  const pendingOutputRows = useMemo(() => {
    const expectedByKey = new Map();
    const uploadedCountByKey = new Map();
    const projectMetaById = new Map();

    baseRows.forEach((row) => {
      const datasetId = String(row?.datasetId || "").trim();
      if (!datasetId) return;
      const outputTypeValue = String(row?.outputTypeValue || "").trim();
      const key = `${datasetId}|${outputTypeValue}`;
      const currentExpected = expectedByKey.get(key) || 0;
      expectedByKey.set(key, Math.max(currentExpected, row.targetCount || 1));

      if (!projectMetaById.has(datasetId)) {
        projectMetaById.set(datasetId, {
          title: row.subtitle || row.datasetName || datasetId,
          datasetName: row.datasetName || row.subtitle || datasetId,
          organization: row.organization || "-",
          private: row.private,
          metadataModified: row.metadataModified,
        });
      }

      if (!row.isPendingOutput) {
        uploadedCountByKey.set(key, (uploadedCountByKey.get(key) || 0) + 1);
      }
    });

    const rows = [];
    expectedByKey.forEach((expectedTarget, key) => {
      const [datasetId, outputTypeValue] = key.split("|");
      if (!datasetId) return;
      const uploadedCount = uploadedCountByKey.get(key) || 0;
      if (expectedTarget - uploadedCount <= 0) return;

      const label =
        outputTypeLabelByValue[outputTypeValue] ||
        String(outputTypeValue || "").replace(/_/g, "/") ||
        "-";
      const meta = projectMetaById.get(datasetId) || {};
      rows.push({
        id: `pending-${datasetId}-${outputTypeValue || "output"}`,
        title: `${label} (Pending)`,
        subtitle: meta.title || datasetId,
        datasetName: meta.datasetName || meta.title || datasetId,
        datasetId,
        resourceId: null,
        outputType: label,
        outputTypeValue,
        targetCount: expectedTarget,
        resourceUrl: null,
        mimeType: null,
        fileSize: null,
        notes: null,
        organization: meta.organization || "-",
        private: Boolean(meta.private),
        state: "No file",
        metadataModified: meta.metadataModified || null,
        isPendingOutput: true,
        isPlaceholder: false,
        projectTitle: meta.title || datasetId,
      });
    });

    return rows;
  }, [baseRows, outputTypeLabelByValue]);
  const actualOutputRows = useMemo(
    () => baseRows.filter((row) => !row.isPendingOutput),
    [baseRows],
  );
  const placeholderRows = useMemo(() => {
    const projectsWithExpected = new Set(
      pendingOutputRows.map((row) => String(row?.datasetId || "").trim()),
    );
    const withOutputs = new Set(
      actualOutputRows
        .map((row) => String(row?.datasetId || "").trim())
        .filter(Boolean),
    );
    return (projectOptions || [])
      .map((project) => {
        const id = String(project?.id || "").trim();
        if (!id || withOutputs.has(id) || projectsWithExpected.has(id)) {
          return null;
        }
        return {
          id: `placeholder-${id}`,
          title: "Pending Output",
          subtitle: String(project?.title || "").trim() || id,
          datasetName: String(project?.title || "").trim() || id,
          datasetId: id,
          resourceId: null,
          outputType: "-",
          resourceUrl: null,
          mimeType: null,
          fileSize: null,
          notes: null,
          organization:
            String(project?.research_center_name || "").trim() ||
            String(project?.project_org_name || "").trim() ||
            centerNameById[String(project?.project_ckan_org_id || "").trim()] ||
            centerNameById[String(project?.research_center_id || "").trim()] ||
            "-",
          private: Boolean(project?.private),
          state: "No file",
          metadataModified:
            project?.updated_at || project?.created_at || project?.submitted_at,
          isPlaceholder: true,
          projectTitle: String(project?.title || "").trim() || id,
        };
      })
      .filter(Boolean);
  }, [actualOutputRows, centerNameById, pendingOutputRows, projectOptions]);
  const tableRows = useMemo(
    () => [...actualOutputRows, ...pendingOutputRows, ...placeholderRows],
    [actualOutputRows, pendingOutputRows, placeholderRows],
  );

  const projectOptionsFromRows = useMemo(() => {
    const seen = new Set();
    const items = [];
    for (const row of tableRows) {
      const id = String(row?.datasetId || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      items.push({
        id,
        title: String(row?.subtitle || row?.datasetName || "").trim() || id,
      });
    }
    return items;
  }, [tableRows]);

  const mergedProjectOptions = useMemo(() => {
    const byId = new Map();
    [...projectOptions, ...projectOptionsFromRows].forEach((project) => {
      const id = String(project?.id || "").trim();
      if (!id) return;
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          title: String(project?.title || "").trim() || id,
        });
      }
    });
    return Array.from(byId.values());
  }, [projectOptions, projectOptionsFromRows]);

  const baseSearchRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return tableRows.filter((row) => {
      const haystack = [
        row.title,
        row.subtitle,
        row.datasetName,
        row.organization,
        row.resourceId,
        row.state,
        row.private ? "private" : "public",
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return query ? haystack.includes(query) : true;
    });
  }, [searchTerm, tableRows]);
  const filteredRows = useMemo(() => {
    if (recordsQuickFilter === "all") return baseSearchRows;
    return baseSearchRows.filter(
      (row) => String(row?.outputTypeValue || "").trim() === recordsQuickFilter,
    );
  }, [baseSearchRows, recordsQuickFilter]);

  const analytics = useMemo(() => {
    const linkedProjectIds = new Set();
    const base = {
      total: tableRows.length,
      public: 0,
      private: 0,
      linkedProjects: 0,
    };

    tableRows.forEach((row) => {
      if (row.private) {
        base.private += 1;
      } else {
        base.public += 1;
      }

      const projectKey = String(row?.subtitle || row?.datasetId || "").trim();
      if (!projectKey) return;
      linkedProjectIds.add(projectKey);
    });

    base.linkedProjects = linkedProjectIds.size;
    return base;
  }, [tableRows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [recordsQuickFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [currentPage, filteredRows]);

  const centerChiefTotalPages = useMemo(
    () => Math.max(1, Math.ceil(centerChiefFilteredRows.length / pageSize)),
    [centerChiefFilteredRows.length, pageSize],
  );

  useEffect(() => {
    setCenterChiefPage(1);
  }, [centerChiefRows.length, centerChiefSearch, centerChiefQuickFilter]);

  useEffect(() => {
    setCenterChiefPage((prev) => Math.min(prev, centerChiefTotalPages));
  }, [centerChiefTotalPages]);

  const centerChiefPaginatedRows = useMemo(() => {
    const start = (centerChiefPage - 1) * pageSize;
    return centerChiefFilteredRows.slice(start, start + pageSize);
  }, [centerChiefPage, centerChiefFilteredRows, pageSize]);

  const sanitizeDigits = (value) => String(value || "").replace(/[^\d]/g, "");

  const formatFileSize = (bytes) => {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value <= 0) return "-";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
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
    filteredRows.map((row, index) => ({
      no: index + 1,
      resource: row.title || "-",
      outputType: row.outputType || "-",
      project: row.subtitle || "-",
      dataset: row.datasetName || "-",
      researchCenter: row.organization || "-",
      visibility: row.private ? "Private" : "Public",
      state: row.state || "-",
      updated: row.metadataModified
        ? new Date(row.metadataModified).toLocaleString()
        : "-",
    }));

  const exportAsCsv = () => {
    if (!filteredRows.length) return;
    setExportingType("csv");
    try {
      const headers = [
        "No.",
        "Resource/File",
        "Output Type",
        "Project",
        "Dataset",
        "Research Center",
        "Visibility",
        "State",
        "Updated",
      ];
      const lines = buildExportRows().map((row) =>
        [
          row.no,
          row.resource,
          row.outputType,
          row.project,
          row.dataset,
          row.researchCenter,
          row.visibility,
          row.state,
          row.updated,
        ]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(","),
      );
      const csv = [headers.join(","), ...lines].join("\n");
      triggerDownload(
        `research-outputs-${new Date().toISOString().slice(0, 10)}.csv`,
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
      const rowsForExport = buildExportRows();
      const rowsHtml = rowsForExport
        .map(
          (row) => `
            <tr>
              <td>${row.no}</td>
              <td>${row.resource}</td>
              <td>${row.outputType}</td>
              <td>${row.project}</td>
              <td>${row.dataset}</td>
              <td>${row.researchCenter}</td>
              <td>${row.visibility}</td>
              <td>${row.state}</td>
              <td>${row.updated}</td>
            </tr>
          `,
        )
        .join("");

      const printWindow = window.open("", "_blank", "width=1200,height=800");
      if (!printWindow) {
        toast.error(
          "Export failed",
          "Unable to open print window for PDF export.",
        );
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>research-output-records-filtered</title>
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
            <h1>Research Output Records Report</h1>
            <p>Generated: ${timestamp} | Scope: filtered | Rows: ${rowsForExport.length}</p>
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Resource/File</th>
                  <th>Output Type</th>
                  <th>Project</th>
                  <th>Dataset</th>
                  <th>Research Center</th>
                  <th>Visibility</th>
                  <th>State</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="9">No records found.</td></tr>'}
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

  const handleToggleVisibility = async (row) => {
    const datasetId = String(row?.datasetId || "").trim();
    if (!datasetId) {
      toast.error("Visibility update failed", "Dataset id is missing.");
      return;
    }

    const nextIsPublic = Boolean(row?.private);
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
      toast.error(
        "Visibility update failed",
        String(updateError?.message || "Unable to update visibility."),
      );
      return;
    }

    const isNowPublic = Boolean(data?.project_public_visible);
    setRows((prev) =>
      prev.map((item) =>
        String(item?.ckan_dataset_id || "").trim() === datasetId
          ? { ...item, project_public_visible: isNowPublic }
          : item,
      ),
    );

    toast.success(
      "Visibility updated",
      isNowPublic ? "Dataset is now public." : "Dataset is now private.",
    );
  };

  const handleOpenEdit = (row) => {
    setEditingTarget(row);
    setEditForm({
      file_name: String(row?.title || "").trim(),
      notes: String(row?.notes || "").trim(),
      file_path: String(row?.resourceUrl || "").trim(),
      mime_type: String(row?.mimeType || "").trim(),
      file_size:
        Number(row?.fileSize || 0) > 0 ? String(Number(row.fileSize)) : "",
    });
  };

  const handleSaveEdit = async () => {
    const resourceId = String(editingTarget?.resourceId || "").trim();
    if (!resourceId) {
      toast.error("Edit failed", "Resource id is missing.");
      return;
    }

    const payload = {
      file_name: String(editForm.file_name || "").trim(),
      notes: String(editForm.notes || "").trim(),
      // File uploads should create real CKAN resources via Add Output.
      // Prevent editing file_path here to avoid non-file placeholder URLs.
      mime_type: String(editForm.mime_type || "").trim(),
    };

    const sizeRaw = String(editForm.file_size || "").trim();
    if (sizeRaw) {
      const parsedSize = Number(sizeRaw);
      if (!Number.isFinite(parsedSize) || parsedSize < 0) {
        toast.error(
          "Edit failed",
          "File size must be a valid non-negative number.",
        );
        return;
      }
      payload.file_size = parsedSize;
    }

    setEditSaving(true);
    const { data, error: updateError } = await updateResearchOutput({
      resourceId,
      payload,
    });
    setEditSaving(false);

    if (updateError) {
      toast.error(
        "Edit failed",
        String(updateError?.message || "Unable to update resource."),
      );
      return;
    }

    const nextFileName = String(
      data?.file_name || payload.file_name || "",
    ).trim();
    const nextNotes = data?.notes ?? payload.notes ?? null;
    const nextPath = data?.file_path ?? payload.file_path ?? null;
    const nextMime = data?.mime_type ?? payload.mime_type ?? null;
    const nextSize =
      data?.file_size != null
        ? Number(data.file_size) || null
        : payload.file_size != null
          ? Number(payload.file_size) || null
          : null;
    const nextUpdatedAt = data?.updated_at || new Date().toISOString();

    setRows((prev) =>
      prev.map((item) =>
        String(item?.ckan_resource_id || "").trim() === resourceId
          ? {
              ...item,
              file_name: nextFileName || item.file_name,
              notes: nextNotes,
              file_path: nextPath,
              mime_type: nextMime,
              file_size: nextSize,
              updated_at: nextUpdatedAt,
            }
          : item,
      ),
    );

    setEditingTarget(null);
    toast.success("Research output updated", "Changes were saved.");
  };

  const handleDeleteResource = async (row) => {
    const resourceId = String(row?.resourceId || "").trim();
    if (!resourceId) {
      toast.error("Delete failed", "Resource id is missing.");
      return;
    }

    setDeletingByResource((prev) => ({ ...prev, [resourceId]: true }));
    const { error: deleteError } = await deleteResearchOutput({ resourceId });
    setDeletingByResource((prev) => {
      const next = { ...prev };
      delete next[resourceId];
      return next;
    });

    if (deleteError) {
      toast.error(
        "Delete failed",
        String(deleteError?.message || "Unable to delete resource."),
      );
      return;
    }

    setRows((prev) =>
      prev.filter(
        (item) => String(item?.ckan_resource_id || "").trim() !== resourceId,
      ),
    );
    setEditingTarget((prev) =>
      String(prev?.resourceId || "").trim() === resourceId ? null : prev,
    );
    setDeleteTarget(null);

    toast.success("Research output deleted", "Resource was removed.");
  };

  const openAddOutputModal = () => {
    setAddOutputForm({
      project_id: "",
      output_type: "",
      specific_output: "",
      target_count: 1,
      notes: "",
    });
    setAddOutputFile(null);
    setShowAddOutputModal(true);
  };

  const handleCreateOutput = async () => {
    const projectId = String(addOutputForm.project_id || "").trim();
    const outputType = String(addOutputForm.output_type || "").trim();
    const specificOutput = String(addOutputForm.specific_output || "").trim();
    const targetCount = Math.max(
      1,
      Number(addOutputForm.target_count || 1) || 1,
    );
    const notes = String(addOutputForm.notes || "").trim();

    if (!projectId) {
      toast.error("Add output failed", "Please select a project.");
      return;
    }
    if (!outputType) {
      toast.error("Add output failed", "Please select an output type.");
      return;
    }
    if (outputType === "product_software" && !specificOutput) {
      toast.error(
        "Add output failed",
        "Specific output is required for Product/Software Application.",
      );
      return;
    }

    const fullNotes =
      outputType === "product_software" && specificOutput
        ? `Specific output: ${specificOutput}${notes ? `\n${notes}` : ""}`
        : notes;
    if (addOutputFile && addOutputFile.size > MAX_OUTPUT_FILE_SIZE_BYTES) {
      toast.error("Add output failed", "Output file must be 25MB or smaller.");
      return;
    }

    setAddingOutput(true);
    const { error: createError } = addOutputFile
      ? await createResearchOutputWithFile({
          projectId,
          outputType,
          targetCount,
          notes: fullNotes,
          file: addOutputFile,
        })
      : await createResearchOutput({
          projectId,
          outputType,
          targetCount,
          notes: fullNotes,
          filePath: null,
          fileName: null,
          mimeType: null,
          fileSize: null,
        });
    setAddingOutput(false);

    if (createError) {
      const rawMessage = String(
        createError?.message || "Unable to create output.",
      );
      const friendlyMessage =
        rawMessage.includes("404") ||
        rawMessage.toLowerCase().includes("not found")
          ? "Create endpoint not found. Restart backend and try again."
          : rawMessage;
      toast.error("Add output failed", friendlyMessage);
      return;
    }

    const payload = await fetchMyResearchOutputs();
    setRows(Array.isArray(payload?.data) ? payload.data : []);
    setAddOutputFile(null);
    setShowAddOutputModal(false);
    toast.success("Output added", "Research output was added successfully.");
  };

  if (missingAffiliation) {
    return missingAffiliationContent;
  }

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
                Research Outputs
              </h1>
              <p className="max-w-2xl text-sm text-slate-600">
                Upload output resources, review status, and manage visibility
                for linked research projects.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canExportOutputs ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                      disabled={!filteredRows.length || Boolean(exportingType)}
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
                      onSelect={exportAsCsv}
                      className="text-slate-700 hover:bg-slate-50 focus:bg-slate-50"
                    >
                      {exportingType === "csv" ? "Exporting..." : "Export CSV"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={exportAsPdf}
                      className="text-slate-700 hover:bg-slate-50 focus:bg-slate-50"
                    >
                      {exportingType === "pdf" ? "Exporting..." : "Export PDF"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}

              {canCreateOutputs ? (
                <Button
                  variant="mono"
                  type="button"
                  onClick={openAddOutputModal}
                >
                  Add Output
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9">
            {[
              {
                label: "Total Outputs",
                value: analytics.total,
                icon: FileText,
              },
              { label: "Public Outputs", value: analytics.public, icon: Eye },
              {
                label: "Private Outputs",
                value: analytics.private,
                icon: EyeOff,
              },
              {
                label: "Linked Projects",
                value: analytics.linkedProjects,
                icon: ExternalLink,
              },
            ].map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                    {label}
                  </p>
                  <Icon className="h-4 w-4 text-slate-700" />
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-700">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 border border-slate-200 bg-white p-1 sm:w-fit sm:grid-cols-none sm:grid-flow-col sm:gap-1">
          <TabsTrigger
            value="records"
            className="
    min-h-10 rounded-md border-slate-200
    text-slate-600
    data-[state=active]:border-emerald-600
    data-[state=active]:bg-emerald-600
    data-[state=active]:text-white
    data-[state=active]:font-semibold
    data-[state=active]:shadow-sm
  "
          >
            Research Output Records
          </TabsTrigger>
          <TabsTrigger
            value="managed"
            className="
    min-h-10 rounded-md border-slate-200
    text-slate-600
    data-[state=active]:border-emerald-600
    data-[state=active]:bg-emerald-600
    data-[state=active]:text-white
    data-[state=active]:font-semibold
    data-[state=active]:shadow-sm
  "
          >
            Managed Center Outputs
          </TabsTrigger>
        </TabsList>

        {isCenterChief ? (
          <Card
            className={cn(
              "overflow-hidden border border-slate-200 bg-white shadow-sm",
              activeTab === "managed" ? "block" : "hidden",
            )}
          >
            <CardHeader className="border-b border-slate-200 px-6 py-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold text-slate-700">
                    Managed Center Research Outputs
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Showing {centerChiefFilteredRows.length} output(s) from your
                    managed research center.
                  </CardDescription>
                </div>
                <p className="text-sm text-slate-600">
                  {centerChiefFilteredRows.length} row(s).
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
                <label className="relative block w-full md:max-w-xl">
                  <span className="sr-only">Search managed center outputs</span>
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
                  <Input
                    value={centerChiefSearch}
                    onChange={(event) =>
                      setCenterChiefSearch(event.target.value)
                    }
                    placeholder="Search file, dataset, project, center, state, or visibility"
                    className="pl-9"
                  />
                </label>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {[
                    {
                      key: "all",
                      label: "All Outputs",
                      count: baseCenterChiefSearchRows.length,
                    },
                    ...EXPECTED_OUTPUT_TYPE_OPTIONS.map((item) => {
                      const key = String(item?.value || "").trim();
                      const label =
                        outputTypeLabelByValue[key] ||
                        String(item?.label || key);
                      return {
                        key,
                        label,
                        count: baseCenterChiefSearchRows.filter(
                          (row) =>
                            String(row?.outputTypeValue || "").trim() === key,
                        ).length,
                      };
                    }),
                  ].map((chip) => (
                    <Button
                      key={chip.key}
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(
                        "rounded-full border-slate-200 px-4 text-xs",
                        centerChiefQuickFilter === chip.key
                          ? "bg-[#10B981] text-white hover:bg-[#059669]"
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
            {centerChiefLoading ? (
              <CardContent className="p-4">
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                  Loading managed center outputs...
                </div>
              </CardContent>
            ) : centerChiefError ? (
              <CardContent className="p-4">
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-800">
                  {centerChiefError}
                </div>
              </CardContent>
            ) : centerChiefRows.length === 0 ? (
              <CardContent className="p-4">
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                  No research outputs found for your managed research center.
                </div>
              </CardContent>
            ) : centerChiefFilteredRows.length === 0 ? (
              <CardContent className="p-4">
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                  No managed center outputs match your search.
                </div>
              </CardContent>
            ) : (
              <CardContent className="p-4">
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <Table className="min-w-[980px]">
                    <TableHeader className="bg-slate-50 text-slate-600">
                      <TableRow>
                        <TableHead>No.</TableHead>
                        <TableHead>Resource/File</TableHead>
                        <TableHead>Output Type</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Research Center</TableHead>
                        <TableHead>Visibility</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {centerChiefPaginatedRows.map((row, index) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            {(centerChiefPage - 1) * pageSize + index + 1}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{row.title}</div>
                            {row.subtitle ? (
                              <div className="text-xs text-slate-600">
                                {row.subtitle}
                              </div>
                            ) : null}
                            {row.isPendingOutput ? (
                              <div className="space-y-1 text-xs text-slate-800">
                                <div>No file attached yet.</div>
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>{row.outputType || "-"}</TableCell>
                          <TableCell>{row.datasetName || "-"}</TableCell>
                          <TableCell>{row.organization || "-"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={getVisibilityBadgeClass(row.private)}
                              >
                                {row.private ? "Private" : "Public"}
                              </Badge>
                              {row.isPendingOutput ? (
                                <Badge
                                  variant="outline"
                                  className="border-slate-200 bg-slate-50 text-slate-700"
                                >
                                  Pending
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                                onClick={() => goToOutputProject(row)}
                                aria-label={`Open project for ${row?.subtitle || row?.datasetName || "research output"}`}
                                title="Open project"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {!row.isPendingOutput &&
                              Boolean(row.resourceId) ? (
                                <>
                                  {canEditOutputs ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                                      onClick={() => handleOpenEdit(row)}
                                      aria-label={`Edit ${row?.title || "research output"}`}
                                      title="Edit"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                  {!row.isPendingOutput &&
                                  row.resourceId &&
                                  /\/resource\/.+\/download\//i.test(
                                    String(row.resourceUrl || ""),
                                  ) ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                                      aria-label={`Download ${row?.title || "resource"}`}
                                      title="Download"
                                      onClick={() => {
                                        const url = `${apiBaseUrl}/submissions/resources/${encodeURIComponent(
                                          row.resourceId,
                                        )}/download?download=1`;
                                        window.open(
                                          url,
                                          "_blank",
                                          "noopener,noreferrer",
                                        );
                                      }}
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                  {canDeleteOutputs ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-700 hover:bg-slate-50"
                                      onClick={() => setDeleteTarget(row)}
                                      aria-label={`Delete ${row?.title || "research output"}`}
                                      title="Delete"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    {centerChiefTotalPages > 1 ? (
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={8} className="px-3 py-3">
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

        {activeTab === "records" && canLoadOwnOutputs && loading ? (
          <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                Loading research outputs...
              </div>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "records" &&
        canLoadOwnOutputs &&
        !loading &&
        !error &&
        !tableRows.length ? (
          <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                No research outputs found. No linked expected output resources
                are available yet.
              </div>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "records" &&
        canLoadOwnOutputs &&
        !loading &&
        !error &&
        tableRows.length ? (
          <div className="page-stack">
            <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-200 px-6 py-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold text-slate-700">
                      Research Output Records
                    </CardTitle>
                    <CardDescription className="text-slate-600">
                      Showing {filteredRows.length} output(s).
                    </CardDescription>
                  </div>
                  <p className="text-sm text-slate-600">
                    {filteredRows.length} row(s).
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
                  <label className="relative block w-full md:max-w-xl">
                    <span className="sr-only">Search outputs</span>
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search file, dataset, project, center, state, or visibility"
                      className="pl-9"
                    />
                  </label>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {[
                      {
                        key: "all",
                        label: "All Outputs",
                        count: baseSearchRows.length,
                      },
                      ...EXPECTED_OUTPUT_TYPE_OPTIONS.map((item) => {
                        const key = String(item?.value || "").trim();
                        const label =
                          outputTypeLabelByValue[key] ||
                          String(item?.label || key);
                        return {
                          key,
                          label,
                          count: baseSearchRows.filter(
                            (row) =>
                              String(row?.outputTypeValue || "").trim() === key,
                          ).length,
                        };
                      }),
                    ].map((chip) => (
                      <Button
                        key={chip.key}
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(
                          "rounded-full border-slate-200 px-4 text-xs",
                          recordsQuickFilter === chip.key
                            ? "bg-[#10B981] text-white hover:bg-[#059669]"
                            : "bg-white text-slate-700 hover:bg-slate-50",
                        )}
                        onClick={() => setRecordsQuickFilter(chip.key)}
                      >
                        {chip.label}
                        <span
                          className={cn(
                            "ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            recordsQuickFilter === chip.key
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
                      onClick={resetRecordsFilters}
                    >
                      Reset all
                    </Button>
                  </div>

                  {hasActiveRecordsFilters ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                        Active Filters
                      </span>
                      {String(searchTerm || "").trim() ? (
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                          onClick={() => setSearchTerm("")}
                        >
                          Search: "{String(searchTerm || "").trim()}" x
                        </button>
                      ) : null}
                      {recordsQuickFilter !== "all" ? (
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                          onClick={() => setRecordsQuickFilter("all")}
                        >
                          {recordsQuickFilter} x
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </CardContent>
              {filteredRows.length === 0 ? (
                <CardContent className="p-4">
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                    No research outputs found. Try a different search term or
                    add a new research output.
                  </div>
                </CardContent>
              ) : (
                <CardContent className="p-4">
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <Table className="min-w-[980px]">
                      <TableHeader className="bg-slate-50 text-slate-600">
                        <TableRow>
                          <TableHead>No.</TableHead>
                          <TableHead>Resource/File</TableHead>
                          <TableHead>Output Type</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Research Center</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedRows.map((row, index) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              {(currentPage - 1) * pageSize + index + 1}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{row.title}</div>
                              {row.subtitle ? (
                                <div className="text-xs text-slate-600">
                                  {row.subtitle}
                                </div>
                              ) : null}
                              {row.isPlaceholder || row.isPendingOutput ? (
                                <div className="space-y-1 text-xs text-slate-800">
                                  <div>No file attached yet.</div>
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell>{row.outputType || "-"}</TableCell>
                            <TableCell>{row.datasetName || "-"}</TableCell>
                            <TableCell>{row.organization || "-"}</TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex items-center justify-end gap-1">
                                {canCreateOutputs &&
                                (row.isPlaceholder || row.isPendingOutput) ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                                    onClick={() =>
                                      openAddOutputForProject(
                                        {
                                          id: row.datasetId,
                                          title:
                                            row.projectTitle || row.subtitle,
                                        },
                                        row.isPlaceholder
                                          ? {}
                                          : {
                                              output_type: row.outputTypeValue,
                                              target_count: row.targetCount,
                                            },
                                      )
                                    }
                                    aria-label={`Add output for ${row?.subtitle || "project"}`}
                                    title="Add Output"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                                  onClick={() => goToOutputProject(row)}
                                  aria-label={`Open project for ${row?.subtitle || row?.datasetName || "research output"}`}
                                  title="Open project"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {!row.isPlaceholder &&
                                !row.isPendingOutput &&
                                Boolean(row.resourceId) ? (
                                  <>
                                    {canEditOutputs ? (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                                        disabled={
                                          Boolean(
                                            deletingByResource[row.resourceId],
                                          ) || row.isPlaceholder
                                        }
                                        onClick={() => handleOpenEdit(row)}
                                        aria-label={`Edit ${row?.title || "research output"}`}
                                        title={
                                          row.isPlaceholder
                                            ? "Edit unavailable"
                                            : "Edit"
                                        }
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    ) : null}
                                    {!row.isPlaceholder &&
                                    !row.isPendingOutput &&
                                    row.resourceId &&
                                    /\/resource\/.+\/download\//i.test(
                                      String(row.resourceUrl || ""),
                                    ) ? (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                                          aria-label={`Download ${row?.title || "resource"}`}
                                          title="Download"
                                          onClick={() => {
                                            const url = `${apiBaseUrl}/submissions/resources/${encodeURIComponent(
                                              row.resourceId,
                                            )}/download?download=1`;
                                            window.open(
                                              url,
                                              "_blank",
                                              "noopener,noreferrer",
                                            );
                                          }}
                                        >
                                          <Download className="h-4 w-4" />
                                        </Button>
                                      </>
                                    ) : null}
                                    {canDeleteOutputs ? (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-700 hover:bg-slate-50"
                                        disabled={
                                          Boolean(
                                            deletingByResource[row.resourceId],
                                          ) || row.isPlaceholder
                                        }
                                        onClick={() => setDeleteTarget(row)}
                                        aria-label={`Delete ${row?.title || "research output"}`}
                                        title={
                                          row.isPlaceholder
                                            ? "Delete unavailable"
                                            : deletingByResource[row.resourceId]
                                              ? "Deleting..."
                                              : "Delete"
                                        }
                                      >
                                        {deletingByResource[row.resourceId] ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-4 w-4" />
                                        )}
                                      </Button>
                                    ) : null}
                                  </>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
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
          </div>
        ) : null}
      </Tabs>

      <Dialog
        open={showAddOutputModal}
        onOpenChange={(open) => !addingOutput && setShowAddOutputModal(open)}
      >
        <DialogContent className="max-w-2xl border border-slate-200 bg-white text-slate-700">
          <DialogHeader>
            <DialogTitle>Add Output</DialogTitle>
            <DialogDescription className="text-slate-600">
              Add a new output entry to a selected research project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="space-y-2 text-sm">
              <span className="font-semibold text-slate-700">Project</span>
              <Select
                value={addOutputForm.project_id}
                onValueChange={(value) =>
                  setAddOutputForm((prev) => ({ ...prev, project_id: value }))
                }
              >
                <SelectTrigger className="border-slate-300 bg-white text-slate-700">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent className="border border-slate-200 bg-white text-slate-700">
                  {mergedProjectOptions.map((project) => (
                    <SelectItem
                      key={project.id}
                      value={project.id}
                      className="focus:bg-slate-50 focus:text-slate-700"
                    >
                      {project.title || project.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-semibold text-slate-700">Output Type</span>
              <Select
                value={addOutputForm.output_type}
                onValueChange={(value) =>
                  setAddOutputForm((prev) => ({
                    ...prev,
                    output_type: value,
                    specific_output:
                      value === "product_software" ? prev.specific_output : "",
                  }))
                }
              >
                <SelectTrigger className="border-slate-300 bg-white text-slate-700">
                  <SelectValue placeholder="Select output type" />
                </SelectTrigger>
                <SelectContent className="border border-slate-200 bg-white text-slate-700">
                  {EXPECTED_OUTPUT_TYPE_OPTIONS.map((item) => (
                    <SelectItem
                      key={item.value}
                      value={item.value}
                      className="focus:bg-slate-50 focus:text-slate-700"
                    >
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            {addOutputForm.output_type === "product_software" ? (
              <label className="space-y-2 text-sm">
                <span className="font-semibold text-slate-700">
                  Specific Output
                </span>
                <Select
                  value={addOutputForm.specific_output}
                  onValueChange={(value) =>
                    setAddOutputForm((prev) => ({
                      ...prev,
                      specific_output: value,
                    }))
                  }
                >
                  <SelectTrigger className="border-slate-300 bg-white text-slate-700">
                    <SelectValue placeholder="Select specific output" />
                  </SelectTrigger>
                  <SelectContent className="border border-slate-200 bg-white text-slate-700">
                    {PRODUCT_SOFTWARE_SPECIFIC_OUTPUT_OPTIONS.map((item) => (
                      <SelectItem
                        key={item}
                        value={item}
                        className="focus:bg-slate-50 focus:text-slate-700"
                      >
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ) : null}

            <label className="space-y-2 text-sm">
              <span className="font-semibold text-slate-700">Target Count</span>
              <Input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                pattern="[0-9]*"
                value={addOutputForm.target_count}
                onChange={(event) =>
                  setAddOutputForm((prev) => ({
                    ...prev,
                    target_count: sanitizeDigits(event.target.value),
                  }))
                }
                className="border-slate-300 bg-white text-slate-700"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-semibold text-slate-700">Notes</span>
              <textarea
                className="flex min-h-[90px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100"
                value={addOutputForm.notes}
                onChange={(event) =>
                  setAddOutputForm((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-semibold text-slate-700">
                Output file (optional)
              </span>
              <Input
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setAddOutputFile(file);
                }}
                className="border-slate-300 bg-white text-slate-700 file:border-0 file:bg-slate-50 file:text-slate-700"
              />
              <p className="text-xs text-slate-600">
                {addOutputFile
                  ? `${addOutputFile.name} (${Math.max(
                      1,
                      Math.round(addOutputFile.size / 1024),
                    )} KB)`
                  : "No file selected"}
              </p>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={addingOutput}
              onClick={() => setShowAddOutputModal(false)}
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              disabled={addingOutput}
              onClick={handleCreateOutput}
              variant="mono"
            >
              {addingOutput ? "Adding..." : "Add Output"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingTarget)}
        onOpenChange={(open) => !editSaving && !open && setEditingTarget(null)}
      >
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto border border-slate-200 bg-white text-slate-700">
          <DialogHeader>
            <DialogTitle>Edit Research Output</DialogTitle>
            <DialogDescription className="text-slate-600">
              Update the selected resource fields.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <label className="block space-y-1">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                File Name
              </span>
              <Input
                type="text"
                value={editForm.file_name}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    file_name: event.target.value,
                  }))
                }
                className="border-slate-300 bg-white text-slate-700 placeholder:text-slate-500 focus-visible:ring-emerald-100"
              />
            </label>

            <label className="block space-y-1">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Notes
              </span>
              <textarea
                value={editForm.notes}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                className="flex min-h-[90px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100"
              />
            </label>

            <label className="block space-y-1">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                File URL / Path (read-only)
              </span>
              <Input
                type="text"
                value={editForm.file_path}
                readOnly
                className="border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-600">
                To attach a new file, use Add Output.
              </p>
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  MIME Type
                </span>
                <Input
                  type="text"
                  value={editForm.mime_type}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      mime_type: event.target.value,
                    }))
                  }
                  className="border-slate-300 bg-white text-slate-700 placeholder:text-slate-500 focus-visible:ring-emerald-100"
                />
              </label>

              <label className="block space-y-1">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  File Size (bytes)
                </span>
                <Input
                  type="number"
                  min="0"
                  value={editForm.file_size}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      file_size: event.target.value,
                    }))
                  }
                  className="border-slate-300 bg-white text-slate-700 placeholder:text-slate-500 focus-visible:ring-emerald-100"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={editSaving}
              onClick={() => setEditingTarget(null)}
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              disabled={editSaving}
              onClick={handleSaveEdit}
              variant="mono"
            >
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) =>
          !deletingByResource[deleteTarget?.resourceId] &&
          !open &&
          setDeleteTarget(null)
        }
      >
        <DialogContent className="max-w-lg border border-slate-200 bg-white text-slate-700">
          <DialogHeader>
            <DialogTitle>Delete Research Output</DialogTitle>
            <DialogDescription className="text-slate-600">
              This will permanently remove the selected resource from the
              system.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium text-slate-700">
            {deleteTarget?.title || "-"}
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={Boolean(deletingByResource[deleteTarget?.resourceId])}
              onClick={() => setDeleteTarget(null)}
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={Boolean(deletingByResource[deleteTarget?.resourceId])}
              onClick={() => handleDeleteResource(deleteTarget)}
              className="bg-[#F97316] text-white hover:bg-[#EA580C]"
            >
              {deletingByResource[deleteTarget?.resourceId]
                ? "Deleting..."
                : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
