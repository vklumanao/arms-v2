import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, Pencil, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { cn } from "@/utils/cn";
import {
  createReference,
  deleteReference,
  fetchReferenceData,
  fetchReferenceLinks,
  fetchReferenceUsageCounts,
  updateReference,
} from "@/services/admin";
import { validateCenterForm } from "@/utils/admin";
import {
  EMPTY_EDITING,
  INITIAL_FILTERS,
  INITIAL_MEMBER_FILTERS,
  INITIAL_PROJECT_FILTERS,
  MEMBER_PAGE_SIZE,
  PAGE_SIZE,
  PROJECT_PAGE_SIZE,
} from "./research-centers/constants";
import { createEditingState } from "./research-centers/helpers";
import DirectoryPanel from "./research-centers/components/DirectoryPanel";
import WorkspaceOverview from "./research-centers/components/WorkspaceOverview";
import MembersPanel from "./research-centers/components/MembersPanel";
import ProjectsPanel from "./research-centers/components/ProjectsPanel";
import AgendasPanel from "./research-centers/components/AgendasPanel";
import SettingsPanel from "./research-centers/components/SettingsPanel";
import CreateResearchCenterDialog from "./research-centers/components/CreateResearchCenterDialog";

export default function AdminResearchCenterPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const toast = useToast();

  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [quickFilter, setQuickFilter] = useState("all");
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(EMPTY_EDITING);
  const [editLoading, setEditLoading] = useState(false);
  const [deletingRow, setDeletingRow] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newResearchCenterName, setNewResearchCenterName] = useState("");
  const [newResearchCenterCode, setNewResearchCenterCode] = useState("");
  const [newResearchCenterDescription, setNewResearchCenterDescription] =
    useState("");
  const [
    newResearchCenterSocialMediaLink,
    setNewResearchCenterSocialMediaLink,
  ] = useState("");
  const [
    newResearchCenterSocialMediaPlatform,
    setNewResearchCenterSocialMediaPlatform,
  ] = useState("facebook");
  const [newCenterChiefId, setNewCenterChiefId] = useState("");
  const [centerChiefUsers, setCenterChiefUsers] = useState([]);
  const [newAgendaInput, setNewAgendaInput] = useState("");
  const [newResearchAgendas, setNewResearchAgendas] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [agendaNamesByCenterId, setAgendaNamesByCenterId] = useState({});
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
  const [selectedCenterId, setSelectedCenterId] = useState("");
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("overview");

  const isScopedCenterChief =
    profile?.is_center_chief === true && Boolean(profile?.managed_center_id);
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
                id: centerId,
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
            try {
              const linked = await fetchReferenceLinks({
                type: "center",
                id: center?.id,
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
              return { id: center?.id, agendaNames };
            } catch {
              return { id: center?.id, agendaNames: [] };
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
          const centerMeta =
            centerMetaById[
              String(item?.id || "")
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
            id: item?.id,
            code: String(item?.code || "").trim() || String(item?.id || "-"),
            name: item?.name || "-",
            description: String(item?.description || "").trim(),
            socialMediaLink: String(item?.social_media_link || "").trim(),
            type: "Research Center",
            tag: "research-center",
            centerChiefId,
            centerChiefName: centerChiefName || "-",
            projectCount: usageMap[item?.id]?.projectCount || 0,
            profileCount: usageMap[item?.id]?.profileCount || 0,
            memberBreakdown: usageMap[item?.id]?.memberBreakdown || {
              adminCount: 0,
              editorCount: 0,
              memberCount: 0,
              totalCount: 0,
            },
            agendaCount: agendaNamesMap[item?.id]?.length || 0,
            totalLinks:
              (usageMap[item?.id]?.projectCount || 0) +
              (usageMap[item?.id]?.profileCount || 0),
          };
        })
        .filter((row) =>
          isScopedCenterChief
            ? String(row?.id || "").trim() === managedCenterId
            : true,
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
          } catch (error) {
            setScopedMembers([]);
            setScopedProjects([]);
            setScopedLinksError(
              error.message ||
                "Unable to load research center workspace details.",
            );
          } finally {
            setScopedLinksLoading(false);
          }
        }
      }
    } catch (error) {
      setRows([]);
      setAgendaNamesByCenterId({});
      setScopedMembers([]);
      setScopedProjects([]);
      setScopedLinksError("");
      setDataError(error.message || "Unable to load research center data.");
    } finally {
      setDataLoading(false);
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
      ) {
        return false;
      }
      if (
        quickFilter === "with_affiliates" &&
        Number(row?.profileCount || 0) === 0
      ) {
        return false;
      }
      if (
        quickFilter === "with_agendas" &&
        Number(row?.agendaCount || 0) === 0
      ) {
        return false;
      }

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
          String(row.id || "")
            .toLowerCase()
            .includes(keyword)
        )
      ) {
        return false;
      }

      return true;
    });
  }, [agendaNamesByCenterId, filters.search, quickFilter, rows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, quickFilter, rows.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const selectedCenterRow = useMemo(() => {
    if (isScopedCenterChief) return null;
    if (!filteredRows.length) return null;
    return (
      filteredRows.find(
        (row) =>
          String(row?.id || "").trim() === String(selectedCenterId).trim(),
      ) ||
      filteredRows[0] ||
      null
    );
  }, [filteredRows, isScopedCenterChief, selectedCenterId]);

  const workspaceCenterRow = isScopedCenterChief
    ? scopedCenterRow
    : selectedCenterRow;

  useEffect(() => {
    if (isScopedCenterChief) return;
    if (!filteredRows.length) {
      setSelectedCenterId("");
      setScopedMembers([]);
      setScopedProjects([]);
      setScopedLinksError("");
      setScopedLinksLoading(false);
      return;
    }

    const isCurrentSelectionVisible = filteredRows.some(
      (row) => String(row?.id || "").trim() === String(selectedCenterId).trim(),
    );

    if (!isCurrentSelectionVisible) {
      setSelectedCenterId(String(filteredRows[0]?.id || ""));
    }
  }, [filteredRows, isScopedCenterChief, selectedCenterId]);

  const loadWorkspaceLinks = useCallback(async (centerId) => {
    if (!centerId) return;
    setScopedLinksLoading(true);
    setScopedLinksError("");
    try {
      const linked = await fetchReferenceLinks({
        type: "center",
        id: centerId,
      });
      setScopedMembers(Array.isArray(linked?.profiles) ? linked.profiles : []);
      setScopedProjects(Array.isArray(linked?.projects) ? linked.projects : []);
    } catch (error) {
      setScopedMembers([]);
      setScopedProjects([]);
      setScopedLinksError(
        error.message || "Unable to load research center workspace details.",
      );
    } finally {
      setScopedLinksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isScopedCenterChief || !workspaceCenterRow?.id) return;
    loadWorkspaceLinks(workspaceCenterRow.id);
  }, [isScopedCenterChief, loadWorkspaceLinks, workspaceCenterRow?.id]);

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
      const title = String(project?.title || project?.name || "").toLowerCase();
      const leadResearcher = String(
        project?.lead_researcher_name || project?.researcher_name || "",
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

  const workspaceSummary = useMemo(() => {
    const activeMembers = scopedMembers.filter(
      (member) => member?.is_active !== false,
    );
    return {
      totalMembers: scopedMembers.length,
      activeMembers: activeMembers.length,
      linkedProjects: scopedProjects.length,
      totalAgendas: workspaceCenterRow?.agendaCount || 0,
      totalLinks:
        (workspaceCenterRow?.profileCount || 0) +
        (workspaceCenterRow?.projectCount || 0),
    };
  }, [scopedMembers, scopedProjects.length, workspaceCenterRow]);

  const selectedAgendaNames = useMemo(
    () => agendaNamesByCenterId[workspaceCenterRow?.id] || [],
    [agendaNamesByCenterId, workspaceCenterRow?.id],
  );

  const dashboardMetrics = useMemo(() => {
    const totalCenters = rows.length;
    const totalLinks = rows.reduce(
      (sum, row) => sum + Number(row?.totalLinks || 0),
      0,
    );
    return { totalCenters, totalLinks };
  }, [rows]);

  const quickFilterChips = useMemo(
    () => [
      { key: "all", label: "All Centers", count: rows.length },
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
        key: "with_agendas",
        label: "With Agendas",
        count: rows.filter((row) => Number(row?.agendaCount || 0) > 0).length,
      },
    ],
    [rows],
  );

  const workspaceTabs = useMemo(
    () =>
      isScopedCenterChief
        ? [
            { key: "overview", label: "Overview" },
            { key: "members", label: "Members" },
            { key: "projects", label: "Projects" },
            { key: "agendas", label: "Agendas" },
          ]
        : [
            { key: "overview", label: "Overview" },
            { key: "members", label: "Members" },
            { key: "projects", label: "Projects" },
            { key: "agendas", label: "Agendas" },
            { key: "settings", label: "Settings" },
          ],
    [isScopedCenterChief],
  );

  useEffect(() => {
    setActiveWorkspaceTab("overview");
  }, [workspaceCenterRow?.id]);

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

  const loadEditableCenter = useCallback(async (row) => {
    if (!row?.id) {
      setEditing(EMPTY_EDITING);
      return;
    }

    setEditLoading(true);
    setEditErrors({});
    setEditing(createEditingState(row));

    try {
      const result = await fetchReferenceLinks({ type: "center", id: row.id });
      const linkedAgendas = Array.isArray(result?.agendas)
        ? [
            ...new Set(
              result.agendas
                .map((agenda) => String(agenda?.name || "").trim())
                .filter(Boolean),
            ),
          ]
        : [];
      setEditing(createEditingState(row, linkedAgendas));
    } catch (error) {
      setActionError(
        error.message || "Unable to load editable center details.",
      );
    } finally {
      setEditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (
      isScopedCenterChief ||
      activeWorkspaceTab !== "settings" ||
      !workspaceCenterRow?.id
    ) {
      return;
    }

    if (editing.id !== workspaceCenterRow.id) {
      loadEditableCenter(workspaceCenterRow);
    }
  }, [
    activeWorkspaceTab,
    editing.id,
    isScopedCenterChief,
    loadEditableCenter,
    workspaceCenterRow,
  ]);

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

  const startInlineEdit = useCallback(
    async (row) => {
      setActionError("");
      setActionMessage("");
      setActiveWorkspaceTab("settings");
      await loadEditableCenter(row);
    },
    [loadEditableCenter],
  );

  const resetInlineEdit = useCallback(async () => {
    if (actionLoading) return;
    setEditErrors({});
    if (workspaceCenterRow) {
      await loadEditableCenter(workspaceCenterRow);
      return;
    }
    setEditing(EMPTY_EDITING);
  }, [actionLoading, loadEditableCenter, workspaceCenterRow]);

  const updateEditing = (patch) => {
    setEditing((prev) => ({ ...prev, ...patch }));
    if (patch.name !== undefined) {
      setEditErrors((prev) => ({ ...prev, name: "" }));
    }
    if (patch.code !== undefined) {
      setEditErrors((prev) => ({ ...prev, code: "" }));
    }
    if (patch.centerChiefId !== undefined) {
      setEditErrors((prev) => ({ ...prev, centerChiefId: "" }));
    }
    if (
      patch.agendaInput !== undefined ||
      patch.researchAgendas !== undefined
    ) {
      setEditErrors((prev) => ({ ...prev, researchAgendas: "" }));
    }
  };

  const addEditAgenda = () => {
    const next = editing.agendaInput.trim();
    if (!next) return;
    if (
      editing.researchAgendas.some(
        (item) => item.toLowerCase() === next.toLowerCase(),
      )
    ) {
      updateEditing({ agendaInput: "" });
      return;
    }
    updateEditing({
      researchAgendas: [...editing.researchAgendas, next],
      agendaInput: "",
    });
  };

  const removeEditAgenda = (agendaName) => {
    updateEditing({
      researchAgendas: editing.researchAgendas.filter(
        (item) => item !== agendaName,
      ),
    });
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

    const { error } = await updateReference({
      type: "center",
      id: editing.id,
      name: nextName,
      code: nextCode,
      description: editing.description,
      social_media_link: editing.socialMediaLink,
      center_chief_id: editing.centerChiefId,
      research_agendas: editing.researchAgendas,
    });

    if (error) {
      setActionError(error.message || "Unable to update center.");
      setActionLoading(false);
      return;
    }

    setActionMessage("Center updated successfully.");
    setActionLoading(false);
    await loadResearchCenterRows();
    await loadEditableCenter({
      ...workspaceCenterRow,
      id: editing.id,
      name: nextName,
      code: nextCode,
      description: editing.description,
      socialMediaLink: editing.socialMediaLink,
      centerChiefId: editing.centerChiefId,
    });
  };

  const confirmDelete = async () => {
    if (!deletingRow?.id) return;

    setActionLoading(true);
    setActionError("");
    setActionMessage("");

    const { error } = await deleteReference({
      type: "center",
      id: deletingRow.id,
    });

    if (error) {
      setActionError(
        error.message ||
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

  const updateCreateValues = (patch) => {
    if (patch.name !== undefined) {
      setNewResearchCenterName(patch.name);
      setCreateErrors((prev) => ({ ...prev, name: "" }));
    }
    if (patch.code !== undefined) {
      setNewResearchCenterCode(patch.code);
      setCreateErrors((prev) => ({ ...prev, code: "" }));
    }
    if (patch.description !== undefined) {
      setNewResearchCenterDescription(patch.description);
    }
    if (patch.socialMediaLink !== undefined) {
      setNewResearchCenterSocialMediaLink(patch.socialMediaLink);
    }
    if (patch.socialMediaPlatform !== undefined) {
      setNewResearchCenterSocialMediaPlatform(patch.socialMediaPlatform);
    }
    if (patch.centerChiefId !== undefined) {
      setNewCenterChiefId(patch.centerChiefId);
      setCreateErrors((prev) => ({ ...prev, centerChiefId: "" }));
    }
    if (patch.agendaInput !== undefined) {
      setNewAgendaInput(patch.agendaInput);
    }
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

    const { error } = await createReference({
      type: "center",
      name,
      code,
      description: newResearchCenterDescription,
      social_media_link: newResearchCenterSocialMediaLink,
      center_chief_id: newCenterChiefId,
      research_agendas: newResearchAgendas,
    });

    if (error) {
      setActionError(error.message || "Unable to create research center.");
      setCreateLoading(false);
      return;
    }

    setActionMessage("Research center created successfully.");
    setCreateLoading(false);
    setCreateModalOpen(false);
    setCreateErrors({});
    setNewResearchCenterName("");
    setNewResearchCenterCode("");
    setNewResearchCenterDescription("");
    setNewResearchCenterSocialMediaLink("");
    setNewResearchCenterSocialMediaPlatform("facebook");
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

  const deleteGuard = (() => {
    if (!deletingRow) {
      return { blocked: false, confirmLabel: "Delete", message: "" };
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
        ? `Cannot delete "${name}". This research center has ${reasons.join(
            " and ",
          )}. Remove or reassign them first.`
        : `Delete "${name}"? This action cannot be undone.`,
    };
  })();

  const createDialogValues = {
    name: newResearchCenterName,
    code: newResearchCenterCode,
    description: newResearchCenterDescription,
    socialMediaLink: newResearchCenterSocialMediaLink,
    socialMediaPlatform: newResearchCenterSocialMediaPlatform,
    centerChiefId: newCenterChiefId,
    agendaInput: newAgendaInput,
    researchAgendas: newResearchAgendas,
  };

  const workspaceContent = useMemo(() => {
    if (!workspaceCenterRow) {
      return (
        <div className="rounded-[1.7rem] border border-dashed border-blue-200 bg-blue-50/70 p-10 text-center text-sm text-[#1E3A8A]">
          Select a research center from the directory to open its workspace.
        </div>
      );
    }

    switch (activeWorkspaceTab) {
      case "members":
        return (
          <MembersPanel
            center={workspaceCenterRow}
            filters={memberFilters}
            onFiltersChange={setMemberFilters}
            departmentOptions={scopedDepartmentOptions}
            filteredRows={filteredScopedMembers}
            paginatedRows={paginatedScopedMembers}
            loading={scopedLinksLoading}
            error={scopedLinksError}
            page={memberPage}
            totalPages={memberTotalPages}
            onPageChange={setMemberPage}
          />
        );
      case "projects":
        return (
          <ProjectsPanel
            center={workspaceCenterRow}
            filters={projectFilters}
            onFiltersChange={setProjectFilters}
            statusOptions={scopedProjectStatusOptions}
            departmentOptions={scopedProjectDepartmentOptions}
            filteredRows={filteredScopedProjects}
            paginatedRows={paginatedScopedProjects}
            loading={scopedLinksLoading}
            error={scopedLinksError}
            page={projectPage}
            totalPages={projectTotalPages}
            onPageChange={setProjectPage}
          />
        );
      case "agendas":
        return (
          <AgendasPanel
            center={workspaceCenterRow}
            agendaNames={selectedAgendaNames}
          />
        );
      case "settings":
        return (
          <SettingsPanel
            center={workspaceCenterRow}
            editing={editing}
            editErrors={editErrors}
            editLoading={editLoading}
            actionLoading={actionLoading}
            isEditFormValid={isEditFormValid}
            centerChiefUsers={centerChiefUsers}
            onChange={updateEditing}
            onAddAgenda={addEditAgenda}
            onRemoveAgenda={removeEditAgenda}
            onCancel={resetInlineEdit}
            onSave={saveEdit}
            onDelete={() => setDeletingRow(workspaceCenterRow)}
          />
        );
      default:
        return (
          <WorkspaceOverview
            center={workspaceCenterRow}
            summary={workspaceSummary}
            agendaNames={selectedAgendaNames}
            onOpenDetail={() => goToCenterDetail(workspaceCenterRow)}
            onOpenSettings={() => startInlineEdit(workspaceCenterRow)}
          />
        );
    }
  }, [
    activeWorkspaceTab,
    actionLoading,
    centerChiefUsers,
    editErrors,
    editLoading,
    editing,
    filteredScopedMembers,
    filteredScopedProjects,
    isEditFormValid,
    memberFilters,
    memberPage,
    memberTotalPages,
    paginatedScopedMembers,
    paginatedScopedProjects,
    projectFilters,
    projectPage,
    projectTotalPages,
    resetInlineEdit,
    scopedDepartmentOptions,
    scopedLinksError,
    scopedLinksLoading,
    scopedProjectDepartmentOptions,
    scopedProjectStatusOptions,
    selectedAgendaNames,
    startInlineEdit,
    workspaceCenterRow,
    workspaceSummary,
  ]);

  return (
    <section className="page-stack-lg">
      <div className="relative overflow-hidden rounded-[2rem] border border-blue-200/80 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(255,255,255,0.98),rgba(236,253,245,0.86))] p-6 shadow-[0_28px_80px_rgba(30,58,138,0.12)]">
        <div className="pointer-events-none absolute -right-20 -top-16 h-56 w-56 rounded-full bg-blue-200/45 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <Badge className="w-fit border-blue-200 bg-white/80 px-3 py-1 text-[#1E3A8A] hover:bg-white/80">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              {isScopedCenterChief ? "My Research Center" : "Admin Workspace"}
            </Badge>
            <div>
              <h1 className="text-2xl font-bold text-[#1E3A8A] md:text-3xl">
                Research Center Workspace
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-[#1E3A8A]">
                {isScopedCenterChief
                  ? "Review the current state of your assigned research center, including member activity, linked projects, and agenda coverage."
                  : "Manage the directory from a split-view console. Select a center on the left, then review members, projects, agendas, and settings without leaving the page."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={exporting || filteredRows.length === 0}
                  className="border-blue-200 bg-white text-[#1E3A8A] hover:bg-blue-50 active:bg-blue-100"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="border border-blue-200 bg-white shadow-md"
              >
                <DropdownMenuItem
                  className="text-[#1E3A8A] hover:bg-blue-50 focus:bg-blue-50"
                  onSelect={() => exportRowsAsCsv(filteredRows, "filtered")}
                >
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[#1E3A8A] hover:bg-blue-50 focus:bg-blue-50"
                  onSelect={() => exportRowsAsPdf(filteredRows, "filtered")}
                >
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {!isScopedCenterChief ? (
              <Button
                variant="mono"
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

      <div
        className={cn(
          "grid gap-5",
          isScopedCenterChief ? "" : "xl:grid-cols-[360px_minmax(0,1fr)]",
        )}
      >
        {!isScopedCenterChief ? (
          <DirectoryPanel
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
            selectedCenterId={selectedCenterRow?.id}
            onSelectCenter={setSelectedCenterId}
            metrics={dashboardMetrics}
            dataLoading={dataLoading}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        ) : null}

        <div className="space-y-4">
          <Card className="overflow-hidden border-blue-200/80 bg-white/95 shadow-[0_24px_64px_rgba(30,58,138,0.10)]">
            <CardHeader className="space-y-4 border-b border-blue-100 bg-white px-6 py-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1E3A8A]">
                    Selected Workspace
                  </p>
                  <CardTitle className="text-2xl font-bold text-[#1E3A8A]">
                    {workspaceCenterRow?.name || "Select a Research Center"}
                  </CardTitle>
                  <CardDescription>
                    {workspaceCenterRow
                      ? `Work on ${workspaceCenterRow.name} without leaving the broader research center context.`
                      : "Choose a center from the directory to load its workspace."}
                  </CardDescription>
                </div>

                {workspaceCenterRow ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      className="border-blue-200 text-[#1E3A8A] hover:bg-blue-50"
                      onClick={() => goToCenterDetail(workspaceCenterRow)}
                    >
                      <Eye className="h-4 w-4" />
                      Open
                    </Button>
                    {!isScopedCenterChief ? (
                      <Button
                        variant="outline"
                        className="border-blue-200 text-[#1E3A8A] hover:bg-blue-50"
                        onClick={() => startInlineEdit(workspaceCenterRow)}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit Inline
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {workspaceTabs.map((tab) => (
                  <Button
                    key={tab.key}
                    type="button"
                    size="sm"
                    variant={
                      activeWorkspaceTab === tab.key ? "secondary" : "outline"
                    }
                    className={cn(
                      "rounded-full px-4",
                      activeWorkspaceTab === tab.key
                        ? "border-blue-200 bg-blue-100 text-[#1E3A8A]"
                        : "border-blue-200 bg-white text-[#1E3A8A] hover:bg-blue-50",
                    )}
                    onClick={() => setActiveWorkspaceTab(tab.key)}
                    disabled={!workspaceCenterRow}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
            </CardHeader>
          </Card>

          {dataLoading && !workspaceCenterRow && !isScopedCenterChief ? (
            <div className="space-y-3">
              <div className="h-24 animate-pulse rounded-[1.7rem] bg-blue-100/70" />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-40 animate-pulse rounded-[1.5rem] bg-blue-100/70" />
                <div className="h-40 animate-pulse rounded-[1.5rem] bg-blue-100/70" />
              </div>
            </div>
          ) : (
            workspaceContent
          )}
        </div>
      </div>

      <ConfirmActionModal
        open={Boolean(deletingRow)}
        title={
          <span className="text-base font-semibold text-[#1E3A8A]">
            Delete Research Center
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
        className="border border-blue-200 bg-white text-[#1E3A8A] shadow-md"
        cancelButtonClassName="border border-blue-200 bg-white text-[#1E3A8A] hover:bg-blue-50 active:bg-blue-100"
        confirmButtonClassName="bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] active:bg-[#1E3A8A] disabled:bg-slate-300 disabled:text-slate-500"
      />

      <CreateResearchCenterDialog
        open={createModalOpen}
        onOpenChange={(open) => {
          if (!open && !createLoading) {
            setCreateModalOpen(false);
            setCreateErrors({});
          }
        }}
        centerChiefUsers={centerChiefUsers}
        values={createDialogValues}
        errors={createErrors}
        loading={createLoading}
        isValid={isCreateFormValid}
        onFieldChange={updateCreateValues}
        onAddAgenda={addResearchAgenda}
        onRemoveAgenda={removeResearchAgenda}
        onSubmit={createResearchCenter}
      />
    </section>
  );
}
