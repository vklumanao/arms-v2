import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";
import PaginationControls from "@/components/navigation/PaginationControls";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import {
  deleteReference,
  createReference,
  fetchReferenceData,
  fetchReferenceLinks,
  fetchReferenceUsageCounts,
  updateReference,
} from "@/services/admin";
import { validateCenterForm } from "@/utils/admin";

const INITIAL_FILTERS = {
  search: "",
};
const INITIAL_MEMBER_FILTERS = {
  search: "",
  role: "all",
  department: "all",
  status: "all",
};
const INITIAL_PROJECT_FILTERS = {
  search: "",
  status: "all",
  department: "all",
};
const EMPTY_EDITING = {
  id: null,
  name: "",
  code: "",
  description: "",
  socialMediaLink: "",
  centerChiefId: "",
  agendaInput: "",
  researchAgendas: [],
};
export default function AdminResearchCenterPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const toast = useToast();
  const PAGE_SIZE = 10;
  const AGENDA_PAGE_SIZE = 6;
  const AGENDA_PREVIEW_COUNT = 3;
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
  const [agendaCurrentPage, setAgendaCurrentPage] = useState(1);
  const [expandedAgendaRows, setExpandedAgendaRows] = useState({});
  const [viewMode, setViewMode] = useState("grid");
  const [exporting, setExporting] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newResearchCenterName, setnewResearchCenterName] = useState("");
  const [newResearchCenterCode, setnewResearchCenterCode] = useState("");
  const [newResearchCenterDescription, setNewResearchCenterDescription] =
    useState("");
  const [
    newResearchCenterSocialMediaLink,
    setNewResearchCenterSocialMediaLink,
  ] = useState("");
  const [newCenterChiefId, setNewCenterChiefId] = useState("");
  const [centerChiefUsers, setCenterChiefUsers] = useState([]);
  const [newAgendaInput, setNewAgendaInput] = useState("");
  const [newResearchAgendas, setNewResearchAgendas] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [agendaNamesByCenterId, setAgendaNamesByCenterId] = useState({});
  const [agendaMatrixLoading, setAgendaMatrixLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
  });
  const [editErrors, setEditErrors] = useState({});
  const [createErrors, setCreateErrors] = useState({});
  const [scopedMembers, setScopedMembers] = useState([]);
  const [scopedProjects, setScopedProjects] = useState([]);
  const [scopedLinksLoading, setScopedLinksLoading] = useState(false);
  const [scopedLinksError, setScopedLinksError] = useState("");
  const [memberFilters, setMemberFilters] = useState(INITIAL_MEMBER_FILTERS);
  const [projectFilters, setProjectFilters] = useState(INITIAL_PROJECT_FILTERS);
  const [memberPage, setMemberPage] = useState(1);
  const [projectPage, setProjectPage] = useState(1);
  const isScopedCenterChief =
    profile?.role === "faculty" &&
    profile?.is_center_chief === true &&
    Boolean(profile?.managed_center_id);
  const managedCenterId = String(profile?.managed_center_id || "").trim();
  const scopedCenterRow = useMemo(
    () =>
      isScopedCenterChief
        ? rows.find(
            (row) => String(row?.id || "").trim() === managedCenterId,
          ) || null
        : null,
    [isScopedCenterChief, managedCenterId, rows],
  );

  const loadResearchCenterRows = useCallback(async () => {
    setDataLoading(true);
    setAgendaMatrixLoading(true);
    setDataError("");
    try {
      const referencePayload = await fetchReferenceData();
      const centersData = referencePayload?.centersRes?.data || [];
      const { ckanUsersRes, centersRes } = referencePayload || {};
      const ckanUsersData = ckanUsersRes?.data || [];
      const referenceCentersData = centersRes?.data || [];
      const centerMetaById = (referenceCentersData || []).reduce(
        (acc, center) => {
          const key = String(center?.id || "")
            .trim()
            .toLowerCase();
          if (!key) return acc;
          acc[key] = center;
          return acc;
        },
        {},
      );

      const [usageByCenter, linkedAgendasByCenter] = await Promise.all([
        Promise.all(
          centersData.map(async (center) => {
            const centerId = center?.id;
            try {
              const usage = await fetchReferenceUsageCounts({
                type: "center",
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
        ),
        Promise.all(
          centersData.map(async (center) => {
            const centerId = center?.id;
            try {
              const linked = await fetchReferenceLinks({
                type: "center",
                id: centerId,
              });
              const agendaNames = Array.isArray(linked?.agendas)
                ? [
                    ...new Set(
                      linked.agendas
                        .map((agenda) => String(agenda?.name || "").trim())
                        .filter(Boolean),
                    ),
                  ].sort((a, b) => a.localeCompare(b))
                : [];
              return { id: centerId, agendaNames };
            } catch {
              return { id: centerId, agendaNames: [] };
            }
          }),
        ),
      ]);

      const agendaNamesMap = Object.fromEntries(
        linkedAgendasByCenter.map((item) => [item.id, item.agendaNames]),
      );
      setAgendaNamesByCenterId(agendaNamesMap);

      const usageMap = Object.fromEntries(
        usageByCenter.map((item) => [item.id, item]),
      );

      const mapped = centersData
        .map((item) => {
          const orgId = item.id;
          const centerMeta =
            centerMetaById[
              String(orgId || "")
                .trim()
                .toLowerCase()
            ] || null;
          const centerChiefId =
            String(centerMeta?.center_chief_id || "").trim() || "";
          const centerChiefNameFromMeta = String(
            centerMeta?.center_chief_name || "",
          ).trim();
          const centerChiefNameFromId = ckanUsersData.find(
            (ckanUser) => String(ckanUser?.id || "").trim() === centerChiefId,
          )?.name;
          const centerChiefName =
            centerChiefNameFromMeta || centerChiefNameFromId || "";
          return {
            id: orgId,
            code: String(item?.code || "").trim() || String(orgId || "-"),
            name: item.name || "-",
            description: String(item?.description || "").trim(),
            socialMediaLink: String(item?.social_media_link || "").trim(),
            type: "Research Center",
            tag: "research-center",
            centerChiefId,
            centerChiefName: centerChiefName || "-",
            projectCount: usageMap[orgId]?.projectCount || 0,
            profileCount: usageMap[orgId]?.profileCount || 0,
            memberBreakdown: usageMap[orgId]?.memberBreakdown || {
              adminCount: 0,
              editorCount: 0,
              memberCount: 0,
              totalCount: 0,
            },
            agendaCount: agendaNamesMap[orgId]?.length || 0,
            totalLinks:
              (usageMap[orgId]?.projectCount || 0) +
              (usageMap[orgId]?.profileCount || 0),
          };
        })
        .filter((row) =>
          isScopedCenterChief ? row.id === managedCenterId : true,
        )
        .sort((a, b) => a.name.localeCompare(b.name));

      setRows(mapped);
      setCenterChiefUsers(
        ckanUsersData
          .filter(
            (item) =>
              String(item?.state || "").toLowerCase() !== "deleted" &&
              String(item?.role || "").toLowerCase() === "faculty",
          )
          .map((item) => ({
            id: item.id,
            name:
              item.fullname ||
              item.display_name ||
              item.name ||
              item.username ||
              item.email ||
              "Unnamed User",
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );

      if (isScopedCenterChief && mapped.length > 0) {
        const managedRow = mapped.find(
          (row) => String(row?.id || "").trim() === managedCenterId,
        );
        if (managedRow) {
          setScopedLinksLoading(true);
          setScopedLinksError("");
          try {
            const linked = await fetchReferenceLinks({
              type: "center",
              id: managedRow.id,
            });
            setScopedMembers(
              Array.isArray(linked?.profiles) ? linked.profiles : [],
            );
            setScopedProjects(
              Array.isArray(linked?.projects) ? linked.projects : [],
            );
          } catch (linksError) {
            setScopedMembers([]);
            setScopedProjects([]);
            setScopedLinksError(
              linksError.message || "Unable to load Research Center members.",
            );
          } finally {
            setScopedLinksLoading(false);
          }
        } else {
          setScopedMembers([]);
          setScopedProjects([]);
          setScopedLinksError(
            "Assigned Research Center could not be resolved.",
          );
        }
      } else {
        setScopedMembers([]);
        setScopedProjects([]);
        setScopedLinksError("");
        setScopedLinksLoading(false);
      }
    } catch (loadError) {
      setRows([]);
      setAgendaNamesByCenterId({});
      setScopedMembers([]);
      setScopedProjects([]);
      setScopedLinksError("");
      setDataError(loadError.message || "Unable to load research center data.");
    } finally {
      setDataLoading(false);
      setAgendaMatrixLoading(false);
    }
  }, [isScopedCenterChief, managedCenterId]);

  useEffect(() => {
    loadResearchCenterRows();
  }, [loadResearchCenterRows]);

  useEffect(() => {
    if (!dataError) return;
    toast.error("Research center data unavailable", dataError);
  }, [dataError, toast]);

  useEffect(() => {
    if (!actionError) return;
    toast.error("Research center action failed", actionError);
  }, [actionError, toast]);

  useEffect(() => {
    if (!actionMessage) return;
    toast.success("Research center action completed", actionMessage);
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
      if (quickFilter === "with_agendas" && Number(row?.agendaCount || 0) === 0)
        return false;
      const agendaNames = Array.isArray(agendaNamesByCenterId[row.id])
        ? agendaNamesByCenterId[row.id].join(" ").toLowerCase()
        : "";
      if (
        keyword &&
        !(
          row.name.toLowerCase().includes(keyword) ||
          row.code.toLowerCase().includes(keyword) ||
          String(row.centerChiefName || "")
            .toLowerCase()
            .includes(keyword) ||
          agendaNames.includes(keyword) ||
          row.type.toLowerCase().includes(keyword) ||
          row.id.toLowerCase().includes(keyword)
        )
      ) {
        return false;
      }

      return true;
    });
  }, [agendaNamesByCenterId, rows, filters, quickFilter]);

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
  const agendaTotalPages = Math.max(
    1,
    Math.ceil(sortedFilteredRows.length / AGENDA_PAGE_SIZE),
  );
  const paginatedAgendaRows = useMemo(() => {
    const start = (agendaCurrentPage - 1) * AGENDA_PAGE_SIZE;
    return sortedFilteredRows.slice(start, start + AGENDA_PAGE_SIZE);
  }, [sortedFilteredRows, agendaCurrentPage, AGENDA_PAGE_SIZE]);

  useEffect(() => {
    setCurrentPage(1);
    setAgendaCurrentPage(1);
    setExpandedAgendaRows({});
  }, [filters, rows.length, quickFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (agendaCurrentPage > agendaTotalPages) {
      setAgendaCurrentPage(agendaTotalPages);
    }
  }, [agendaCurrentPage, agendaTotalPages]);

  const scopedDepartmentOptions = useMemo(
    () =>
      [
        ...new Set(
          scopedMembers
            .map((member) => String(member?.department || "").trim())
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [scopedMembers],
  );

  const scopedProjectDepartmentOptions = useMemo(
    () =>
      [
        ...new Set(
          scopedProjects
            .map((project) => String(project?.department_name || "").trim())
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [scopedProjects],
  );

  const scopedProjectStatusOptions = useMemo(
    () =>
      [
        ...new Set(
          scopedProjects
            .map((project) =>
              String(project?.status || "")
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [scopedProjects],
  );

  const filteredScopedMembers = useMemo(() => {
    const keyword = memberFilters.search.trim().toLowerCase();
    return scopedMembers.filter((member) => {
      const fullName = String(member?.full_name || "").toLowerCase();
      const email = String(member?.email || "").toLowerCase();
      const role = String(member?.role || "").toLowerCase();
      const department = String(member?.department || "").trim();
      const isActive = member?.is_active !== false;

      if (keyword && !(fullName.includes(keyword) || email.includes(keyword))) {
        return false;
      }
      if (memberFilters.role !== "all" && role !== memberFilters.role) {
        return false;
      }
      if (
        memberFilters.department !== "all" &&
        department !== memberFilters.department
      ) {
        return false;
      }
      if (memberFilters.status === "active" && !isActive) {
        return false;
      }
      if (memberFilters.status === "inactive" && isActive) {
        return false;
      }
      return true;
    });
  }, [memberFilters, scopedMembers]);

  const filteredScopedProjects = useMemo(() => {
    const keyword = projectFilters.search.trim().toLowerCase();
    return scopedProjects.filter((project) => {
      const title = String(project?.title || "").toLowerCase();
      const leadResearcher = String(
        project?.lead_researcher || "",
      ).toLowerCase();
      const status = String(project?.status || "")
        .trim()
        .toLowerCase();
      const department = String(project?.department_name || "").trim();

      if (
        keyword &&
        !(title.includes(keyword) || leadResearcher.includes(keyword))
      ) {
        return false;
      }
      if (projectFilters.status !== "all" && status !== projectFilters.status) {
        return false;
      }
      if (
        projectFilters.department !== "all" &&
        department !== projectFilters.department
      ) {
        return false;
      }
      return true;
    });
  }, [projectFilters, scopedProjects]);

  const MEMBER_PAGE_SIZE = 8;
  const PROJECT_PAGE_SIZE = 6;
  const memberTotalPages = Math.max(
    1,
    Math.ceil(filteredScopedMembers.length / MEMBER_PAGE_SIZE),
  );
  const projectTotalPages = Math.max(
    1,
    Math.ceil(filteredScopedProjects.length / PROJECT_PAGE_SIZE),
  );

  const paginatedScopedMembers = useMemo(() => {
    const start = (memberPage - 1) * MEMBER_PAGE_SIZE;
    return filteredScopedMembers.slice(start, start + MEMBER_PAGE_SIZE);
  }, [filteredScopedMembers, memberPage]);

  const paginatedScopedProjects = useMemo(() => {
    const start = (projectPage - 1) * PROJECT_PAGE_SIZE;
    return filteredScopedProjects.slice(start, start + PROJECT_PAGE_SIZE);
  }, [filteredScopedProjects, projectPage]);

  const scopedSummary = useMemo(() => {
    const activeMembers = scopedMembers.filter(
      (member) => member?.is_active !== false,
    );
    return {
      totalMembers: scopedMembers.length,
      activeMembers: activeMembers.length,
      linkedProjects: scopedProjects.length,
      agendas: scopedCenterRow?.agendaCount || 0,
    };
  }, [scopedCenterRow?.agendaCount, scopedMembers, scopedProjects.length]);

  const dashboardMetrics = useMemo(() => {
    const totalCenters = rows.length;
    const totalAffiliates = rows.reduce(
      (sum, row) => sum + Number(row?.profileCount || 0),
      0,
    );
    const totalProjects = rows.reduce(
      (sum, row) => sum + Number(row?.projectCount || 0),
      0,
    );
    const totalAgendas = rows.reduce(
      (sum, row) => sum + Number(row?.agendaCount || 0),
      0,
    );
    return {
      totalCenters,
      totalAffiliates,
      totalProjects,
      totalAgendas,
    };
  }, [rows]);

  useEffect(() => {
    setMemberPage(1);
  }, [memberFilters, scopedMembers.length]);

  useEffect(() => {
    setProjectPage(1);
  }, [projectFilters, scopedProjects.length]);

  useEffect(() => {
    if (memberPage > memberTotalPages) {
      setMemberPage(memberTotalPages);
    }
  }, [memberPage, memberTotalPages]);

  useEffect(() => {
    if (projectPage > projectTotalPages) {
      setProjectPage(projectTotalPages);
    }
  }, [projectPage, projectTotalPages]);

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
      validateCenterForm({
        name: editing.name,
        code: editing.code,
        centerChiefId: editing.centerChiefId,
        researchAgendas: editing.researchAgendas,
      }),
    [editing],
  );

  const createValidationErrors = useMemo(
    () =>
      validateCenterForm({
        name: newResearchCenterName,
        code: newResearchCenterCode,
        centerChiefId: newCenterChiefId,
        researchAgendas: newResearchAgendas,
      }),
    [
      newCenterChiefId,
      newResearchAgendas,
      newResearchCenterCode,
      newResearchCenterName,
    ],
  );

  const isEditFormValid = Object.keys(editValidationErrors).length === 0;
  const isCreateFormValid = Object.keys(createValidationErrors).length === 0;

  const startEdit = async (row) => {
    setActionError("");
    setActionMessage("");
    setEditErrors({});
    setEditModalOpen(true);
    setEditLoading(true);
    setEditing({
      ...EMPTY_EDITING,
      id: row.id,
      name: row.name === "-" ? "" : row.name,
      code: row.code === "-" ? "" : row.code,
      description: String(row?.description || "").trim(),
      socialMediaLink: String(row?.socialMediaLink || "").trim(),
      centerChiefId: row.centerChiefId || "",
    });

    try {
      const result = await fetchReferenceLinks({ type: "center", id: row.id });
      const linkedAgendas = Array.isArray(result?.agendas)
        ? result.agendas
            .map((agenda) => String(agenda?.name || "").trim())
            .filter(Boolean)
        : [];
      setEditing((prev) => ({
        ...prev,
        researchAgendas: [...new Set(linkedAgendas)],
      }));
    } catch (error) {
      setActionError(
        error.message || "Unable to load editable center details.",
      );
    } finally {
      setEditLoading(false);
    }
  };

  const cancelEdit = () => {
    if (actionLoading) return;
    setEditModalOpen(false);
    setEditErrors({});
    setEditing(EMPTY_EDITING);
  };

  const addEditAgenda = () => {
    const next = editing.agendaInput.trim();
    if (!next) return;
    if (
      editing.researchAgendas.some(
        (item) => item.toLowerCase() === next.toLowerCase(),
      )
    ) {
      setEditing((prev) => ({ ...prev, agendaInput: "" }));
      return;
    }
    setEditing((prev) => ({
      ...prev,
      researchAgendas: [...prev.researchAgendas, next],
      agendaInput: "",
    }));
    setEditErrors((prev) => ({ ...prev, researchAgendas: "" }));
  };

  const removeEditAgenda = (agendaName) => {
    setEditing((prev) => ({
      ...prev,
      researchAgendas: prev.researchAgendas.filter(
        (item) => item !== agendaName,
      ),
    }));
    setEditErrors((prev) => ({ ...prev, researchAgendas: "" }));
  };

  const saveEdit = async () => {
    const nextName = editing.name.trim();
    const nextCode = editing.code.trim();
    const errors = validateCenterForm({
      name: nextName,
      code: nextCode,
      centerChiefId: editing.centerChiefId,
      researchAgendas: editing.researchAgendas,
    });
    setEditErrors(errors);
    if (!editing.id || Object.keys(errors).length > 0) {
      return;
    }
    setActionLoading(true);
    setActionError("");
    setActionMessage("");

    const { error: updateError } = await updateReference({
      type: "center",
      id: editing.id,
      name: nextName,
      code: nextCode,
      description: editing.description,
      social_media_link: editing.socialMediaLink,
      center_chief_id: editing.centerChiefId,
      research_agendas: editing.researchAgendas,
    });

    if (updateError) {
      setActionError(updateError.message || "Unable to update center.");
      setActionLoading(false);
      return;
    }

    setActionMessage("Center updated successfully.");
    setActionLoading(false);
    cancelEdit();
    await loadResearchCenterRows();
  };

  const confirmDelete = async () => {
    if (!deletingRow?.id) return;

    setActionLoading(true);
    setActionError("");
    setActionMessage("");

    const { error: deleteError } = await deleteReference({
      type: "center",
      id: deletingRow.id,
    });

    if (deleteError) {
      setActionError(
        deleteError.message ||
          "Unable to delete center. It may still be referenced by records.",
      );
      setActionLoading(false);
      return;
    }

    setRows((prev) => prev.filter((row) => row.id !== deletingRow.id));
    setActionMessage("Center deleted successfully.");
    setActionLoading(false);
    setDeletingRow(null);
  };

  const goToCenterDetail = (row, tab = null) => {
    const id = String(row?.id || "").trim();
    if (!id) return;
    const query = tab ? `?tab=${encodeURIComponent(tab)}` : "";
    navigate(`/admin/research-center/${encodeURIComponent(id)}${query}`);
  };

  const createResearchCenter = async () => {
    const name = newResearchCenterName.trim();
    const code = newResearchCenterCode.trim();
    const errors = validateCenterForm({
      name,
      code,
      centerChiefId: newCenterChiefId,
      researchAgendas: newResearchAgendas,
    });
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setCreateLoading(true);
    setActionError("");
    setActionMessage("");

    const { error: createError } = await createReference({
      type: "center",
      name,
      code,
      description: newResearchCenterDescription,
      social_media_link: newResearchCenterSocialMediaLink,
      center_chief_id: newCenterChiefId,
      research_agendas: newResearchAgendas,
    });

    if (createError) {
      setActionError(
        createError.message || "Unable to create research center.",
      );
      setCreateLoading(false);
      return;
    }

    setActionMessage("Research center created successfully.");
    setCreateLoading(false);
    setCreateModalOpen(false);
    setCreateErrors({});
    setnewResearchCenterName("");
    setnewResearchCenterCode("");
    setNewResearchCenterDescription("");
    setNewResearchCenterSocialMediaLink("");
    setNewCenterChiefId("");
    setNewAgendaInput("");
    setNewResearchAgendas([]);
    await loadResearchCenterRows();
  };

  const addResearchAgenda = () => {
    const next = newAgendaInput.trim();
    if (!next) return;
    if (
      newResearchAgendas.some(
        (item) => item.toLowerCase() === next.toLowerCase(),
      )
    ) {
      setNewAgendaInput("");
      return;
    }
    setNewResearchAgendas((prev) => [...prev, next]);
    setNewAgendaInput("");
    setCreateErrors((prev) => ({ ...prev, researchAgendas: "" }));
  };

  const removeResearchAgenda = (agendaName) => {
    setNewResearchAgendas((prev) => prev.filter((item) => item !== agendaName));
    setCreateErrors((prev) => ({ ...prev, researchAgendas: "" }));
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
        "center_code",
        "center_name",
        "research_center_type",
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
        `research-center-records-${suffix}.csv`,
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
            <title>research-center-records-${suffix}</title>
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
            <h1>Research Center Records Report</h1>
            <p>Generated: ${timestamp} | Scope: ${suffix} | Rows: ${dataset.length}</p>
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Center Code</th>
                  <th>Research Center Name</th>
                  <th>Research Center Type</th>
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

  if (isScopedCenterChief) {
    return (
      <section className="page-stack-lg">
        <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                My Research Center
              </p>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
                {scopedCenterRow?.name || "Research Center Workspace"}
              </h1>
              <p className="text-sm text-slate-600">
                Review member activity, linked projects, and agenda coverage at
                a glance.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => goToCenterDetail(scopedCenterRow)}
                disabled={!scopedCenterRow}
                aria-label="View center"
                title="View center"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Center Code
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {scopedCenterRow?.code || "-"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Chief:{" "}
                {scopedCenterRow?.centerChiefName || profile?.full_name || "-"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Active Members
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {scopedSummary.activeMembers}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Total {scopedSummary.totalMembers}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Linked Projects
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {scopedSummary.linkedProjects}
              </p>
              <p className="mt-1 text-xs text-slate-500">Research pipeline</p>
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Agendas
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {scopedSummary.agendas}
              </p>
              <p className="mt-1 text-xs text-slate-500">Active agenda list</p>
            </div>
          </div>
        </div>

        {dataLoading ? (
          <Card>
            <CardContent className="p-6 text-sm text-slate-600">
              Loading your Research Center...
            </CardContent>
          </Card>
        ) : !scopedCenterRow ? (
          <Card>
            <CardContent className="p-6 text-sm text-red-700">
              Your assigned Research Center could not be loaded.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-[var(--border)] px-6 py-5 space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold text-slate-900">
                      Research Center Members
                    </CardTitle>
                    <CardDescription>
                      {filteredScopedMembers.length} member(s) matched.
                    </CardDescription>
                  </div>
                  <label className="relative w-full lg:max-w-md">
                    <span className="sr-only">Search members</span>
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="pl-8"
                      placeholder="Search name or email"
                      value={memberFilters.search}
                      onChange={(event) =>
                        setMemberFilters((prev) => ({
                          ...prev,
                          search: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[10rem_minmax(0,14rem)_10rem]">
                  <Select
                    value={memberFilters.role}
                    onValueChange={(value) =>
                      setMemberFilters((prev) => ({
                        ...prev,
                        role: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="faculty">Faculty</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={memberFilters.department}
                    onValueChange={(value) =>
                      setMemberFilters((prev) => ({
                        ...prev,
                        department: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All departments</SelectItem>
                      {scopedDepartmentOptions.map((department) => (
                        <SelectItem key={department} value={department}>
                          {department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={memberFilters.status}
                    onValueChange={(value) =>
                      setMemberFilters((prev) => ({
                        ...prev,
                        status: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setMemberFilters(INITIAL_MEMBER_FILTERS)}
                  >
                    Reset
                  </Button>
                  <p className="text-sm text-slate-600">
                    Showing{" "}
                    <span className="font-semibold">
                      {filteredScopedMembers.length}
                    </span>{" "}
                    member(s).
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  {scopedLinksLoading ? (
                    <p className="p-4 text-sm text-slate-600">
                      Loading affiliated members...
                    </p>
                  ) : scopedLinksError ? (
                    <p className="p-4 text-sm text-red-700">
                      {scopedLinksError}
                    </p>
                  ) : filteredScopedMembers.length === 0 ? (
                    <p className="p-4 text-sm text-slate-600">
                      No members matched the current filters.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No.</TableHead>
                          <TableHead>Full Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>User ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedScopedMembers.map((member, index) => (
                          <TableRow
                            key={member.id || `${member.email}-${index}`}
                          >
                            <TableCell>
                              {(memberPage - 1) * MEMBER_PAGE_SIZE + index + 1}
                            </TableCell>
                            <TableCell>
                              {member.full_name || "Unnamed user"}
                            </TableCell>
                            <TableCell>{member.email || "-"}</TableCell>
                            <TableCell className="capitalize">
                              {member.role || "-"}
                            </TableCell>
                            <TableCell>{member.department || "-"}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  member.is_active !== false
                                    ? "secondary"
                                    : "destructive"
                                }
                              >
                                {member.is_active !== false
                                  ? "Active"
                                  : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <code>{member.id || "-"}</code>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
              <PaginationControls
                page={memberPage}
                totalPages={memberTotalPages}
                onPageChange={setMemberPage}
                className="rounded-none border-0 border-t border-[var(--border)]"
              />
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-[var(--border)] px-6 py-5 space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold text-slate-900">
                      Linked Projects
                    </CardTitle>
                    <CardDescription>
                      {filteredScopedProjects.length} project(s) matched.
                    </CardDescription>
                  </div>
                  <label className="relative w-full lg:max-w-md">
                    <span className="sr-only">Search projects</span>
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <Input
                      className="pl-8"
                      placeholder="Search title or lead researcher"
                      value={projectFilters.search}
                      onChange={(event) =>
                        setProjectFilters((prev) => ({
                          ...prev,
                          search: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[12rem_minmax(0,14rem)]">
                  <Select
                    value={projectFilters.status}
                    onValueChange={(value) =>
                      setProjectFilters((prev) => ({
                        ...prev,
                        status: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {scopedProjectStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={projectFilters.department}
                    onValueChange={(value) =>
                      setProjectFilters((prev) => ({
                        ...prev,
                        department: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All departments</SelectItem>
                      {scopedProjectDepartmentOptions.map((department) => (
                        <SelectItem key={department} value={department}>
                          {department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setProjectFilters(INITIAL_PROJECT_FILTERS)}
                  >
                    Reset
                  </Button>
                  <p className="text-sm text-slate-600">
                    Showing{" "}
                    <span className="font-semibold">
                      {filteredScopedProjects.length}
                    </span>{" "}
                    linked project(s).
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  {scopedLinksLoading ? (
                    <p className="p-4 text-sm text-slate-600">
                      Loading linked projects...
                    </p>
                  ) : scopedLinksError ? (
                    <p className="p-4 text-sm text-red-700">
                      {scopedLinksError}
                    </p>
                  ) : filteredScopedProjects.length === 0 ? (
                    <p className="p-4 text-sm text-slate-600">
                      No linked projects matched the current filters.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No.</TableHead>
                          <TableHead>Project Title</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Year</TableHead>
                          <TableHead>Lead Researcher</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Agendum</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedScopedProjects.map((project, index) => (
                          <TableRow
                            key={project.id || `${project.title}-${index}`}
                          >
                            <TableCell>
                              {(projectPage - 1) * PROJECT_PAGE_SIZE +
                                index +
                                1}
                            </TableCell>
                            <TableCell>{project.title || "-"}</TableCell>
                            <TableCell className="capitalize">
                              {project.status || "-"}
                            </TableCell>
                            <TableCell>{project.year || "-"}</TableCell>
                            <TableCell>
                              {project.lead_researcher || "-"}
                            </TableCell>
                            <TableCell>
                              {project.department_name || "-"}
                            </TableCell>
                            <TableCell>{project.agenda_name || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
              <PaginationControls
                page={projectPage}
                totalPages={projectTotalPages}
                onPageChange={setProjectPage}
                className="rounded-none border-0 border-t border-[var(--border)]"
              />
            </Card>
          </>
        )}
      </section>
    );
  }

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
        ? `Cannot delete "${name}". This research center has ${reasons.join(" and ")}. Remove/reassign them first.`
        : `Delete "${name}"? This action cannot be undone.`,
    };
  })();

  return (
    <section className="page-stack-lg">
      <div className="rounded-2xl border border-slate-200/70 bg-white via-white to-emerald-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              ARMS Research Centers
            </p>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
              Research Center Workspace
            </h1>
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

            {!isScopedCenterChief ? (
              <Button
                onClick={() => {
                  setCreateErrors({});
                  setCreateModalOpen(true);
                }}
              >
                Create Research Center
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-slate-900">
                Center Directory
              </CardTitle>
              <CardDescription>
                Showing {filteredRows.length} record(s).
              </CardDescription>
            </div>
            <label className="relative w-full md:max-w-md">
              <span className="sr-only">Search research centers</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-8"
                placeholder="Search name, code, chief, agenda, or id"
                value={filters.search}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    search: event.target.value,
                  }))
                }
              />
            </label>

            <div className="inline-flex w-full items-center justify-between gap-1 rounded-full border border-slate-200 bg-white p-1 md:w-auto">
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
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {[
              {
                key: "all",
                label: "All Centers",
                count: filteredRows.length,
              },
              {
                key: "with_projects",
                label: "With Projects",
                count: rows.filter((row) => Number(row?.projectCount || 0) > 0)
                  .length,
              },
              {
                key: "with_affiliates",
                label: "With Affiliates",
                count: rows.filter((row) => Number(row?.profileCount || 0) > 0)
                  .length,
              },
              {
                key: "with_agendas",
                label: "With Agendas",
                count: rows.filter((row) => Number(row?.agendaCount || 0) > 0)
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
                  quickFilter === chip.key
                    ? "bg-slate-900 text-white hover:bg-slate-900"
                    : "bg-white text-slate-600 hover:bg-slate-50",
                )}
                onClick={() => setQuickFilter(chip.key)}
              >
                {chip.label}
                <span
                  className={cn(
                    "ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    quickFilter === chip.key
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600",
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
              className="rounded-full text-xs text-slate-500 hover:text-slate-700"
              onClick={() => setQuickFilter("all")}
            >
              Clear filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {!dataLoading && filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-sm text-slate-600">
              No research center records found.
            </div>
          ) : null}
          {viewMode === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {paginatedRows.map((row, index) => (
                <Card
                  key={`${row.tag}-${row.id}`}
                  className="group rounded-2xl border border-slate-200/70 bg-white shadow-sm transition-shadow hover:shadow-md"
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
                          Center Chief:{" "}
                          <span className="font-semibold text-slate-800">
                            {row.centerChiefName || "-"}
                          </span>
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 font-mono">
                        {row.code}
                      </Badge>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        Agenda: {row.agendaCount || 0}
                      </Badge>

                      <Badge
                        variant="outline"
                        className="border-slate-200 text-slate-600"
                      >
                        Projects: {row.projectCount || 0}
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        className={cn(
                          "rounded-lg border border-border bg-muted/30 p-3 text-left transition-colors",
                          "hover:bg-muted/50",
                        )}
                        onClick={() => goToCenterDetail(row, "affiliates")}
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
                        onClick={() => goToCenterDetail(row, "projects")}
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

                    {!isScopedCenterChief ? (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => goToCenterDetail(row)}
                          aria-label={`View ${row?.name || "research center"}`}
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => startEdit(row)}
                          aria-label={`Edit ${row?.name || "research center"}`}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 text-[var(--danger)] hover:bg-red-50"
                          onClick={() => setDeletingRow(row)}
                          aria-label={`Delete ${row?.name || "research center"}`}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => goToCenterDetail(row)}
                          aria-label={`View ${row?.name || "research center"}`}
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
              <Table className="min-w-[980px]">
                <TableHeader className="bg-slate-50/80">
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
                        Research Center{" "}
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
                        className={`h-8 px-0 font-medium hover:bg-transparent ${sortConfig.key === "centerChiefName" ? "text-slate-900" : "text-muted-foreground"}`}
                        onClick={() => toggleSort("centerChiefName")}
                      >
                        Center Chief{" "}
                        <span
                          className={
                            sortConfig.key === "centerChiefName"
                              ? "text-[var(--brand)]"
                              : "text-slate-400"
                          }
                        >
                          {getSortIndicator("centerChiefName")}
                        </span>
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-8 px-0 font-medium hover:bg-transparent ${sortConfig.key === "agendaCount" ? "text-slate-900" : "text-muted-foreground"}`}
                        onClick={() => toggleSort("agendaCount")}
                      >
                        Agenda{" "}
                        <span
                          className={
                            sortConfig.key === "agendaCount"
                              ? "text-[var(--brand)]"
                              : "text-slate-400"
                          }
                        >
                          {getSortIndicator("agendaCount")}
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
                      <TableCell>{row.centerChiefName || "-"}</TableCell>
                      <TableCell>{row.agendaCount || 0}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 font-semibold text-[var(--brand)] hover:bg-[var(--brand-soft)]"
                          onClick={() => goToCenterDetail(row, "affiliates")}
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
                          onClick={() => goToCenterDetail(row, "projects")}
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
                            onClick={() => goToCenterDetail(row)}
                            aria-label={`View ${row?.name || "research center"}`}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {!isScopedCenterChief ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => startEdit(row)}
                                aria-label={`Edit ${row?.name || "research center"}`}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-[var(--danger)] hover:bg-red-50"
                                onClick={() => setDeletingRow(row)}
                                aria-label={`Delete ${row?.name || "research center"}`}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        <PaginationControls
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          className="rounded-none border-0 border-t border-[var(--border)]"
        />
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] bg-muted/30 px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold text-slate-900">
                Research Center Agenda
              </CardTitle>
              <CardDescription>
                Browse linked agenda items per center.
              </CardDescription>
            </div>
            <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-sm font-semibold text-slate-600">
              {filteredRows.length} centers
            </span>
          </div>
        </CardHeader>
        <CardContent className="max-h-[80vh] overflow-auto p-4">
          {agendaMatrixLoading ? (
            <p className="text-sm text-slate-600">Loading center agenda...</p>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-sm text-slate-600">
              No research center records found.
            </div>
          ) : (
            <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              {paginatedAgendaRows.map((row) => {
                const agendaNames = agendaNamesByCenterId[row.id] || [];
                const isExpanded = Boolean(expandedAgendaRows[row.id]);
                const hasOverflow = agendaNames.length > AGENDA_PREVIEW_COUNT;
                const visibleAgendaNames = isExpanded
                  ? agendaNames
                  : agendaNames.slice(0, AGENDA_PREVIEW_COUNT);
                const displayAgendas =
                  agendaNames.length > 0
                    ? visibleAgendaNames
                    : ["No agendum linked"];

                return (
                  <Card
                    key={`agenda-group-${row.id}`}
                    className="overflow-hidden border-slate-200/70 bg-white shadow-sm"
                  >
                    <div className="border-b border-slate-200/70 bg-white px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Research Center
                          </p>
                          <h3 className="mt-1 truncate text-lg font-semibold text-slate-900">
                            {row.name || "-"}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            Code:{" "}
                            <span className="font-mono font-semibold text-slate-700">
                              {row.code || "-"}
                            </span>
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Agenda
                          </p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">
                            {agendaNames.length}
                          </p>
                        </div>
                      </div>
                    </div>

                    <CardContent className="p-5">
                      <div className="space-y-2">
                        {displayAgendas.map((agendaName) => (
                          <div
                            key={`${row.id}-${agendaName}`}
                            className={cn(
                              "flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700",
                              agendaName === "No agendum linked"
                                ? "bg-slate-50 text-slate-500"
                                : "bg-white",
                            )}
                            title={agendaName}
                          >
                            <span className="min-w-0 truncate">
                              {agendaName}
                            </span>
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                agendaName === "No agendum linked"
                                  ? "bg-slate-300"
                                  : "bg-emerald-400",
                              )}
                            />
                          </div>
                        ))}
                      </div>

                      {hasOverflow ? (
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <button
                            type="button"
                            className="text-xs font-semibold text-[var(--brand)] hover:text-[var(--brand-strong)] hover:underline"
                            onClick={() =>
                              setExpandedAgendaRows((prev) => ({
                                ...prev,
                                [row.id]: !isExpanded,
                              }))
                            }
                          >
                            {isExpanded
                              ? "Show less"
                              : `Show ${agendaNames.length - AGENDA_PREVIEW_COUNT} more`}
                          </button>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
        <PaginationControls
          page={agendaCurrentPage}
          totalPages={agendaTotalPages}
          onPageChange={setAgendaCurrentPage}
          className="rounded-none border-0 border-t border-[var(--border)]"
        />
      </Card>

      <ConfirmActionModal
        open={Boolean(deletingRow)}
        title="Delete Research Center"
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
            className="max-w-3xl"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Edit Research Center</DialogTitle>
              <DialogDescription>
                Update all research center information.
              </DialogDescription>
            </DialogHeader>

            {editLoading ? (
              <p className="mt-4 text-sm text-slate-600">
                Loading center details...
              </p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {/* Research Center Name */}
                  <div className="space-y-2 col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Research Center Name *
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

                  {/* Code */}
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

                  {/* Center Chief */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Center Chief *
                    </label>
                    <Select
                      value={editing.centerChiefId}
                      onValueChange={(value) => {
                        setEditing((prev) => ({
                          ...prev,
                          centerChiefId: value,
                        }));
                        setEditErrors((prev) => ({
                          ...prev,
                          centerChiefId: "",
                        }));
                      }}
                    >
                      <SelectTrigger
                        className={
                          editErrors.centerChiefId ? "input-error" : ""
                        }
                      >
                        <SelectValue placeholder="Select Center Chief" />
                      </SelectTrigger>
                      <SelectContent>
                        {centerChiefUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {editErrors.centerChiefId ? (
                      <p className="field-error">{editErrors.centerChiefId}</p>
                    ) : null}
                  </div>

                  {/* Social Media */}
                  <div className="space-y-2 col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Social Media Link
                    </label>
                    <Input
                      value={editing.socialMediaLink}
                      placeholder="Optional: https://facebook.com/your-center"
                      onChange={(event) =>
                        setEditing((prev) => ({
                          ...prev,
                          socialMediaLink: event.target.value,
                        }))
                      }
                    />
                    <p className="text-xs text-slate-500">
                      Optional. Displayed on the center detail page.
                    </p>
                  </div>

                  {/* Description */}
                  <div className="space-y-2 col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Description
                    </label>
                    <Textarea
                      value={editing.description}
                      placeholder="Optional short description about the research center..."
                      onChange={(event) =>
                        setEditing((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      rows={4}
                    />
                    <p className="text-xs text-slate-500">
                      Shown on the research center detail page.
                    </p>
                  </div>

                  {/* Research Agendum */}
                  <div className="space-y-2 col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Research Agendum *
                    </label>

                    <div className="flex gap-2">
                      <Input
                        className={
                          editErrors.researchAgendas ? "input-error" : ""
                        }
                        placeholder="Add research agendum"
                        value={editing.agendaInput}
                        onChange={(event) =>
                          setEditing((prev) => ({
                            ...prev,
                            agendaInput: event.target.value,
                          }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addEditAgenda();
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        type="button"
                        onClick={addEditAgenda}
                      >
                        Add
                      </Button>
                    </div>

                    {editing.researchAgendas.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {editing.researchAgendas.map((agenda) => (
                          <button
                            key={agenda}
                            type="button"
                            className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-xs text-slate-700 hover:bg-[var(--surface-strong)]"
                            onClick={() => removeEditAgenda(agenda)}
                          >
                            {agenda} x
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Required. Add at least one research agendum.
                      </p>
                    )}

                    {editErrors.researchAgendas ? (
                      <p className="field-error">
                        {editErrors.researchAgendas}
                      </p>
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
            className="max-w-3xl mx-auto"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Create Research Center</DialogTitle>
              <DialogDescription>
                Add a new research center to the research center registry.
              </DialogDescription>
              <p className="text-xs text-slate-500 mb-3">
                Fields marked with <span className="text-red-500">*</span> are
                required.
              </p>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Research Center Name <span className="text-red-500">*</span>
                </label>
                <Input
                  className={createErrors.name ? "input-error" : ""}
                  placeholder="e.g. Center for Human-Computer Interaction"
                  value={newResearchCenterName}
                  onChange={(event) => {
                    setnewResearchCenterName(event.target.value);
                    setCreateErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  required
                />
                {createErrors.name ? (
                  <p className="field-error">{createErrors.name}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Code <span className="text-red-500">*</span>
                </label>
                <Input
                  className={createErrors.code ? "input-error" : ""}
                  placeholder="e.g. CHCI"
                  value={newResearchCenterCode}
                  onChange={(event) => {
                    setnewResearchCenterCode(
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

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Center Chief <span className="text-red-500">*</span>
                </label>
                <Select
                  value={newCenterChiefId}
                  onValueChange={(value) => {
                    setNewCenterChiefId(value);
                    setCreateErrors((prev) => ({ ...prev, centerChiefId: "" }));
                  }}
                >
                  <SelectTrigger
                    className={createErrors.centerChiefId ? "input-error" : ""}
                  >
                    <SelectValue placeholder="Select Center Chief" />
                  </SelectTrigger>
                  <SelectContent>
                    {centerChiefUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {createErrors.centerChiefId ? (
                  <p className="field-error">{createErrors.centerChiefId}</p>
                ) : null}

                <p className="text-xs text-slate-500">Select from users.</p>
              </div>

              <div className="space-y-2 col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Social Media Link
                </label>
                <Input
                  value={newResearchCenterSocialMediaLink}
                  placeholder="Optional: https://facebook.com/your-center"
                  onChange={(event) =>
                    setNewResearchCenterSocialMediaLink(event.target.value)
                  }
                />
                <p className="text-xs text-slate-500">
                  Optional. You can add this later in Edit Research Center.
                </p>
              </div>

              <div className="space-y-2 col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Description <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={newResearchCenterDescription}
                  placeholder="Optional short description about the research center..."
                  onChange={(event) =>
                    setNewResearchCenterDescription(event.target.value)
                  }
                  rows={4}
                />
                <p className="text-xs text-slate-500">
                  This will appear on the research center detail page.
                </p>
              </div>

              <div className="space-y-2 col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Research Agendum <span className="text-red-500">*</span>
                </label>

                <div className="flex gap-2">
                  <Input
                    className={
                      createErrors.researchAgendas ? "input-error" : ""
                    }
                    placeholder="Add research agendum"
                    value={newAgendaInput}
                    onChange={(event) => setNewAgendaInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addResearchAgenda();
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    type="button"
                    onClick={addResearchAgenda}
                  >
                    Add
                  </Button>
                </div>

                {newResearchAgendas.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {newResearchAgendas.map((agenda) => (
                      <button
                        key={agenda}
                        type="button"
                        className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-xs text-slate-700 hover:bg-[var(--surface-strong)]"
                        onClick={() => removeResearchAgenda(agenda)}
                      >
                        {agenda} x
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Required. Add at least one research agendum.
                  </p>
                )}

                {createErrors.researchAgendas ? (
                  <p className="field-error">{createErrors.researchAgendas}</p>
                ) : null}
              </div>
            </div>

            <div className="modal-actions mt-6 flex justify-end gap-2">
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
                onClick={createResearchCenter}
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
