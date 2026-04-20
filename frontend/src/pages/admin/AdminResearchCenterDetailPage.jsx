import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import EmptyState from "@/components/feedback/EmptyState";
import PaginationControls from "@/components/navigation/PaginationControls";
import { useToast } from "@/components/providers/ToastProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  deleteReference,
  fetchReferenceData,
  fetchReferenceLinks,
  fetchReferenceUsageCounts,
  updateReference,
} from "@/services/admin";
import { updateAffiliateProfile } from "@/services/admin";
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";
import { validateCenterForm } from "@/utils/admin";
import { formatStatusLabel, normalizeStatus } from "@/utils/status";
import {
  Building2,
  ChevronLeft,
  Eye,
  Facebook,
  FolderKanban,
  Globe,
  Instagram,
  Linkedin,
  Pencil,
  Search,
  Trash2,
  Twitter,
  Users,
  X,
  Youtube,
} from "lucide-react";

const PAGE_SIZE = 10;

function normalizeTab(value) {
  const tab = String(value || "")
    .trim()
    .toLowerCase();
  if (["overview", "affiliates", "projects"].includes(tab)) return tab;
  return "overview";
}

function getSocialMeta(url) {
  const value = String(url || "")
    .trim()
    .toLowerCase();
  if (!value) return null;
  if (value.includes("facebook.com") || value.includes("fb.com")) {
    return { label: "Facebook", icon: Facebook };
  }
  if (value.includes("instagram.com")) {
    return { label: "Instagram", icon: Instagram };
  }
  if (value.includes("x.com") || value.includes("twitter.com")) {
    return { label: "X (Twitter)", icon: Twitter };
  }
  if (value.includes("linkedin.com")) {
    return { label: "LinkedIn", icon: Linkedin };
  }
  if (value.includes("youtube.com") || value.includes("youtu.be")) {
    return { label: "YouTube", icon: Youtube };
  }
  return { label: "Website", icon: Globe };
}

function statusBadgeClass(status) {
  const key = normalizeStatus(status);
  if (key === "completed") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (key === "ongoing" || key === "proposal" || key === "pending") {
    return "border border-amber-200 bg-amber-50 text-amber-700";
  }
  if (key === "delayed" || key === "rejected" || key === "cancelled") {
    return "border border-red-200 bg-red-50 text-red-700";
  }
  return "border border-blue-200 bg-blue-50 text-blue-700";
}

export default function AdminResearchCenterDetailPage() {
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
  const [deleting, setDeleting] = useState(false);
  const [affiliatesPage, setAffiliatesPage] = useState(1);
  const [projectsPage, setProjectsPage] = useState(1);
  const [agendaFilter, setAgendaFilter] = useState("");
  const [projectSearch, setProjectSearch] = useState(() =>
    String(searchParams.get("projectSearch") || "").trim(),
  );
  const [projectStatus, setProjectStatus] = useState(
    () => String(searchParams.get("projectStatus") || "all").trim() || "all",
  );
  const [projectYear, setProjectYear] = useState(
    () => String(searchParams.get("projectYear") || "all").trim() || "all",
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

  const [unlinkAffiliateSaving, setUnlinkAffiliateSaving] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState(null);
  const isCenterChief = profile?.is_center_chief === true;
  const [showDeletePopover, setShowDeletePopover] = useState(false);
  const deletePopoverRef = useRef(null);
  const socialLink = String(center?.socialMediaLink || "").trim();
  const socialMeta = getSocialMeta(socialLink);
  const SocialIcon = socialMeta?.icon || Globe;

  useEffect(() => {
    setAffiliatesPage(1);
  }, [centerId]);
  useEffect(() => {
    setProjectsPage(1);
    setAgendaFilter("");
  }, [centerId]);

  useEffect(() => {
    const nextSearch = String(searchParams.get("projectSearch") || "").trim();
    const nextStatus =
      String(searchParams.get("projectStatus") || "all").trim() || "all";
    const nextYear =
      String(searchParams.get("projectYear") || "all").trim() || "all";

    if (nextSearch !== projectSearch) setProjectSearch(nextSearch);
    if (nextStatus !== projectStatus) setProjectStatus(nextStatus);
    if (nextYear !== projectYear) setProjectYear(nextYear);
  }, [projectParamsKey]);

  useEffect(() => {
    if (!showDeletePopover) return;
    const handleClickOutside = (event) => {
      if (!deletePopoverRef.current) return;
      if (!deletePopoverRef.current.contains(event.target)) {
        setShowDeletePopover(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setShowDeletePopover(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showDeletePopover]);

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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [referencePayload, usagePayload, linksPayload] =
          await Promise.all([
            fetchReferenceData(),
            fetchReferenceUsageCounts({ type: "center", id: centerId }),
            fetchReferenceLinks({ type: "center", id: centerId }),
          ]);

        const centersData = referencePayload?.centersRes?.data || [];
        const ckanUsersData = referencePayload?.ckanUsersRes?.data || [];
        const centerRow = centersData.find(
          (row) => String(row?.id || "").trim() === centerId,
        );

        const chiefOptions = (ckanUsersData || [])
          .filter(
            (row) =>
              String(row?.state || "").toLowerCase() !== "deleted" &&
              String(row?.role || "").toLowerCase() === "faculty",
          )
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
          .filter((row) => row.id)
          .sort((a, b) => a.name.localeCompare(b.name));

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

        if (cancelled) return;
        setChiefUsers(chiefOptions);
        setCenter(
          centerRow
            ? {
                id: centerId,
                name: centerRow?.name || "-",
                code: String(centerRow?.code || "").trim() || centerId,
                description: String(centerRow?.description || "").trim(),
                socialMediaLink: String(
                  centerRow?.social_media_link || "",
                ).trim(),
                centerChiefId: centerChiefId || null,
                centerChiefName: centerChiefName || "-",
                agendaNames,
              }
            : null,
        );
        setEditForm({
          name: String(centerRow?.name || "").trim(),
          code: String(centerRow?.code || "").trim() || String(centerId || ""),
          description: String(centerRow?.description || "").trim(),
          socialMediaLink: String(centerRow?.social_media_link || "").trim(),
          centerChiefId: centerChiefId || "",
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
        if (cancelled) return;
        setError(
          String(e?.message || "Unable to load research center details."),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
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

  const addEditAgenda = () => {
    const next = String(editForm.agendaInput || "").trim();
    if (!next) return;
    if (editForm.researchAgendas.includes(next)) {
      setEditForm((prev) => ({ ...prev, agendaInput: "" }));
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      agendaInput: "",
      researchAgendas: [...prev.researchAgendas, next],
    }));
  };

  const removeEditAgenda = (agendaName) => {
    setEditForm((prev) => ({
      ...prev,
      researchAgendas: prev.researchAgendas.filter(
        (item) => item !== agendaName,
      ),
    }));
  };

  const handleSaveCenter = async () => {
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

      // Refresh the view.
      setLoading(true);
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

      setCenter(
        centerRow
          ? {
              id: centerId,
              name: centerRow?.name || "-",
              code: String(centerRow?.code || "").trim() || centerId,
              description: String(centerRow?.description || "").trim(),
              socialMediaLink: String(
                centerRow?.social_media_link || "",
              ).trim(),
              centerChiefId: centerChiefId || null,
              centerChiefName: centerChiefName || "-",
              agendaNames,
            }
          : null,
      );
      setEditForm({
        name: String(centerRow?.name || "").trim(),
        code: String(centerRow?.code || "").trim() || String(centerId || ""),
        description: String(centerRow?.description || "").trim(),
        socialMediaLink: String(centerRow?.social_media_link || "").trim(),
        centerChiefId: centerChiefId || "",
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
      setError("");
    } catch (e) {
      toast.error(
        "Update failed",
        String(e?.message || "Unable to update research center."),
      );
    } finally {
      setLoading(false);
      setEditSaving(false);
    }
  };

  const handleUnlinkAffiliate = async () => {
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

      const linksPayload = await fetchReferenceLinks({
        type: "center",
        id: centerId,
      });
      setLinks((prev) => ({
        ...prev,
        profiles: Array.isArray(linksPayload?.profiles)
          ? linksPayload.profiles
          : [],
        projects: Array.isArray(linksPayload?.projects)
          ? linksPayload.projects
          : [],
        agendas: Array.isArray(linksPayload?.agendas)
          ? linksPayload.agendas
          : [],
      }));

      const usagePayload = await fetchReferenceUsageCounts({
        type: "center",
        id: centerId,
      });
      setUsage((prev) => ({
        ...prev,
        projectCount: Number(usagePayload?.projectCount || 0),
        profileCount: Number(usagePayload?.profileCount || 0),
        memberBreakdown: usagePayload?.memberBreakdown || prev.memberBreakdown,
      }));
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
    const resolvedId = String(row?.ckan_dataset_id || id || "").trim();
    if (!resolvedId) return;
    navigate(`/projects/${encodeURIComponent(resolvedId)}`);
  };

  const handleDelete = async () => {
    if (!centerId || deleting) return;
    if (deleteGuard.blocked) {
      toast.error(
        "Cannot delete research center",
        "This center still has linked projects or affiliates.",
      );
      return;
    }
    setDeleting(true);
    try {
      const { error: deleteError } = await deleteReference({
        type: "center",
        id: centerId,
      });
      if (deleteError) throw deleteError;
      toast.success("Research center deleted", "The record has been removed.");
      // Back to list
      navigate("/admin/research-center", { replace: true });
    } catch (e) {
      toast.error(
        "Delete failed",
        String(e?.message || "Unable to delete research center."),
      );
    } finally {
      setDeleting(false);
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

  return (
    <section className="page-stack-lg">
      <div className="flex flex-wrap items-center gap-2">
        {!isCenterChief ? (
          <Button
            variant="outline"
            className="border-slate-300 bg-white text-slate-900 hover:bg-blue-50 active:bg-blue-100"
            onClick={() => {
              clearProjectFilters();
              navigate("/admin/research-center");
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Centers
          </Button>
        ) : null}

        <Button
          variant="outline"
          className="border-slate-300 bg-white text-slate-900 hover:bg-blue-50 active:bg-blue-100"
          disabled={loading || !center}
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Button>

        {deleteGuard.blocked ? (
          <div className="relative" ref={deletePopoverRef}>
            <Button
              variant="mono"
              type="button"
              onClick={() => setShowDeletePopover((prev) => !prev)}
              className="bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] active:bg-[#1E3A8A] opacity-70 hover:opacity-100"
            >
              Delete
            </Button>

            {showDeletePopover ? (
              <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-md border border-slate-300 bg-white p-3 text-xs text-slate-600 shadow-md">
                <p className="font-semibold text-slate-900">Deletion is blocked</p>
                <p className="mt-1">
                  This center cannot be deleted while it has{" "}
                  {deleteGuard.reasons.projectCount
                    ? `${deleteGuard.reasons.projectCount} linked project(s)`
                    : null}
                  {deleteGuard.reasons.projectCount &&
                  deleteGuard.reasons.nonAdminAffiliates
                    ? " and "
                    : null}
                  {deleteGuard.reasons.nonAdminAffiliates
                    ? `${deleteGuard.reasons.nonAdminAffiliates} linked affiliate(s)`
                    : null}
                  .
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <Button
            variant="mono"
            className="bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] active:bg-[#1E3A8A]"
            disabled={deleting || loading}
            onClick={handleDelete}
          >
            Delete
          </Button>
        )}
      </div>

      <Card className="overflow-hidden border-blue-200/80 bg-gradient-to-b from-blue-50/25 to-white">
        <CardHeader className="border-b border-blue-200/80 bg-blue-50/30 px-6 py-5">
          <div className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-blue-200/70 bg-white p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1E3A8A] text-lg font-bold uppercase text-white">
                {initials}
              </div>

              <div className="space-y-2">
                <CardTitle className="text-xl font-bold text-[#1E3A8A]">
                  {center?.name || "Research Center"}
                </CardTitle>

                <CardDescription className="text-sm text-slate-600">
                  Code:{" "}
                  <span className="font-mono font-semibold text-slate-800">
                    {center?.code || "-"}
                  </span>{" "}
                  · Center Chief:{" "}
                  <span className="font-semibold text-slate-800">
                    {center?.centerChiefName || "-"}
                  </span>
                </CardDescription>

                <div className="flex flex-wrap gap-3">
                  <Badge className="gap-2 text-sm px-3 py-1.5 bg-blue-100 text-[#1E3A8A] border border-blue-200">
                    <Users className="h-5 w-5" />
                    {usage.profileCount} affiliates
                  </Badge>

                  <Badge className="gap-2 text-sm px-3 py-1.5 bg-blue-100 text-[#1E3A8A] border border-blue-200">
                    <FolderKanban className="h-5 w-5" />
                    {usage.projectCount} projects
                  </Badge>

                  <Badge className="gap-2 text-sm px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Building2 className="h-5 w-5" />
                    {center?.agendaNames?.length || 0} agenda
                  </Badge>

                  {socialLink ? (
                    <a
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-blue-50 hover:text-[#1E3A8A]"
                      href={socialLink}
                      target="_blank"
                      rel="noreferrer"
                      title={socialMeta?.label || "Open link"}
                      aria-label={socialMeta?.label || "Open link"}
                    >
                      <SocialIcon className="h-5 w-5" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          {loading ? (
            <p className="text-sm text-slate-600">Loading research center...</p>
          ) : error ? (
            <EmptyState title="Unable to load" description={error} />
          ) : !center ? (
            <EmptyState
              title="Research center not found"
              description="The requested research center could not be found or you do not have access."
            />
          ) : (
            <>
              <div className="rounded-lg border border-blue-200/70 bg-blue-50/25 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Description
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {String(center?.description || "").trim() ||
                    "No description provided."}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Research Agenda
                </p>

                {center.agendaNames.length ? (
                  <div className="flex flex-wrap gap-3">
                    {center.agendaNames.map((agenda) => (
                    <button
                      key={agenda}
                      type="button"
                      className="inline-flex items-center rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-[#1E3A8A] transition hover:bg-blue-50"
                        onClick={() => applyAgendaFilter(agenda)}
                        title="Filter linked projects by this agenda"
                      >
                        {agenda}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">No agenda linked.</p>
                )}
              </div>

              <Tabs value={activeTab} onValueChange={setTab}>
                <TabsList className="text-sm border border-blue-200 bg-white">
                  <TabsTrigger
                    value="overview"
                    className="text-sm data-[state=active]:bg-blue-100 data-[state=active]:text-[#1E3A8A]"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="affiliates"
                    className="text-sm data-[state=active]:bg-blue-100 data-[state=active]:text-[#1E3A8A]"
                  >
                    Affiliates
                  </TabsTrigger>
                  <TabsTrigger
                    value="projects"
                    className="text-sm data-[state=active]:bg-blue-100 data-[state=active]:text-[#1E3A8A]"
                  >
                    Projects
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-5 space-y-5">
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      {
                        label: "Members",
                        value: usage.profileCount,
                        sub: `Admin ${usage.memberBreakdown?.adminCount || 0} · Editor ${usage.memberBreakdown?.editorCount || 0} · Member ${usage.memberBreakdown?.memberCount || 0}`,
                      },
                      {
                        label: "Projects",
                        value: usage.projectCount,
                        sub: "Linked research projects.",
                      },
                      {
                        label: "Agenda",
                        value: center.agendaNames.length,
                        sub: "Research agenda items.",
                      },
                    ].map((item) => (
                      <Card
                        key={item.label}
                        className="border border-blue-200/70 bg-gradient-to-b from-blue-50/20 to-white"
                      >
                        <CardContent className="p-5">
                          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">
                            {item.label}
                          </p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">
                            {item.value}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {item.sub}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="affiliates" className="mt-4 space-y-3">
                  <Card className="overflow-hidden border border-blue-200/70 bg-white">
                    <CardHeader className="border-b border-blue-200/70 bg-blue-50/25 px-6 py-5">
                      <CardTitle className="text-base font-bold text-[#1E3A8A]">
                        Linked Affiliates
                      </CardTitle>
                      <CardDescription className="text-sm text-slate-600">
                        Showing {links.profiles.length} affiliate(s).
                      </CardDescription>
                    </CardHeader>

                    {links.profiles.length === 0 ? (
                      <CardContent className="p-6">
                        <EmptyState
                          title="No affiliates"
                          description="No linked affiliates found for this research center."
                        />
                      </CardContent>
                    ) : (
                      <>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <Table className="min-w-[980px]">
                              <TableHeader>
                                <TableRow className="bg-blue-100/70">
                                  <TableHead>No.</TableHead>
                                  <TableHead>Full Name</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead>Role</TableHead>
                                  <TableHead>Department</TableHead>
                                  <TableHead className="text-right">
                                    Actions
                                  </TableHead>
                                </TableRow>
                              </TableHeader>

                              <TableBody>
                                {paginatedAffiliates.map((row, idx) => {
                                  const rowId = String(row?.id || "").trim();
                                  const centerChiefId = String(
                                    center?.centerChiefId || "",
                                  ).trim();
                                  const isChief =
                                    rowId &&
                                    centerChiefId &&
                                    rowId === centerChiefId;

                                  return (
                                    <TableRow
                                      key={row?.id || `${idx}`}
                                      className="hover:bg-blue-50/80"
                                    >
                                      <TableCell>
                                        {(affiliatesPage - 1) * PAGE_SIZE +
                                          idx +
                                          1}
                                      </TableCell>
                                      <TableCell className="font-medium text-slate-900">
                                        {row?.full_name || row?.name || "-"}
                                      </TableCell>
                                      <TableCell className="text-slate-700">
                                        {row?.email || "-"}
                                      </TableCell>
                                      <TableCell className="capitalize text-slate-700">
                                        {row?.role || "-"}
                                      </TableCell>
                                      <TableCell className="text-slate-700">
                                        {row?.department || "-"}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-slate-600 hover:bg-blue-50"
                                          disabled={isChief}
                                          onClick={() => setUnlinkTarget(row)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>

                        <PaginationControls
                          page={affiliatesPage}
                          totalPages={affiliatesTotalPages}
                          onPageChange={setAffiliatesPage}
                          className="border-t border-slate-200"
                        />
                      </>
                    )}
                  </Card>
                </TabsContent>

                <TabsContent value="projects" className="mt-5 space-y-4">
                  {links.projects.length === 0 ? (
                    <EmptyState
                      title="No projects"
                      description="No linked projects found for this research center."
                    />
                  ) : (
                    <Card className="overflow-hidden border border-blue-200/70 bg-white">
                      <CardHeader className="border-b border-blue-200/70 bg-blue-50/25 px-6 py-5">
                        <CardTitle className="text-base font-bold text-[#1E3A8A]">
                          Linked Projects
                        </CardTitle>

                        <CardDescription className="text-sm text-slate-600">
                          Showing {filteredProjects.length} project(s).
                        </CardDescription>

                        {agendaFilter && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-800">
                              Agenda: {agendaFilter}
                            </span>
                            <button
                              className="text-xs font-semibold text-slate-500 hover:text-[#1E3A8A]"
                              onClick={() => setAgendaFilter("")}
                            >
                              Clear agenda
                            </button>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 mt-4">
                          <Input
                            className="w-[180px] h-7 px-2 text-xs border-slate-300 focus:border-blue-400 focus:ring-0"
                            placeholder="Search projects"
                            value={projectSearch}
                            onChange={(e) => setProjectSearch(e.target.value)}
                          />

                          <Select
                            value={projectStatus}
                            onValueChange={setProjectStatus}
                          >
                            <SelectTrigger className="w-[160px] h-7 px-2 text-xs border-slate-300 focus:border-blue-400 focus:ring-0">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              {projectStatusOptions.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status === "all" ? "All statuses" : status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={projectYear}
                            onValueChange={setProjectYear}
                          >
                            <SelectTrigger className="w-[120px] h-7 px-2 text-xs border-slate-300 focus:border-blue-400 focus:ring-0">
                              <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent>
                              {projectYearOptions.map((year) => (
                                <SelectItem key={year} value={year}>
                                  {year === "all" ? "All years" : year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button
                            variant="outline"
                            className="h-7 px-2.5 text-xs border-slate-300 text-slate-700 hover:bg-blue-50 hover:text-[#1E3A8A] transition"
                            onClick={() => {
                              setProjectSearch("");
                              setProjectStatus("all");
                              setProjectYear("all");
                              setAgendaFilter("");
                            }}
                          >
                            Reset
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <Table className="min-w-[980px]">
                            <TableHeader>
                              <TableRow className="bg-blue-100/70">
                                <TableHead>No.</TableHead>
                                <TableHead>Project Title</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Year</TableHead>
                                <TableHead>Lead Researcher</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Agendum</TableHead>
                                <TableHead className="text-right">
                                  Actions
                                </TableHead>
                              </TableRow>
                            </TableHeader>

                            <TableBody>
                              {paginatedProjects.map((row, idx) => (
                                <TableRow
                                  key={row?.id || `${idx}`}
                                  className="hover:bg-blue-50/80"
                                >
                                  <TableCell>
                                    {(projectsPage - 1) * PAGE_SIZE + idx + 1}
                                  </TableCell>
                                  <TableCell className="font-medium text-slate-900">
                                    {row?.title || "-"}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={`capitalize ${statusBadgeClass(row?.status)}`}
                                    >
                                      {formatStatusLabel(row?.status) || "-"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-slate-700">
                                    {row?.year || "-"}
                                  </TableCell>
                                  <TableCell className="text-slate-700">
                                    {row?.lead_researcher || "-"}
                                  </TableCell>
                                  <TableCell className="text-slate-700">
                                    {row?.department_name || "-"}
                                  </TableCell>
                                  <TableCell className="text-slate-700">
                                    {row?.agenda_name || "-"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-600 hover:bg-blue-50"
                                      onClick={() => goToProject(row)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>

                      <PaginationControls
                        page={projectsPage}
                        totalPages={projectsTotalPages}
                        onPageChange={setProjectsPage}
                        className="border-t border-slate-200"
                      />
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => !editSaving && setEditOpen(open)}
      >
        <DialogContent
          className="mx-auto w-full max-w-5xl"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Edit Research Center</DialogTitle>
            <DialogDescription>
              Update research center information.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Name</span>
                <Input
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
                {editErrors.name && (
                  <p className="field-error">{editErrors.name}</p>
                )}
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Code</span>
                <Input
                  value={editForm.code}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      code: event.target.value,
                    }))
                  }
                />
                {editErrors.code && (
                  <p className="field-error">{editErrors.code}</p>
                )}
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Center Chief
                </span>
                <Select
                  value={String(editForm.centerChiefId || "")}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, centerChiefId: value }))
                  }
                >
                  <SelectTrigger
                    className={editErrors.centerChiefId ? "input-error" : ""}
                  >
                    <SelectValue placeholder="Select center chief" />
                  </SelectTrigger>
                  <SelectContent>
                    {chiefUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editErrors.centerChiefId && (
                  <p className="field-error">{editErrors.centerChiefId}</p>
                )}
              </label>
            </div>

            <div className="space-y-4">
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Description</span>
                <Textarea
                  value={editForm.description}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Optional short description..."
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Social Media Link
                </span>
                <Input
                  value={editForm.socialMediaLink}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      socialMediaLink: event.target.value,
                    }))
                  }
                  placeholder="https://facebook.com/your-center"
                />
                <p className="text-xs text-slate-500">
                  Optional. Shown in the center overview.
                </p>
              </label>

              <div className="space-y-2 text-sm">
                <span className="font-semibold text-slate-700">
                  Research Agendas
                </span>

                <div className="flex flex-wrap gap-2">
                  {editForm.researchAgendas.map((agenda) => (
                    <button
                      key={agenda}
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-muted"
                      onClick={() => removeEditAgenda(agenda)}
                    >
                      <span className="truncate">{agenda}</span>
                      <X className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                  ))}
                  {editForm.researchAgendas.length === 0 && (
                    <p className="text-xs text-slate-500">No agendas yet.</p>
                  )}
                </div>

                {editErrors.researchAgendas && (
                  <p className="field-error">{editErrors.researchAgendas}</p>
                )}

                <div className="flex gap-2">
                  <Input
                    placeholder="Add research agendum"
                    value={editForm.agendaInput}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        agendaInput: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      addEditAgenda();
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addEditAgenda}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              disabled={editSaving}
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={editSaving || !isEditValid}
              onClick={handleSaveCenter}
            >
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionModal
        open={Boolean(unlinkTarget)}
        title="Unlink Affiliate"
        message={`Remove "${unlinkTarget?.full_name || unlinkTarget?.email || unlinkTarget?.id || "this affiliate"}" from this research center?`}
        confirmLabel="Unlink"
        loading={unlinkAffiliateSaving}
        onCancel={() => setUnlinkTarget(null)}
        onConfirm={handleUnlinkAffiliate}
      />
    </section>
  );
}

