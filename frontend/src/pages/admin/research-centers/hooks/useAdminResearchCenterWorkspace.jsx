import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
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
} from "../constants";
import {
  addUniqueTrimmedItem,
  buildDeleteGuard,
  buildResearchCenterCsvContent,
  buildResearchCenterPdfRowsHtml,
  createEditingState,
  normalizeUniqueNames,
  removeItem,
  toId,
} from "../helpers";
import usePagedList from "./usePagedList";
import WorkspaceOverview from "../components/WorkspaceOverview";
import MembersPanel from "../components/MembersPanel";
import ProjectsPanel from "../components/ProjectsPanel";
import AgendasPanel from "../components/AgendasPanel";
import SettingsPanel from "../components/SettingsPanel";

function applyErrorResets(setErrors, patch, keyMap) {
  const keysToClear = Object.entries(keyMap)
    .filter(([patchKey]) => patch[patchKey] !== undefined)
    .map(([, errorKey]) => errorKey)
    .filter(Boolean);

  if (!keysToClear.length) return;
  setErrors((prev) => {
    const next = { ...prev };
    keysToClear.forEach((key) => {
      next[key] = "";
    });
    return next;
  });
}

export default function useAdminResearchCenterWorkspace() {
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
  const [selectedCenterId, setSelectedCenterId] = useState("");
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("overview");

  const isScopedCenterChief =
    profile?.is_center_chief === true && Boolean(profile?.managed_center_id);
  const managedCenterId = toId(profile?.managed_center_id);

  const scopedCenterRow = useMemo(
    () =>
      isScopedCenterChief
        ? rows.find((row) => toId(row?.id) === managedCenterId) || null
        : null,
    [isScopedCenterChief, managedCenterId, rows],
  );

  const loadCenterLinks = useCallback(async (centerId) => {
    const id = toId(centerId);
    if (!id) {
      setScopedMembers([]);
      setScopedProjects([]);
      setScopedLinksError("");
      return;
    }

    setScopedLinksLoading(true);
    setScopedLinksError("");
    try {
      const linked = await fetchReferenceLinks({ type: "center", id });
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
          const key = toId(center?.id).toLowerCase();
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
                ? normalizeUniqueNames(
                    linked.agendas.map((agenda) => String(agenda?.name || "")),
                  ).sort((a, b) => a.localeCompare(b))
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
            centerMetaById[toId(item?.id).toLowerCase()] || null;
          const centerChiefId = toId(centerMeta?.center_chief_id);
          const centerChiefNameFromMeta = String(
            centerMeta?.center_chief_name || "",
          ).trim();
          const centerChiefNameFromId = ckanUsersData.find(
            (ckanUser) => toId(ckanUser?.id) === centerChiefId,
          )?.name;
          const centerChiefName =
            centerChiefNameFromMeta || centerChiefNameFromId || "";

          return {
            id: item?.id,
            code: toId(item?.code) || toId(item?.id) || "-",
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
          isScopedCenterChief ? toId(row?.id) === managedCenterId : true,
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
          (row) => toId(row?.id) === managedCenterId,
        );
        if (managedRow) {
          await loadCenterLinks(managedRow.id);
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
  }, [isScopedCenterChief, loadCenterLinks, managedCenterId]);

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
          toId(row.id).toLowerCase().includes(keyword)
        )
      ) {
        return false;
      }

      return true;
    });
  }, [agendaNamesByCenterId, filters.search, quickFilter, rows]);

  const mainPaging = usePagedList({
    totalItems: filteredRows.length,
    pageSize: PAGE_SIZE,
    resetKeys: [filters.search, quickFilter, rows.length],
  });
  const currentPage = mainPaging.page;
  const setCurrentPage = mainPaging.setPage;
  const totalPages = mainPaging.totalPages;

  const paginatedRows = useMemo(
    () => filteredRows.slice(mainPaging.start, mainPaging.start + PAGE_SIZE),
    [filteredRows, mainPaging.start],
  );

  const selectedCenterRow = useMemo(() => {
    if (isScopedCenterChief) return null;
    if (!filteredRows.length) return null;
    return (
      filteredRows.find((row) => toId(row?.id) === toId(selectedCenterId)) ||
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
      (row) => toId(row?.id) === toId(selectedCenterId),
    );

    if (!isCurrentSelectionVisible) {
      setSelectedCenterId(toId(filteredRows[0]?.id));
    }
  }, [filteredRows, isScopedCenterChief, selectedCenterId]);

  useEffect(() => {
    if (isScopedCenterChief || !workspaceCenterRow?.id) return;
    loadCenterLinks(workspaceCenterRow.id);
  }, [isScopedCenterChief, loadCenterLinks, workspaceCenterRow?.id]);

  const scopedDepartmentOptions = useMemo(
    () =>
      normalizeUniqueNames(
        scopedMembers.map((member) => String(member?.department || "")),
      ).sort((a, b) => a.localeCompare(b)),
    [scopedMembers],
  );

  const scopedProjectDepartmentOptions = useMemo(
    () =>
      normalizeUniqueNames(
        scopedProjects.map((project) => String(project?.department_name || "")),
      ).sort((a, b) => a.localeCompare(b)),
    [scopedProjects],
  );

  const scopedProjectStatusOptions = useMemo(
    () =>
      normalizeUniqueNames(
        scopedProjects.map((project) =>
          String(project?.status || "")
            .trim()
            .toLowerCase(),
        ),
      ).sort((a, b) => a.localeCompare(b)),
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

  const memberPaging = usePagedList({
    totalItems: filteredScopedMembers.length,
    pageSize: MEMBER_PAGE_SIZE,
    resetKeys: [
      memberFilters.search,
      memberFilters.role,
      memberFilters.department,
      memberFilters.status,
      scopedMembers.length,
    ],
  });

  const projectPaging = usePagedList({
    totalItems: filteredScopedProjects.length,
    pageSize: PROJECT_PAGE_SIZE,
    resetKeys: [
      projectFilters.search,
      projectFilters.status,
      projectFilters.department,
      scopedProjects.length,
    ],
  });

  const memberPage = memberPaging.page;
  const setMemberPage = memberPaging.setPage;
  const memberTotalPages = memberPaging.totalPages;
  const paginatedScopedMembers = useMemo(
    () =>
      filteredScopedMembers.slice(
        memberPaging.start,
        memberPaging.start + MEMBER_PAGE_SIZE,
      ),
    [filteredScopedMembers, memberPaging.start],
  );

  const projectPage = projectPaging.page;
  const setProjectPage = projectPaging.setPage;
  const projectTotalPages = projectPaging.totalPages;
  const paginatedScopedProjects = useMemo(
    () =>
      filteredScopedProjects.slice(
        projectPaging.start,
        projectPaging.start + PROJECT_PAGE_SIZE,
      ),
    [filteredScopedProjects, projectPaging.start],
  );

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
        ? normalizeUniqueNames(
            result.agendas.map((agenda) => String(agenda?.name || "")),
          )
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
    applyErrorResets(setEditErrors, patch, {
      name: "name",
      code: "code",
      centerChiefId: "centerChiefId",
      agendaInput: "researchAgendas",
      researchAgendas: "researchAgendas",
    });
  };

  const addEditAgenda = () => {
    const { items } = addUniqueTrimmedItem(
      editing.researchAgendas,
      editing.agendaInput,
    );
    updateEditing({ researchAgendas: items, agendaInput: "" });
  };

  const removeEditAgenda = (agendaName) => {
    updateEditing({
      researchAgendas: removeItem(editing.researchAgendas, agendaName),
    });
  };

  const saveEdit = async () => {
    setEditErrors(editValidationErrors);
    if (!editing.id || !isEditFormValid) return;

    const nextName = editing.name.trim();
    const nextCode = editing.code.trim();

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
    const id = toId(row?.id);
    if (!id) return;
    const query = tab ? `?tab=${encodeURIComponent(tab)}` : "";
    navigate(`/admin/research-center/${encodeURIComponent(id)}${query}`);
  };

  const updateCreateValues = (patch) => {
    if (patch.name !== undefined) setNewResearchCenterName(patch.name);
    if (patch.code !== undefined) setNewResearchCenterCode(patch.code);
    if (patch.description !== undefined) {
      setNewResearchCenterDescription(patch.description);
    }
    if (patch.socialMediaLink !== undefined) {
      setNewResearchCenterSocialMediaLink(patch.socialMediaLink);
    }
    if (patch.socialMediaPlatform !== undefined) {
      setNewResearchCenterSocialMediaPlatform(patch.socialMediaPlatform);
    }
    if (patch.centerChiefId !== undefined)
      setNewCenterChiefId(patch.centerChiefId);
    if (patch.agendaInput !== undefined) setNewAgendaInput(patch.agendaInput);

    applyErrorResets(setCreateErrors, patch, {
      name: "name",
      code: "code",
      centerChiefId: "centerChiefId",
      researchAgendas: "researchAgendas",
    });
  };

  const createResearchCenter = async () => {
    setCreateErrors(createValidationErrors);
    if (!isCreateFormValid) return;

    const name = newResearchCenterName.trim();
    const code = newResearchCenterCode.trim();

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
    const { items } = addUniqueTrimmedItem(newResearchAgendas, newAgendaInput);
    setNewResearchAgendas(items);
    setNewAgendaInput("");
    setCreateErrors((prev) => ({ ...prev, researchAgendas: "" }));
  };

  const removeResearchAgenda = (agendaName) => {
    setNewResearchAgendas((prev) => removeItem(prev, agendaName));
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
      const csv = buildResearchCenterCsvContent(dataset);
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
      const rowsHtml = buildResearchCenterPdfRowsHtml(dataset);

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

  const deleteGuard = useMemo(
    () => buildDeleteGuard(deletingRow),
    [deletingRow],
  );

  const createDialogValues = useMemo(
    () => ({
      name: newResearchCenterName,
      code: newResearchCenterCode,
      description: newResearchCenterDescription,
      socialMediaLink: newResearchCenterSocialMediaLink,
      socialMediaPlatform: newResearchCenterSocialMediaPlatform,
      centerChiefId: newCenterChiefId,
      agendaInput: newAgendaInput,
      researchAgendas: newResearchAgendas,
    }),
    [
      newAgendaInput,
      newCenterChiefId,
      newResearchAgendas,
      newResearchCenterCode,
      newResearchCenterDescription,
      newResearchCenterName,
      newResearchCenterSocialMediaLink,
      newResearchCenterSocialMediaPlatform,
    ],
  );

  const membersPanelProps = useMemo(
    () => ({
      center: workspaceCenterRow,
      filters: memberFilters,
      onFiltersChange: setMemberFilters,
      departmentOptions: scopedDepartmentOptions,
      filteredRows: filteredScopedMembers,
      paginatedRows: paginatedScopedMembers,
      loading: scopedLinksLoading,
      error: scopedLinksError,
      page: memberPage,
      totalPages: memberTotalPages,
      onPageChange: setMemberPage,
    }),
    [
      filteredScopedMembers,
      memberFilters,
      memberPage,
      memberTotalPages,
      paginatedScopedMembers,
      scopedDepartmentOptions,
      scopedLinksError,
      scopedLinksLoading,
      workspaceCenterRow,
    ],
  );

  const projectsPanelProps = useMemo(
    () => ({
      center: workspaceCenterRow,
      filters: projectFilters,
      onFiltersChange: setProjectFilters,
      statusOptions: scopedProjectStatusOptions,
      departmentOptions: scopedProjectDepartmentOptions,
      filteredRows: filteredScopedProjects,
      paginatedRows: paginatedScopedProjects,
      loading: scopedLinksLoading,
      error: scopedLinksError,
      page: projectPage,
      totalPages: projectTotalPages,
      onPageChange: setProjectPage,
    }),
    [
      filteredScopedProjects,
      paginatedScopedProjects,
      projectFilters,
      projectPage,
      projectTotalPages,
      scopedLinksError,
      scopedLinksLoading,
      scopedProjectDepartmentOptions,
      scopedProjectStatusOptions,
      workspaceCenterRow,
    ],
  );

  const settingsPanelProps = useMemo(
    () => ({
      center: workspaceCenterRow,
      editing,
      editErrors,
      editLoading,
      actionLoading,
      isEditFormValid,
      centerChiefUsers,
      onChange: updateEditing,
      onAddAgenda: addEditAgenda,
      onRemoveAgenda: removeEditAgenda,
      onCancel: resetInlineEdit,
      onSave: saveEdit,
      onDelete: () => setDeletingRow(workspaceCenterRow),
    }),
    [
      actionLoading,
      centerChiefUsers,
      editErrors,
      editLoading,
      editing,
      isEditFormValid,
      resetInlineEdit,
      workspaceCenterRow,
    ],
  );

  const workspaceContent = useMemo(() => {
    if (!workspaceCenterRow) {
      return (
        <div className="rounded-[1.7rem] border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-[#1E293B]">
          Select a research center from the directory to open its workspace.
        </div>
      );
    }

    switch (activeWorkspaceTab) {
      case "members":
        return <MembersPanel {...membersPanelProps} />;
      case "projects":
        return <ProjectsPanel {...projectsPanelProps} />;
      case "agendas":
        return (
          <AgendasPanel
            center={workspaceCenterRow}
            agendaNames={selectedAgendaNames}
          />
        );
      case "settings":
        return <SettingsPanel {...settingsPanelProps} />;
      default:
        return (
          <WorkspaceOverview
            center={workspaceCenterRow}
            summary={workspaceSummary}
            agendaNames={selectedAgendaNames}
          />
        );
    }
  }, [
    activeWorkspaceTab,
    membersPanelProps,
    projectsPanelProps,
    selectedAgendaNames,
    settingsPanelProps,
    workspaceCenterRow,
    workspaceSummary,
  ]);

  return {
    isScopedCenterChief,
    dataLoading,
    filters,
    setFilters,
    quickFilter,
    setQuickFilter,
    filteredRows,
    paginatedRows,
    quickFilterChips,
    selectedCenterRow,
    setSelectedCenterId,
    dashboardMetrics,
    currentPage,
    totalPages,
    setCurrentPage,
    exporting,
    exportRowsAsCsv,
    exportRowsAsPdf,
    setCreateErrors,
    setCreateModalOpen,
    workspaceCenterRow,
    workspaceTabs,
    activeWorkspaceTab,
    setActiveWorkspaceTab,
    goToCenterDetail,
    startInlineEdit,
    workspaceContent,
    deletingRow,
    setDeletingRow,
    deleteGuard,
    actionLoading,
    confirmDelete,
    createModalOpen,
    createLoading,
    centerChiefUsers,
    createDialogValues,
    createErrors,
    isCreateFormValid,
    updateCreateValues,
    addResearchAgenda,
    removeResearchAgenda,
    createResearchCenter,
    INITIAL_FILTERS,
  };
}
