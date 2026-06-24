import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useToast } from "@/components/providers/ToastProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  deleteReference,
  fetchReferenceData,
  fetchReferenceLinks,
  fetchReferenceUsageCounts,
  updateReference,
  updateAffiliateProfile,
} from "@/services/admin";
import { validateCenterForm } from "@/utils/admin";
import { normalizeStatus } from "@/utils/status";

const PAGE_SIZE = 10;

function normalizeTab(value) {
  const tab = String(value || "")
    .trim()
    .toLowerCase();
  if (["affiliates", "projects", "scorecards"].includes(tab)) return tab;
  return "projects";
}

function normalizeOption(value, fallback = "all") {
  return String(value || fallback).trim() || fallback;
}

function getSocialMeta(url) {
  const value = String(url || "")
    .trim()
    .toLowerCase();
  if (!value) return null;
  if (value.includes("facebook.com") || value.includes("fb.com")) {
    return { label: "Facebook", iconKey: "facebook" };
  }
  if (value.includes("instagram.com")) {
    return { label: "Instagram", iconKey: "instagram" };
  }
  if (value.includes("x.com") || value.includes("twitter.com")) {
    return { label: "X (Twitter)", iconKey: "twitter" };
  }
  if (value.includes("linkedin.com")) {
    return { label: "LinkedIn", iconKey: "linkedin" };
  }
  if (value.includes("youtube.com") || value.includes("youtu.be")) {
    return { label: "YouTube", iconKey: "youtube" };
  }
  return { label: "Website", iconKey: "website" };
}

function mapCenterModel(centerId, centerRow, ckanUsersData, linksPayload) {
  const centerChiefId = String(centerRow?.center_chief_id || "").trim();
  const centerChiefNameFromMeta = String(
    centerRow?.center_chief_name || "",
  ).trim();
  const centerChiefNameFromId = ckanUsersData.find(
    (ckanUser) => String(ckanUser?.id || "").trim() === centerChiefId,
  )?.name;
  const centerChiefName =
    centerChiefNameFromMeta || centerChiefNameFromId || "";

  const agendaNames = Array.isArray(linksPayload?.agendas)
    ? [
        ...new Set(
          linksPayload.agendas
            .map((agenda) => String(agenda?.name || "").trim())
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b))
    : [];

  return centerRow
    ? {
        id: centerId,
        name: centerRow?.name || "-",
        code: String(centerRow?.code || "").trim() || centerId,
        description: String(centerRow?.description || "").trim(),
        socialMediaLink: String(centerRow?.social_media_link || "").trim(),
        centerChiefId: centerChiefId || null,
        centerChiefName: centerChiefName || "-",
        agendaNames,
      }
    : null;
}

function buildAssignableChiefUsers(ckanUsersData, centersData, options = {}) {
  const allowAssignedIds = new Set(
    (Array.isArray(options.allowAssignedIds) ? options.allowAssignedIds : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );

  const assignedChiefIds = new Set(
    (Array.isArray(centersData) ? centersData : [])
      .map((center) => String(center?.center_chief_id || "").trim())
      .filter(Boolean),
  );

  return (Array.isArray(ckanUsersData) ? ckanUsersData : [])
    .filter((row) => {
      const userId = String(row?.id || "").trim();
      const isFaculty = String(row?.role || "").toLowerCase() === "faculty";
      const isDeleted = String(row?.state || "").toLowerCase() === "deleted";
      const isAssignedElsewhere =
        assignedChiefIds.has(userId) && !allowAssignedIds.has(userId);
      return userId && isFaculty && !isDeleted && !isAssignedElsewhere;
    })
    .map((row) => ({
      id: String(row?.id || "").trim(),
      name:
        String(
          row?.name ||
            row?.fullname ||
            row?.display_name ||
            row?.username ||
            row?.email ||
            "",
        ).trim() || "Unnamed User",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function useAdminResearchCenterDetailWorkspace() {
  const toast = useToast();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const centerId = String(params?.id || "").trim();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeTab(searchParams.get("tab"));
  const projectParamsKey = searchParams.toString();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [center, setCenter] = useState(null);
  const [chiefUsers, setChiefUsers] = useState([]);
  const [usage, setUsage] = useState({
    projectCount: 0,
    profileCount: 0,
    memberBreakdown: {
      adminCount: 0,
      editorCount: 0,
      memberCount: 0,
      totalCount: 0,
    },
  });
  const [links, setLinks] = useState({
    profiles: [],
    projects: [],
    agendas: [],
  });

  const [affiliatesPage, setAffiliatesPage] = useState(1);
  const [projectsPage, setProjectsPage] = useState(1);
  const [agendaFilter, setAgendaFilter] = useState("");
  const [projectSearch, setProjectSearch] = useState(() =>
    String(searchParams.get("projectSearch") || "").trim(),
  );
  const [projectStatus, setProjectStatus] = useState(() =>
    normalizeOption(searchParams.get("projectStatus"), "all"),
  );
  const [projectYear, setProjectYear] = useState(() =>
    normalizeOption(searchParams.get("projectYear"), "all"),
  );

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    description: "",
    socialMediaLink: "",
    centerChiefId: "",
    agendaInput: "",
    researchAgendas: [],
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unlinkAffiliateSaving, setUnlinkAffiliateSaving] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState(null);

  const isCenterChief = profile?.is_center_chief === true;

  useEffect(() => {
    setAffiliatesPage(1);
    setProjectsPage(1);
    setAgendaFilter("");
  }, [centerId]);

  useEffect(() => {
    const nextSearch = String(searchParams.get("projectSearch") || "").trim();
    const nextStatus = normalizeOption(
      searchParams.get("projectStatus"),
      "all",
    );
    const nextYear = normalizeOption(searchParams.get("projectYear"), "all");

    if (nextSearch !== projectSearch) setProjectSearch(nextSearch);
    if (nextStatus !== projectStatus) setProjectStatus(nextStatus);
    if (nextYear !== projectYear) setProjectYear(nextYear);
  }, [
    projectParamsKey,
    projectSearch,
    projectStatus,
    projectYear,
    searchParams,
  ]);

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (projectSearch) {
          next.set("projectSearch", projectSearch);
        } else {
          next.delete("projectSearch");
        }
        if (projectStatus && projectStatus !== "all") {
          next.set("projectStatus", projectStatus);
        } else {
          next.delete("projectStatus");
        }
        if (projectYear && projectYear !== "all") {
          next.set("projectYear", projectYear);
        } else {
          next.delete("projectYear");
        }
        return next;
      },
      { replace: true },
    );
  }, [projectSearch, projectStatus, projectYear, setSearchParams]);

  useEffect(() => {
    setProjectsPage(1);
  }, [projectSearch, projectStatus, projectYear]);

  const refreshCenter = async () => {
    if (!centerId) return;
    setLoading(true);
    setError("");

    try {
      const [referencePayload, usagePayload, linksPayload] = await Promise.all([
        fetchReferenceData(),
        fetchReferenceUsageCounts({ type: "center", id: centerId }),
        fetchReferenceLinks({ type: "center", id: centerId }),
      ]);

      const centersData = referencePayload?.centersRes?.data || [];
      const ckanUsersData = referencePayload?.ckanUsersRes?.data || [];
      const centerRow = centersData.find(
        (row) => String(row?.id || "").trim() === centerId,
      );

      const chiefOptions = buildAssignableChiefUsers(
        ckanUsersData,
        centersData,
        {
          allowAssignedIds: [centerRow?.center_chief_id],
        },
      );

      const nextCenter = mapCenterModel(
        centerId,
        centerRow,
        ckanUsersData,
        linksPayload,
      );
      const agendaNames = nextCenter?.agendaNames || [];

      setChiefUsers(chiefOptions);
      setCenter(nextCenter);
      setEditForm({
        name: String(centerRow?.name || "").trim(),
        code: String(centerRow?.code || "").trim() || String(centerId || ""),
        description: String(centerRow?.description || "").trim(),
        socialMediaLink: String(centerRow?.social_media_link || "").trim(),
        centerChiefId: String(centerRow?.center_chief_id || "").trim(),
        agendaInput: "",
        researchAgendas: agendaNames,
      });
      setUsage({
        projectCount: Number(usagePayload?.projectCount || 0),
        profileCount: Number(usagePayload?.profileCount || 0),
        memberBreakdown: usagePayload?.memberBreakdown || {
          adminCount: 0,
          editorCount: 0,
          memberCount: 0,
          totalCount: 0,
        },
      });
      setLinks({
        profiles: Array.isArray(linksPayload?.profiles)
          ? linksPayload.profiles
          : [],
        projects: Array.isArray(linksPayload?.projects)
          ? linksPayload.projects
          : [],
        agendas: Array.isArray(linksPayload?.agendas)
          ? linksPayload.agendas
          : [],
      });
    } catch (e) {
      setError(String(e?.message || "Unable to load research center details."));
    } finally {
      setLoading(false);
    }
  };

  const refreshRef = useRef(refreshCenter);
  refreshRef.current = refreshCenter;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (cancelled) return;
      await refreshRef.current();
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [centerId]);

  const deleteGuard = useMemo(() => {
    const projectCount = Number(usage?.projectCount || 0);
    const editorCount = Number(usage?.memberBreakdown?.editorCount || 0);
    const memberCount = Number(usage?.memberBreakdown?.memberCount || 0);
    const nonAdminAffiliates = editorCount + memberCount;
    const blocked = projectCount > 0 || nonAdminAffiliates > 0;
    return {
      blocked,
      reasons: {
        projectCount,
        nonAdminAffiliates,
      },
    };
  }, [
    usage?.memberBreakdown?.editorCount,
    usage?.memberBreakdown?.memberCount,
    usage?.projectCount,
  ]);

  const paginatedAffiliates = useMemo(() => {
    const start = (affiliatesPage - 1) * PAGE_SIZE;
    return links.profiles.slice(start, start + PAGE_SIZE);
  }, [affiliatesPage, links.profiles]);

  const affiliatesTotalPages = useMemo(
    () => Math.max(1, Math.ceil(links.profiles.length / PAGE_SIZE)),
    [links.profiles.length],
  );

  const filteredProjects = useMemo(() => {
    const filterValue = String(agendaFilter || "")
      .trim()
      .toLowerCase();
    const statusFilter = String(projectStatus || "all").toLowerCase();
    const yearFilter = String(projectYear || "all").toLowerCase();
    const query = String(projectSearch || "")
      .trim()
      .toLowerCase();

    return (links.projects || []).filter((row) => {
      const agendaName = String(row?.agenda_name || "")
        .trim()
        .toLowerCase();
      const status = String(row?.status || "").toLowerCase();
      const year = String(row?.year || "").toLowerCase();
      if (filterValue && agendaName !== filterValue) return false;
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (yearFilter !== "all" && year !== yearFilter) return false;
      const haystack = [
        row?.title,
        row?.status,
        row?.year,
        row?.lead_researcher,
        row?.organization_name,
        row?.research_center,
        row?.agenda_name,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return query ? haystack.includes(query) : true;
    });
  }, [agendaFilter, links.projects, projectSearch, projectStatus, projectYear]);

  const projectStatusOptions = useMemo(() => {
    const unique = new Set();
    (links.projects || []).forEach((row) => {
      const value = String(row?.status || "")
        .trim()
        .toLowerCase();
      if (value) unique.add(value);
    });
    return ["all", ...Array.from(unique).sort()];
  }, [links.projects]);

  const projectYearOptions = useMemo(() => {
    const unique = new Set();
    (links.projects || []).forEach((row) => {
      const value = String(row?.year || "").trim();
      if (value) unique.add(value);
    });
    return ["all", ...Array.from(unique).sort((a, b) => b.localeCompare(a))];
  }, [links.projects]);

  const paginatedProjects = useMemo(() => {
    const start = (projectsPage - 1) * PAGE_SIZE;
    return filteredProjects.slice(start, start + PAGE_SIZE);
  }, [projectsPage, filteredProjects]);

  const projectsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE)),
    [filteredProjects.length],
  );

  const editErrors = useMemo(
    () =>
      validateCenterForm({
        name: editForm.name,
        code: editForm.code,
        centerChiefId: editForm.centerChiefId,
        researchAgendas: editForm.researchAgendas,
      }),
    [editForm],
  );

  const isEditValid = Object.keys(editErrors).length === 0;

  const setTab = (tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      if (tab !== "projects") {
        next.delete("projectSearch");
        next.delete("projectStatus");
        next.delete("projectYear");
      }
      return next;
    });
  };

  const clearProjectFilters = () => {
    setProjectSearch("");
    setProjectStatus("all");
    setProjectYear("all");
    setAgendaFilter("");
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("projectSearch");
        next.delete("projectStatus");
        next.delete("projectYear");
        return next;
      },
      { replace: true },
    );
  };

  const applyAgendaFilter = (agenda) => {
    const next = String(agenda || "").trim();
    setAgendaFilter((prev) => {
      const normalizedPrev = String(prev || "").trim();
      if (normalizedPrev && normalizedPrev === next) return "";
      return next;
    });
    setProjectsPage(1);
    setTab("projects");
  };

  const updateEditForm = (patch) => {
    setEditForm((prev) => ({ ...prev, ...patch }));
  };

  const addEditAgenda = () => {
    const next = String(editForm.agendaInput || "").trim();
    if (!next) return;
    if (editForm.researchAgendas.includes(next)) {
      updateEditForm({ agendaInput: "" });
      return;
    }
    updateEditForm({
      agendaInput: "",
      researchAgendas: [...editForm.researchAgendas, next],
    });
  };

  const removeEditAgenda = (agendaName) => {
    updateEditForm({
      researchAgendas: editForm.researchAgendas.filter(
        (item) => item !== agendaName,
      ),
    });
  };

  const saveCenter = async () => {
    if (!centerId || editSaving) return;
    if (!isEditValid) {
      toast.error("Validation failed", "Please fix the form errors first.");
      return;
    }

    setEditSaving(true);
    try {
      const { error: updateError } = await updateReference({
        type: "center",
        id: centerId,
        name: String(editForm.name || "").trim(),
        code: String(editForm.code || "").trim(),
        description: String(editForm.description || "").trim(),
        social_media_link: String(editForm.socialMediaLink || "").trim(),
        center_chief_id: String(editForm.centerChiefId || "").trim(),
        research_agendas: Array.isArray(editForm.researchAgendas)
          ? editForm.researchAgendas
          : [],
      });
      if (updateError) throw updateError;

      toast.success("Research center updated", "Changes were saved.");
      setEditOpen(false);
      await refreshCenter();
    } catch (e) {
      toast.error(
        "Update failed",
        String(e?.message || "Unable to update research center."),
      );
    } finally {
      setEditSaving(false);
    }
  };

  const unlinkAffiliate = async () => {
    const userId = String(unlinkTarget?.id || "").trim();
    if (!userId || unlinkAffiliateSaving) return;

    setUnlinkAffiliateSaving(true);
    try {
      await updateAffiliateProfile(userId, { ckan_org_id: null });
      toast.success(
        "Affiliate unlinked",
        "Affiliate was removed from this center.",
      );
      setUnlinkTarget(null);
      await refreshCenter();
    } catch (e) {
      toast.error(
        "Unlink failed",
        String(e?.message || "Unable to unlink affiliate."),
      );
    } finally {
      setUnlinkAffiliateSaving(false);
    }
  };

  const goToProject = (row) => {
    const id = String(row?.ckan_dataset_id || row?.id || "").trim();
    if (!id) return;
    navigate(`/projects/${encodeURIComponent(id)}`);
  };

  const statusBadgeClass = (status) => {
    const key = normalizeStatus(status);
    if (key === "completed") {
      return "border border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (key === "ongoing" || key === "proposal" || key === "pending") {
      return "border border-amber-200 bg-amber-50 text-amber-700";
    }
    if (key === "delayed" || key === "rejected" || key === "cancelled") {
      return "border border-orange-200 bg-orange-50 text-orange-700";
    }
    return "border border-slate-200 bg-slate-50 text-slate-700";
  };

  const deleteCenter = async () => {
    if (!centerId || deleting || deleteGuard.blocked) return;
    setDeleting(true);
    try {
      const { error: deleteError } = await deleteReference({
        type: "center",
        id: centerId,
      });
      if (deleteError) throw deleteError;
      toast.success("Research center deleted", "The record has been removed.");
      navigate("/admin/research-center", { replace: true });
    } catch (e) {
      toast.error(
        "Delete failed",
        String(e?.message || "Unable to delete research center."),
      );
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const initials = useMemo(() => {
    const name = String(center?.name || "").trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      const first = parts[0]?.[0] || "";
      const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
      return `${first}${last}`.toUpperCase() || "RC";
    }
    return "RC";
  }, [center]);

  const socialLink = String(center?.socialMediaLink || "").trim();
  const socialMeta = getSocialMeta(socialLink);

  return {
    PAGE_SIZE,
    centerId,
    isCenterChief,
    loading,
    error,
    center,
    chiefUsers,
    usage,
    links,
    activeTab,
    setTab,
    clearProjectFilters,
    applyAgendaFilter,
    affiliatesPage,
    setAffiliatesPage,
    affiliatesTotalPages,
    paginatedAffiliates,
    projectsPage,
    setProjectsPage,
    projectsTotalPages,
    filteredProjects,
    paginatedProjects,
    agendaFilter,
    setAgendaFilter,
    projectSearch,
    setProjectSearch,
    projectStatus,
    setProjectStatus,
    projectStatusOptions,
    projectYear,
    setProjectYear,
    projectYearOptions,
    editOpen,
    setEditOpen,
    editSaving,
    editForm,
    updateEditForm,
    addEditAgenda,
    removeEditAgenda,
    editErrors,
    isEditValid,
    saveCenter,
    unlinkTarget,
    setUnlinkTarget,
    unlinkAffiliate,
    unlinkAffiliateSaving,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleteGuard,
    deleting,
    deleteCenter,
    refreshCenter,
    goToProject,
    statusBadgeClass,
    initials,
    socialLink,
    socialMeta,
  };
}
