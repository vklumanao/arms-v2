import PageHeader from "@/shared/components/layout/PageHeader";
import EmptyState from "@/shared/components/feedback/EmptyState";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { useReferenceData } from "@/shared/hooks/useReferenceData";
import {
  createResearchOutput,
  createResearchOutputWithFile,
  fetchUserProjects,
  fetchMyResearchOutputs,
  deleteResearchOutput,
  updateResearchOutput,
  updateResearchOutputVisibility,
} from "@/features/submissions/services";
import { EXPECTED_OUTPUT_TYPE_OPTIONS } from "@/features/submissions/utils";
import PaginationControls from "@/shared/components/navigation/PaginationControls";
import { useToast } from "@/app/providers/ToastProvider";
import { Eye, EyeOff, FileText, Search } from "lucide-react";

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
const sanitizeDigits = (value) => String(value || "").replace(/\D+/g, "");

export default function ResearchOutputsPage() {
  const toast = useToast();
  const { profile } = useAuth();
  const { centers } = useReferenceData();
  const isAdmin = String(profile?.role || "").toLowerCase() === "admin";
  const missingAffiliation =
    !isAdmin &&
    (!String(profile?.ckan_org_id || "").trim() ||
      !String(profile?.department || "").trim());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewTarget, setViewTarget] = useState(null);
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
  const [addOutputForm, setAddOutputForm] = useState({
    project_id: "",
    output_type: "",
    specific_output: "",
    target_count: 1,
    notes: "",
  });
  const [addOutputFile, setAddOutputFile] = useState(null);
  const pageSize = 10;

  useEffect(() => {
    if (!error) return;
    toast.error("Research output load failed", error);
  }, [error, toast]);

  useEffect(() => {
    if (missingAffiliation) {
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
  }, [missingAffiliation, profile?.id]);

  useEffect(() => {
    if (missingAffiliation) {
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
  }, [missingAffiliation, profile?.id]);

  if (missingAffiliation) {
    return (
      <section className="page-stack-lg">
        <PageHeader
          title="Research Outputs"
          description={
            isAdmin
              ? "All linked resource files from submitted project datasets."
              : "Your submitted resource files from project expected outputs."
          }
        />
        <div className="panel">
          <div className="panel-body space-y-3">
            <p className="text-sm text-amber-700">
              Please set your Organization (Research Center) and Department in
              My Profile first before accessing Research Outputs.
            </p>
            <Link className="btn btn-primary" to="/my-profile">
              Go to My Profile
            </Link>
          </div>
        </div>
      </section>
    );
  }

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

  const tableRows = useMemo(
    () =>
      sortedRows.map((row) => {
        const outputTypeRaw = String(row?.output_type || "").trim();
        const outputType =
          outputTypeLabelByValue[outputTypeRaw] ||
          outputTypeRaw.replace(/_/g, "/");
        const orgRef = String(row?.project_ckan_org_id || "").trim();
        const orgLabel =
          String(row?.project_org_name || "").trim() ||
          centerNameById[orgRef] ||
          orgRef ||
          "-";
        const resourceName = normalizeResourceName(row?.file_name);
        const projectTitle = String(row?.project_title || "").trim();
        const datasetName =
          String(row?.ckan_dataset_name || "").trim() ||
          String(row?.ckan_dataset_id || "").trim() ||
          "-";

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
          outputType: outputType || "-",
          resourceUrl: row?.file_path || null,
          mimeType: row?.mime_type || null,
          fileSize: Number(row?.file_size || 0) || null,
          notes: row?.notes || null,
          organization: orgLabel,
          private: !row?.project_public_visible,
          state: row?.ckan_sync_status || row?.project_status || "-",
          metadataModified:
            row?.updated_at || row?.created_at || row?.ckan_last_synced_at,
        };
      }),
    [centerNameById, normalizeResourceName, outputTypeLabelByValue, sortedRows],
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

  const stateOptions = useMemo(
    () =>
      Array.from(
        new Set(
          tableRows
            .map((row) => String(row.state || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [tableRows],
  );

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return tableRows.filter((row) => {
      const rowState = String(row.state || "")
        .trim()
        .toLowerCase();
      const rowVisibility = row.private ? "private" : "public";
      const haystack = [
        row.title,
        row.subtitle,
        row.datasetName,
        row.organization,
        row.resourceId,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      const matchesSearch = query ? haystack.includes(query) : true;
      const matchesState =
        stateFilter === "all" ? true : rowState === stateFilter.toLowerCase();
      const matchesVisibility =
        visibilityFilter === "all" ? true : rowVisibility === visibilityFilter;

      return matchesSearch && matchesState && matchesVisibility;
    });
  }, [searchTerm, stateFilter, tableRows, visibilityFilter]);

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
  }, [searchTerm, stateFilter, visibilityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [currentPage, filteredRows]);

  const resetFilters = () => {
    setSearchTerm("");
    setStateFilter("all");
    setVisibilityFilter("all");
    setCurrentPage(1);
  };

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
              body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
              h1 { margin: 0 0 6px; font-size: 20px; }
              p { margin: 0 0 16px; color: #475569; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; }
              th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
              th { background: #f8fafc; }
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
                  <th>Project</th>
                  <th>Dataset</th>
                  <th>Research Center</th>
                  <th>Visibility</th>
                  <th>State</th>
                  <th>Updated</th>
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

    setViewTarget((prev) => {
      if (!prev) return prev;
      return String(prev?.datasetId || "").trim() === datasetId
        ? { ...prev, private: !isNowPublic }
        : prev;
    });

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
      file_path: String(editForm.file_path || "").trim(),
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

    setViewTarget((prev) => {
      if (!prev) return prev;
      if (String(prev?.resourceId || "").trim() !== resourceId) return prev;
      return {
        ...prev,
        title: nextFileName || prev.title,
        notes: nextNotes,
        resourceUrl: nextPath,
        mimeType: nextMime,
        fileSize: nextSize,
        metadataModified: nextUpdatedAt,
      };
    });

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
    setViewTarget((prev) =>
      String(prev?.resourceId || "").trim() === resourceId ? null : prev,
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

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Research Outputs"
        description={
          isAdmin
            ? "All linked resource files from submitted project datasets."
            : "Your submitted resource files from project expected outputs."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <FileText size={14} />
            Total Outputs
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.total}
          </p>
        </article>
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <Eye size={14} />
            Public Outputs
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.public}
          </p>
        </article>
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <EyeOff size={14} />
            Private Outputs
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.private}
          </p>
        </article>
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <FileText size={14} />
            Linked Projects
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {analytics.linkedProjects}
          </p>
        </article>
      </div>

      {loading ? (
        <div className="panel">
          <div className="panel-body text-sm text-slate-600">
            Loading research outputs...
          </div>
        </div>
      ) : null}

      {!loading && !error && !tableRows.length ? (
        <EmptyState
          title="No research outputs found"
          description="No linked expected output resources are available yet."
        />
      ) : null}

      {!loading && !error && tableRows.length ? (
        <div className="page-stack">
          <div className="panel overflow-hidden">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
                    Research Output Records ({filteredRows.length})
                  </h2>
                  <label className="relative min-w-[16rem] flex-1 md:max-w-[24rem]">
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search file, dataset, project, org..."
                      className="control-input pl-8"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin ? (
                    <>
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
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={openAddOutputModal}
                  >
                    Add Output
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[11rem_11rem]">
                <select
                  value={stateFilter}
                  onChange={(event) => setStateFilter(event.target.value)}
                  className="control-select"
                >
                  <option value="all">Filter by state</option>
                  {stateOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>

                <select
                  value={visibilityFilter}
                  onChange={(event) => setVisibilityFilter(event.target.value)}
                  className="control-select"
                >
                  <option value="all">Filter by visibility</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="btn btn-outline"
                >
                  Reset
                </button>
                <p className="text-sm text-slate-600">
                  Showing{" "}
                  <span className="font-semibold">{filteredRows.length}</span>{" "}
                  output(s).
                </p>
              </div>
            </div>
            {filteredRows.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No research outputs found"
                  description="Try adjusting your filters or add a new research output."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Resource/File</th>
                      <th>Project</th>
                      <th>Research Center</th>
                      <th>Visibility</th>
                      <th>Updated</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {paginatedRows.map((row, index) => (
                      <tr key={row.id}>
                        <td>{(currentPage - 1) * pageSize + index + 1}</td>
                        <td>
                          <div className="font-medium">{row.title}</div>
                          {row.subtitle ? (
                            <div className="text-xs text-slate-500">
                              {row.subtitle}
                            </div>
                          ) : null}
                        </td>
                        <td>{row.datasetName || "-"}</td>
                        <td>{row.organization || "-"}</td>
                        <td>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`status-chip ${row.private ? "status-rejected" : "status-completed"}`}
                            >
                              {row.private ? "Private" : "Public"}
                            </span>
                            {isAdmin ? (
                              <button
                                type="button"
                                className="btn btn-outline"
                                disabled={
                                  !row.datasetId ||
                                  Boolean(
                                    visibilitySavingByDataset[row.datasetId],
                                  )
                                }
                                onClick={() => handleToggleVisibility(row)}
                              >
                                {visibilitySavingByDataset[row.datasetId]
                                  ? "Saving..."
                                  : row.private
                                    ? "Make Public"
                                    : "Make Private"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          {row.metadataModified
                            ? new Date(row.metadataModified).toLocaleString()
                            : "-"}
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => setViewTarget(row)}
                            >
                              View Details
                            </button>
                            {isAdmin ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  disabled={Boolean(
                                    deletingByResource[row.resourceId],
                                  )}
                                  onClick={() => handleOpenEdit(row)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger"
                                  disabled={Boolean(
                                    deletingByResource[row.resourceId],
                                  )}
                                  onClick={() => setDeleteTarget(row)}
                                >
                                  {deletingByResource[row.resourceId]
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {filteredRows.length ? (
            <PaginationControls
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          ) : null}
        </div>
      ) : null}

      {showAddOutputModal ? (
        <div
          className="modal-overlay modal-overlay-centered"
          onClick={() => !addingOutput && setShowAddOutputModal(false)}
        >
          <aside
            className="modal-dialog max-w-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="app-card">
              <h2 className="text-lg font-semibold text-slate-900">
                Add Output
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Add a new output entry to a selected research project.
              </p>
              <div className="mt-4 grid gap-3">
                <label className="block space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Project</span>
                  <select
                    className="control-select"
                    value={addOutputForm.project_id}
                    onChange={(event) =>
                      setAddOutputForm((prev) => ({
                        ...prev,
                        project_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select project</option>
                    {mergedProjectOptions.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title || project.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Output Type
                  </span>
                  <select
                    className="control-select"
                    value={addOutputForm.output_type}
                    onChange={(event) =>
                      setAddOutputForm((prev) => ({
                        ...prev,
                        output_type: event.target.value,
                        specific_output:
                          event.target.value === "product_software"
                            ? prev.specific_output
                            : "",
                      }))
                    }
                  >
                    <option value="">Select output type</option>
                    {EXPECTED_OUTPUT_TYPE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                {addOutputForm.output_type === "product_software" ? (
                  <label className="block space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">
                      Specific Output
                    </span>
                    <select
                      className="control-select"
                      value={addOutputForm.specific_output}
                      onChange={(event) =>
                        setAddOutputForm((prev) => ({
                          ...prev,
                          specific_output: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select specific output</option>
                      {PRODUCT_SOFTWARE_SPECIFIC_OUTPUT_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label className="block space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Target Count
                  </span>
                  <input
                    className="control-input"
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
                  />
                </label>

                <label className="block space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Notes</span>
                  <textarea
                    className="control-input min-h-[90px]"
                    value={addOutputForm.notes}
                    onChange={(event) =>
                      setAddOutputForm((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="block space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Output file (optional)
                  </span>
                  <input
                    className="control-input"
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setAddOutputFile(file);
                    }}
                  />
                  <p className="text-xs text-slate-500">
                    {addOutputFile
                      ? `${addOutputFile.name} (${Math.max(
                          1,
                          Math.round(addOutputFile.size / 1024),
                        )} KB)`
                      : "No file selected"}
                  </p>
                </label>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={addingOutput}
                  onClick={() => setShowAddOutputModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={addingOutput}
                  onClick={handleCreateOutput}
                >
                  {addingOutput ? "Adding..." : "Add Output"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {viewTarget ? (
        <div
          className="modal-overlay modal-overlay-centered"
          onClick={() => setViewTarget(null)}
        >
          <aside
            className="modal-dialog modal-dialog-3xl max-h-[92vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-white pb-4">
              <div className="app-card app-card-compact">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                      Resource Details
                    </p>
                    <h2 className="mt-1 break-words text-2xl font-semibold text-slate-900">
                      {viewTarget.title || "-"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {viewTarget.subtitle || "No linked project title"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {viewTarget.resourceUrl ? (
                      <a
                        className="btn btn-outline"
                        href={viewTarget.resourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open Resource
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setViewTarget(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="status-chip status-ongoing">
                    {viewTarget.outputType || "-"}
                  </span>
                  <span
                    className={`status-chip ${viewTarget.private ? "status-rejected" : "status-completed"}`}
                  >
                    {viewTarget.private ? "Private" : "Public"}
                  </span>
                  <span className="status-chip status-proposal">
                    {viewTarget.state || "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="app-card">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                  File Information
                </p>
                <div className="mt-3 grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="app-card-muted app-card-micro">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        File Size
                      </p>
                      <p className="text-base font-semibold text-slate-800">
                        {formatFileSize(viewTarget.fileSize)}
                      </p>
                    </div>
                    <div className="app-card-muted app-card-micro">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        MIME Type
                      </p>
                      <p className="break-words text-base font-semibold text-slate-800">
                        {viewTarget.mimeType || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="app-card-muted app-card-micro">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Notes
                    </p>
                    <p className="text-base text-slate-800">
                      {viewTarget.notes || "-"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="app-card">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                  Project Context
                </p>
                <div className="mt-3 grid gap-3">
                  <div className="app-card-muted app-card-micro">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Organization
                    </p>
                    <p className="text-base font-semibold text-slate-800">
                      {viewTarget.organization || "-"}
                    </p>
                  </div>
                  <div className="app-card-muted app-card-micro">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Dataset
                    </p>
                    <p className="break-words text-base font-semibold text-slate-800">
                      {viewTarget.datasetName || "-"}
                    </p>
                  </div>
                  <div className="app-card-muted app-card-micro">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Last Updated
                    </p>
                    <p className="text-base font-semibold text-slate-800">
                      {viewTarget.metadataModified
                        ? new Date(viewTarget.metadataModified).toLocaleString()
                        : "-"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="app-card lg:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                  Technical IDs
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="app-card-muted app-card-micro">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Dataset ID
                    </p>
                    <p className="break-all text-sm font-semibold text-slate-800">
                      {viewTarget.datasetId || "-"}
                    </p>
                  </div>
                  <div className="app-card-muted app-card-micro">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Resource ID
                    </p>
                    <p className="break-all text-sm font-semibold text-slate-800">
                      {viewTarget.resourceId || "-"}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </div>
      ) : null}

      {editingTarget ? (
        <div
          className="modal-overlay modal-overlay-centered"
          onClick={() => !editSaving && setEditingTarget(null)}
        >
          <aside
            className="modal-dialog modal-dialog-xl max-h-[92vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="app-card">
              <h2 className="text-lg font-semibold text-slate-900">
                Edit Research Output
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Update the selected resource fields.
              </p>

              <div className="mt-4 grid gap-3">
                <label className="block space-y-1">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    File Name
                  </span>
                  <input
                    type="text"
                    value={editForm.file_name}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        file_name: event.target.value,
                      }))
                    }
                    className="control-input"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                    className="control-input min-h-[90px]"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    File URL / Path
                  </span>
                  <input
                    type="text"
                    value={editForm.file_path}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        file_path: event.target.value,
                      }))
                    }
                    className="control-input"
                  />
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      MIME Type
                    </span>
                    <input
                      type="text"
                      value={editForm.mime_type}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          mime_type: event.target.value,
                        }))
                      }
                      className="control-input"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      File Size (bytes)
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={editForm.file_size}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          file_size: event.target.value,
                        }))
                      }
                      className="control-input"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={editSaving}
                  onClick={() => setEditingTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={editSaving}
                  onClick={handleSaveEdit}
                >
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="modal-overlay modal-overlay-centered"
          onClick={() =>
            !deletingByResource[deleteTarget.resourceId] &&
            setDeleteTarget(null)
          }
        >
          <aside
            className="modal-dialog max-w-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="app-card">
              <h2 className="text-lg font-semibold text-slate-900">
                Delete Research Output
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                This will permanently remove the selected resource from CKAN.
              </p>
              <p className="mt-2 text-sm font-medium text-slate-800">
                {deleteTarget.title || "-"}
              </p>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={Boolean(
                    deletingByResource[deleteTarget.resourceId],
                  )}
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={Boolean(
                    deletingByResource[deleteTarget.resourceId],
                  )}
                  onClick={() => handleDeleteResource(deleteTarget)}
                >
                  {deletingByResource[deleteTarget.resourceId]
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
