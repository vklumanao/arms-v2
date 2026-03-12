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
import { useAuth } from "@/app/providers/AuthProvider";
import { useToast } from "@/app/providers/ToastProvider";
import {
  deleteReference,
  createReference,
  fetchReferenceData,
  fetchReferenceLinks,
  fetchReferenceUsageCounts,
  updateReference,
} from "@/features/admin/services";
import { validateCenterForm } from "@/features/admin/utils";

const INITIAL_FILTERS = {
  search: "",
  code: "",
  linkedAffiliates: "all",
  linkedProjects: "all",
  linkageState: "all",
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
  centerChiefId: "",
  agendaInput: "",
  researchAgendas: [],
};
export default function AdminResearchCenterPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const PAGE_SIZE = 10;
  const AGENDA_PAGE_SIZE = 6;
  const AGENDA_PREVIEW_COUNT = 3;
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
  const [agendaCurrentPage, setAgendaCurrentPage] = useState(1);
  const [expandedAgendaRows, setExpandedAgendaRows] = useState({});
  const [viewMode, setViewMode] = useState("grid");
  const [exporting, setExporting] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newResearchCenterName, setnewResearchCenterName] = useState("");
  const [newResearchCenterCode, setnewResearchCenterCode] = useState("");
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
  const viewModalRef = useRef(null);
  const projectModalRef = useRef(null);
  const editModalRef = useRef(null);
  const createModalRef = useRef(null);
  const lastFocusedElementRef = useRef(null);
  const modalLockScrollYRef = useRef(0);
  const isScopedCenterChief =
    profile?.role === "faculty" &&
    profile?.is_center_chief === true &&
    Boolean(profile?.managed_center_id);
  const managedCenterId = String(profile?.managed_center_id || "").trim();
  const scopedCenterRow = useMemo(
    () =>
      isScopedCenterChief
        ? rows.find((row) => String(row?.id || "").trim() === managedCenterId) ||
          null
        : null,
    [isScopedCenterChief, managedCenterId, rows],
  );

  const loadResearchCenterRows = async () => {
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
            String(centerMeta?.center_chief_id || "").trim() ||
            "";
          const centerChiefNameFromMeta = String(
            centerMeta?.center_chief_name || "",
          ).trim();
          const centerChiefNameFromId = ckanUsersData.find(
            (ckanUser) => String(ckanUser?.id || "").trim() === centerChiefId,
          )?.name;
          const centerChiefName =
            centerChiefNameFromMeta ||
            centerChiefNameFromId ||
            "";
          return {
            id: orgId,
            code: String(item?.code || "").trim() || String(orgId || "-"),
            name: item.name || "-",
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
              "Unnamed CKAN User",
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
            setScopedMembers(Array.isArray(linked?.profiles) ? linked.profiles : []);
            setScopedProjects(Array.isArray(linked?.projects) ? linked.projects : []);
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
          setScopedLinksError("Assigned Research Center could not be resolved.");
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
  };

  useEffect(() => {
    loadResearchCenterRows();
  }, [isScopedCenterChief, managedCenterId]);

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
  }, [filters, rows.length]);

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
      activeCenters: rows.filter((row) => row.totalLinks > 0).length,
    }),
    [rows],
  );

  const scopedDepartmentOptions = useMemo(
    () =>
      [...new Set(scopedMembers.map((member) => String(member?.department || "").trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
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
            .map((project) => String(project?.status || "").trim().toLowerCase())
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
      const leadResearcher = String(project?.lead_researcher || "").toLowerCase();
      const status = String(project?.status || "").trim().toLowerCase();
      const department = String(project?.department_name || "").trim();

      if (keyword && !(title.includes(keyword) || leadResearcher.includes(keyword))) {
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

  const openView = async (row) => {
    setViewRow(row);
    setViewLoading(true);
    setViewError("");
    setViewProfiles([]);
    try {
      const result = await fetchReferenceLinks({ type: "center", id: row.id });
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
      const result = await fetchReferenceLinks({ type: "center", id: row.id });
      setProjectLinks(result?.projects || []);
    } catch (loadError) {
      setProjectLinksError(
        loadError.message || "Unable to load linked projects.",
      );
    } finally {
      setProjectLinksLoading(false);
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

    const { error: createError } = await createReference({
      type: "center",
      name,
      code,
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
        <PageHeader
          title="My Research Center"
          description="Review your research center summary, search affiliated members, and inspect linked projects."
        />

        {dataLoading ? (
          <div className="panel p-6 text-sm text-slate-600">
            Loading your Research Center...
          </div>
        ) : !scopedCenterRow ? (
          <div className="panel p-6 text-sm text-red-700">
            Your assigned Research Center could not be loaded.
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className="metric-card">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Research Center
                </p>
                <p className="mt-2 text-xl font-black text-slate-900">
                  {scopedCenterRow.name}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Code: {scopedCenterRow.code}
                </p>
              </article>
              <article className="metric-card">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Center Chief
                </p>
                <p className="mt-2 text-xl font-black text-slate-900">
                  {scopedCenterRow.centerChiefName || profile?.full_name || "-"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Active Members: {scopedSummary.activeMembers}
                </p>
              </article>
              <article className="metric-card">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Linked Affiliates
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900">
                  {scopedSummary.totalMembers}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Admin: {scopedCenterRow.memberBreakdown?.adminCount || 0} Editor:{" "}
                  {scopedCenterRow.memberBreakdown?.editorCount || 0} Member:{" "}
                  {scopedCenterRow.memberBreakdown?.memberCount || 0}
                </p>
              </article>
              <article className="metric-card">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Linked Projects
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900">
                  {scopedSummary.linkedProjects}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Agendas: {scopedSummary.agendas}
                </p>
              </article>
            </div>

            <div className="panel">
              <div className="panel-header flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                <SlidersHorizontal size={14} />
                Member Filters
              </div>
              <div className="panel-body grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <label className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    className="control-input pl-8"
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
                <select
                  className="control-select"
                  value={memberFilters.role}
                  onChange={(event) =>
                    setMemberFilters((prev) => ({
                      ...prev,
                      role: event.target.value,
                    }))
                  }
                >
                  <option value="all">All roles</option>
                  <option value="admin">Admin</option>
                  <option value="faculty">Faculty</option>
                  <option value="student">Student</option>
                </select>
                <select
                  className="control-select"
                  value={memberFilters.department}
                  onChange={(event) =>
                    setMemberFilters((prev) => ({
                      ...prev,
                      department: event.target.value,
                    }))
                  }
                >
                  <option value="all">All departments</option>
                  {scopedDepartmentOptions.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <select
                    className="control-select"
                    value={memberFilters.status}
                    onChange={(event) =>
                      setMemberFilters((prev) => ({
                        ...prev,
                        status: event.target.value,
                      }))
                    }
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <button
                    className="btn btn-outline"
                    onClick={() => setMemberFilters(INITIAL_MEMBER_FILTERS)}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="panel overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
                <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
                  Research Center Members ({filteredScopedMembers.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                {scopedLinksLoading ? (
                  <p className="p-4 text-sm text-slate-600">
                    Loading affiliated members...
                  </p>
                ) : scopedLinksError ? (
                  <p className="p-4 text-sm text-red-700">{scopedLinksError}</p>
                ) : filteredScopedMembers.length === 0 ? (
                  <p className="p-4 text-sm text-slate-600">
                    No members matched the current filters.
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
                      {paginatedScopedMembers.map((member, index) => (
                        <tr key={member.id || `${member.email}-${index}`}>
                          <td>{(memberPage - 1) * MEMBER_PAGE_SIZE + index + 1}</td>
                          <td>{member.full_name || "Unnamed user"}</td>
                          <td>{member.email || "-"}</td>
                          <td className="capitalize">{member.role || "-"}</td>
                          <td>{member.department || "-"}</td>
                          <td>
                            <span
                              className={`status-chip ${
                                member.is_active !== false
                                  ? "status-completed"
                                  : "status-rejected"
                              }`}
                            >
                              {member.is_active !== false ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td>
                            <code>{member.id || "-"}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <PaginationControls
                page={memberPage}
                totalPages={memberTotalPages}
                onPageChange={setMemberPage}
                className="rounded-none border-0 border-t border-[var(--border)]"
              />
            </div>

            <div className="panel">
              <div className="panel-header flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                <FolderKanban size={14} />
                Project Filters
              </div>
              <div className="panel-body grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <label className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    className="control-input pl-8"
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
                <select
                  className="control-select"
                  value={projectFilters.status}
                  onChange={(event) =>
                    setProjectFilters((prev) => ({
                      ...prev,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="all">All statuses</option>
                  {scopedProjectStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <select
                  className="control-select"
                  value={projectFilters.department}
                  onChange={(event) =>
                    setProjectFilters((prev) => ({
                      ...prev,
                      department: event.target.value,
                    }))
                  }
                >
                  <option value="all">All departments</option>
                  {scopedProjectDepartmentOptions.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-outline"
                  onClick={() => setProjectFilters(INITIAL_PROJECT_FILTERS)}
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="panel overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
                <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
                  Linked Projects ({filteredScopedProjects.length})
                </h2>
              </div>
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
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Project Title</th>
                        <th>Status</th>
                        <th>Year</th>
                        <th>Lead Researcher</th>
                        <th>Department</th>
                        <th>Agendum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedScopedProjects.map((project, index) => (
                        <tr key={project.id || `${project.title}-${index}`}>
                          <td>{(projectPage - 1) * PROJECT_PAGE_SIZE + index + 1}</td>
                          <td>{project.title || "-"}</td>
                          <td className="capitalize">{project.status || "-"}</td>
                          <td>{project.year || "-"}</td>
                          <td>{project.lead_researcher || "-"}</td>
                          <td>{project.department_name || "-"}</td>
                          <td>{project.agenda_name || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <PaginationControls
                page={projectPage}
                totalPages={projectTotalPages}
                onPageChange={setProjectPage}
                className="rounded-none border-0 border-t border-[var(--border)]"
              />
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Research Center"
        description={
          isScopedCenterChief
            ? "Inspect the research center you manage, including linked affiliates and projects."
            : "Manage research center records and inspect linked affiliates and projects in one view."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="metric-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <Building2 size={14} />
            Total Centers
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
            Active Centers
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {stats.activeCenters}
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
            placeholder="Center code"
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
              <option value="all">All center states</option>
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
            Research Center Records ({filteredRows.length})
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
            {!isScopedCenterChief ? (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setCreateErrors({});
                  setCreateModalOpen(true);
                }}
              >
                Create Research Center
              </button>
            ) : null}
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
              No research center records found.
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
                      Center Chief: {row.centerChiefName || "-"}
                    </span>
                    <span className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1">
                      Agenda: {row.agendaCount || 0}
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
                    {!isScopedCenterChief ? (
                      <>
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
                      </>
                    ) : null}
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
                          Research Center{" "}
                          <span>{getSortIndicator("name")}</span>
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          className={`table-sort-btn ${sortConfig.key === "centerChiefName" ? "active" : ""}`}
                          onClick={() => toggleSort("centerChiefName")}
                        >
                          Center Chief{" "}
                          <span>{getSortIndicator("centerChiefName")}</span>
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          className={`table-sort-btn ${sortConfig.key === "agendaCount" ? "active" : ""}`}
                          onClick={() => toggleSort("agendaCount")}
                        >
                          Agenda <span>{getSortIndicator("agendaCount")}</span>
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
                        <td>{row.centerChiefName || "-"}</td>
                        <td>{row.agendaCount || 0}</td>
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
                          {!isScopedCenterChief ? (
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
                          ) : (
                            <span className="text-sm text-slate-500">
                              Scoped access
                            </span>
                          )}
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

      <div className="panel overflow-hidden">
        <div className="border-b border-[var(--border)] bg-gradient-to-r from-slate-50 via-white to-sky-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-600">
              Research Center Agenda
            </h2>
            <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-sm font-semibold text-slate-600">
              {filteredRows.length} centers
            </span>
          </div>
        </div>
        <div className="max-h-[80vh] overflow-auto p-4">
          {agendaMatrixLoading ? (
            <p className="text-sm text-slate-600">Loading center agenda...</p>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-sm text-slate-600">
              No research center records found.
            </div>
          ) : (
            <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                  <section
                    key={`agenda-group-${row.id}`}
                    className="app-card app-card-compact"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {row.code || "-"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.name || "-"}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">
                        {agendaNames.length}{" "}
                        {agendaNames.length === 1 ? "Agendum" : "Agenda"}
                      </span>
                    </div>

                    <div className="relative pl-6">
                      <span className="absolute left-2 top-0 h-full w-px bg-[var(--border)]" />
                      <ul className="space-y-1.5">
                        {displayAgendas.map((agendaName) => (
                          <li
                            key={`${row.id}-${agendaName}`}
                            className="relative rounded-md bg-[var(--surface-muted)] px-3 py-2 text-sm text-slate-700"
                          >
                            <span className="absolute -left-4 top-1/2 h-px w-4 -translate-y-1/2 bg-[var(--border)]" />
                            <span className="absolute -left-[18px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--border-strong)]" />
                            {agendaName}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {hasOverflow ? (
                      <div className="mt-2 pl-6">
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
                  </section>
                );
              })}
            </div>
          )}
        </div>
        <PaginationControls
          page={agendaCurrentPage}
          totalPages={agendaTotalPages}
          onPageChange={setAgendaCurrentPage}
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
                  Research Center Details
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
                  Center Code
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
                  Center Chief
                </dt>
                <dd className="mt-1 font-semibold text-slate-800">
                  {viewRow.centerChiefName || "-"}
                </dd>
              </div>
              <div className="app-card-muted app-card-compact">
                <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                  Research Agenda
                </dt>
                <dd className="mt-1 font-semibold text-slate-800">
                  {viewRow.agendaCount || 0}
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
                    No affiliates are currently linked to this research center.
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
                    No linked projects found for this research center.
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
                        <th>Agendum</th>
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
        title="Delete Research Center"
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
              Edit Research Center
            </h3>
            <p className="modal-subtitle mt-1 text-sm text-slate-600">
              Update all research center information.
            </p>

            {editLoading ? (
              <p className="mt-4 text-sm text-slate-600">
                Loading center details...
              </p>
            ) : (
              <>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Research Center Name *
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
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Center Chief *
                    </label>
                    <select
                      className={`control-select ${editErrors.centerChiefId ? "input-error" : ""}`}
                      value={editing.centerChiefId}
                      onChange={(event) => {
                        setEditing((prev) => ({
                          ...prev,
                          centerChiefId: event.target.value,
                        }));
                        setEditErrors((prev) => ({
                          ...prev,
                          centerChiefId: "",
                        }));
                      }}
                    >
                      <option value="">Select Center Chief</option>
                      {centerChiefUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                    {editErrors.centerChiefId ? (
                      <p className="field-error">{editErrors.centerChiefId}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Research Agendum *
                  </label>
                  <div className="flex gap-2">
                    <input
                      className={`control-input ${editErrors.researchAgendas ? "input-error" : ""}`}
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
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={addEditAgenda}
                    >
                      Add
                    </button>
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
                    <p className="field-error">{editErrors.researchAgendas}</p>
                  ) : null}
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
              Create Research Center
            </h3>
            <p className="modal-subtitle mt-1 text-sm text-slate-600">
              Add a new research center to the research center registry.
            </p>
            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Research Center Name *
              </label>
              <input
                className={`control-input ${createErrors.name ? "input-error" : ""}`}
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
            <div className="mt-3 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Code *
              </label>
              <input
                className={`control-input ${createErrors.code ? "input-error" : ""}`}
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
            <div className="mt-3 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Center Chief *
              </label>
              <select
                className={`control-select ${createErrors.centerChiefId ? "input-error" : ""}`}
                value={newCenterChiefId}
                onChange={(event) => {
                  setNewCenterChiefId(event.target.value);
                  setCreateErrors((prev) => ({ ...prev, centerChiefId: "" }));
                }}
                required
              >
                <option value="">Select Center Chief</option>
                {centerChiefUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              {createErrors.centerChiefId ? (
                <p className="field-error">{createErrors.centerChiefId}</p>
              ) : null}
              <p className="text-xs text-slate-500">Select from CKAN users.</p>
            </div>
            <div className="mt-3 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Research Agendum *
              </label>
              <div className="flex gap-2">
                <input
                  className={`control-input ${createErrors.researchAgendas ? "input-error" : ""}`}
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
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={addResearchAgenda}
                >
                  Add
                </button>
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
                onClick={createResearchCenter}
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
