import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import PageHeader from "@/shared/components/layout/PageHeader";
import EmptyState from "@/shared/components/feedback/EmptyState";
import PaginationControls from "@/shared/components/navigation/PaginationControls";
import { useToast } from "@/app/providers/ToastProvider";
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
} from "@/features/admin/services";
import {
  fetchAffiliateRegistry,
  updateAffiliateProfile,
} from "@/features/admin/services";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";
import { validateCenterForm } from "@/features/admin/utils";
import {
  Building2,
  ChevronLeft,
  Eye,
  FolderKanban,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

const PAGE_SIZE = 10;

function normalizeTab(value) {
  const tab = String(value || "")
    .trim()
    .toLowerCase();
  if (["overview", "affiliates", "projects"].includes(tab)) return tab;
  return "overview";
}

export default function AdminResearchCenterDetailPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const params = useParams();
  const centerId = String(params?.id || "").trim();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeTab(searchParams.get("tab"));

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

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    description: "",
    centerChiefId: "",
    agendaInput: "",
    researchAgendas: [],
  });

  const [linkAffiliateOpen, setLinkAffiliateOpen] = useState(false);
  const [linkAffiliateLoading, setLinkAffiliateLoading] = useState(false);
  const [linkAffiliateSaving, setLinkAffiliateSaving] = useState(false);
  const [affiliateSearch, setAffiliateSearch] = useState("");
  const [affiliateRegistry, setAffiliateRegistry] = useState([]);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState("");
  const [unlinkTarget, setUnlinkTarget] = useState(null);

  useEffect(() => {
    setAffiliatesPage(1);
  }, [centerId]);
  useEffect(() => {
    setProjectsPage(1);
  }, [centerId]);

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

  const paginatedProjects = useMemo(() => {
    const start = (projectsPage - 1) * PAGE_SIZE;
    return links.projects.slice(start, start + PAGE_SIZE);
  }, [projectsPage, links.projects]);
  const projectsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(links.projects.length / PAGE_SIZE)),
    [links.projects.length],
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
      return next;
    });
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

  const openLinkAffiliate = async () => {
    setAffiliateSearch("");
    setSelectedAffiliateId("");
    setLinkAffiliateOpen(true);

    if (affiliateRegistry.length > 0) return;

    setLinkAffiliateLoading(true);
    try {
      const payload = await fetchAffiliateRegistry();
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      setAffiliateRegistry(rows);
    } catch (e) {
      toast.error(
        "Unable to load affiliates",
        String(e?.message || "Please try again."),
      );
    } finally {
      setLinkAffiliateLoading(false);
    }
  };

  const linkCandidateRows = useMemo(() => {
    const keyword = String(affiliateSearch || "")
      .trim()
      .toLowerCase();
    const linkedIds = new Set(
      (links.profiles || []).map((row) => String(row?.id || "").trim()),
    );

    return (affiliateRegistry || [])
      .filter((row) => {
        const id = String(row?.id || "").trim();
        if (!id) return false;
        if (linkedIds.has(id)) return false;
        if (String(row?.ckan_org_id || "").trim() === centerId) return false;
        if (!keyword) return true;
        const haystack = [
          row?.full_name,
          row?.email,
          row?.role,
          row?.department,
          row?.ckan_username,
          row?.id,
        ]
          .map((v) => String(v || "").toLowerCase())
          .join(" ");
        return haystack.includes(keyword);
      })
      .slice(0, 20);
  }, [affiliateRegistry, affiliateSearch, centerId, links.profiles]);

  const handleLinkAffiliate = async () => {
    const userId = String(selectedAffiliateId || "").trim();
    if (!userId || linkAffiliateSaving) return;

    setLinkAffiliateSaving(true);
    try {
      await updateAffiliateProfile(userId, { ckan_org_id: centerId });
      toast.success("Affiliate linked", "Affiliate was added to this center.");
      setLinkAffiliateOpen(false);

      // Reload center links.
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
        "Link failed",
        String(e?.message || "Unable to link affiliate."),
      );
    } finally {
      setLinkAffiliateSaving(false);
    }
  };

  const handleUnlinkAffiliate = async () => {
    const userId = String(unlinkTarget?.id || "").trim();
    if (!userId || linkAffiliateSaving) return;

    setLinkAffiliateSaving(true);
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
      setLinkAffiliateSaving(false);
    }
  };

  const goToProject = (row) => {
    const id = String(row?.ckan_dataset_id || row?.id || "").trim();
    if (!id) return;
    navigate(`/submit-project/${encodeURIComponent(id)}`);
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

  const title = center?.name
    ? `Research Center: ${center.name}`
    : "Research Center";

  return (
    <section className="page-stack-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="outline">
          <Link to="/admin/research-center">
            <ChevronLeft className="h-4 w-4" />
            Back to Centers
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={loading || !center}
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="destructive"
            disabled={deleting || loading || deleteGuard.blocked}
            onClick={handleDelete}
            title={
              deleteGuard.blocked
                ? "Remove linked projects/affiliates first"
                : "Delete research center"
            }
          >
            Delete
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold text-slate-900">
                {center?.name || "Research Center"}
              </CardTitle>
              <CardDescription>
                Code:{" "}
                <span className="font-mono font-semibold text-slate-700">
                  {center?.code || "-"}
                </span>{" "}
                | Center Chief:{" "}
                <span className="font-semibold text-slate-700">
                  {center?.centerChiefName || "-"}
                </span>
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-2">
                <Users className="h-4 w-4" />
                {usage.profileCount} affiliates
              </Badge>
              <Badge variant="secondary" className="gap-2">
                <FolderKanban className="h-4 w-4" />
                {usage.projectCount} projects
              </Badge>
              <Badge variant="outline" className="gap-2">
                <Building2 className="h-4 w-4" />
                {center?.agendaNames?.length || 0} agenda
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
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
              {deleteGuard.blocked ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">Deletion is blocked</p>
                  <p className="mt-1 text-amber-800">
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

              <div className="rounded-lg border border-[var(--border)] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Description
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {String(center?.description || "").trim() ||
                    "No description provided."}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Research Agenda
                </p>
                {center.agendaNames.length ? (
                  <div className="flex flex-wrap gap-2">
                    {center.agendaNames.map((agenda) => (
                      <Badge key={agenda} variant="outline">
                        {agenda}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">No agenda linked.</p>
                )}
              </div>

              <Tabs value={activeTab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="affiliates">Affiliates</TabsTrigger>
                  <TabsTrigger value="projects">Projects</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Card className="bg-muted/30">
                      <CardContent className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Members
                        </p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {usage.profileCount}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Admin {usage.memberBreakdown?.adminCount || 0} ·
                          Editor {usage.memberBreakdown?.editorCount || 0} ·
                          Member {usage.memberBreakdown?.memberCount || 0}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/30">
                      <CardContent className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Projects
                        </p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {usage.projectCount}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Linked research projects.
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/30">
                      <CardContent className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Agenda
                        </p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {center.agendaNames.length}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Research agenda items.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="affiliates" className="mt-4 space-y-3">
                  <Card className="overflow-hidden">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base font-bold text-slate-900">
                            Linked Affiliates
                          </CardTitle>
                          <CardDescription>
                            Showing {links.profiles.length} affiliate(s).
                          </CardDescription>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={openLinkAffiliate}
                          disabled={loading}
                        >
                          <Plus className="h-4 w-4" />
                          Link Affiliate
                        </Button>
                      </div>
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
                                <TableRow>
                                  <TableHead>No.</TableHead>
                                  <TableHead>Full Name</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead>Role</TableHead>
                                  <TableHead>Department</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>User ID</TableHead>
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
                                    <TableRow key={row?.id || `${idx}`}>
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
                                      <TableCell>
                                        <Badge
                                          variant={
                                            row?.is_active === false
                                              ? "destructive"
                                              : "secondary"
                                          }
                                        >
                                          {row?.is_active === false
                                            ? "Inactive"
                                            : "Active"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="font-mono text-xs text-slate-600">
                                        {row?.id || "-"}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-[var(--danger)] hover:bg-red-50"
                                          disabled={isChief}
                                          onClick={() => setUnlinkTarget(row)}
                                          aria-label={`Unlink ${row?.full_name || "affiliate"}`}
                                          title={
                                            isChief
                                              ? "Change Center Chief first"
                                              : "Unlink"
                                          }
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
                          className="rounded-none border-0 border-t border-[var(--border)]"
                        />
                      </>
                    )}
                  </Card>
                </TabsContent>

                <TabsContent value="projects" className="mt-4 space-y-3">
                  {links.projects.length === 0 ? (
                    <EmptyState
                      title="No projects"
                      description="No linked projects found for this research center."
                    />
                  ) : (
                    <Card className="overflow-hidden">
                      <CardHeader className="border-b border-[var(--border)] px-6 py-5">
                        <CardTitle className="text-base font-bold text-slate-900">
                          Linked Projects
                        </CardTitle>
                        <CardDescription>
                          Showing {links.projects.length} project(s).
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <Table className="min-w-[980px]">
                            <TableHeader>
                              <TableRow>
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
                                <TableRow key={row?.id || `${idx}`}>
                                  <TableCell>
                                    {(projectsPage - 1) * PAGE_SIZE + idx + 1}
                                  </TableCell>
                                  <TableCell className="font-medium text-slate-900">
                                    {row?.title || "-"}
                                  </TableCell>
                                  <TableCell className="capitalize text-slate-700">
                                    {row?.status || "-"}
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
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => goToProject(row)}
                                      aria-label={`View ${row?.title || "project"}`}
                                      title="View project"
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
                        className="rounded-none border-0 border-t border-[var(--border)]"
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
          className="max-w-2xl"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Edit Research Center</DialogTitle>
            <DialogDescription>
              Update research center information.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm md:col-span-2">
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
              {editErrors.name ? (
                <p className="field-error">{editErrors.name}</p>
              ) : null}
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
              {editErrors.code ? (
                <p className="field-error">{editErrors.code}</p>
              ) : null}
            </label>

            <label className="space-y-1 text-sm md:col-span-2">
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
                placeholder="Optional short description about the research center..."
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-semibold text-slate-700">Center Chief</span>
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
              {editErrors.centerChiefId ? (
                <p className="field-error">{editErrors.centerChiefId}</p>
              ) : null}
            </label>

            <div className="space-y-2 text-sm md:col-span-2">
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
                    title="Remove"
                  >
                    <span className="truncate">{agenda}</span>
                    <X className="h-3.5 w-3.5 text-slate-500" />
                  </button>
                ))}
                {editForm.researchAgendas.length === 0 ? (
                  <p className="text-xs text-slate-500">No agendas yet.</p>
                ) : null}
              </div>
              {editErrors.researchAgendas ? (
                <p className="field-error">{editErrors.researchAgendas}</p>
              ) : null}
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
                <Button type="button" variant="outline" onClick={addEditAgenda}>
                  Add
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
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

      <Dialog
        open={linkAffiliateOpen}
        onOpenChange={(open) =>
          !linkAffiliateSaving && setLinkAffiliateOpen(open)
        }
      >
        <DialogContent
          className="max-w-3xl"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Link Affiliate</DialogTitle>
            <DialogDescription>
              Search an affiliate and link them to this research center.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={affiliateSearch}
                  onChange={(event) => setAffiliateSearch(event.target.value)}
                  placeholder="Search name, email, role, department..."
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={linkAffiliateSaving || !selectedAffiliateId}
                onClick={handleLinkAffiliate}
              >
                {linkAffiliateSaving ? "Linking..." : "Link"}
              </Button>
            </div>

            {linkAffiliateLoading ? (
              <p className="text-sm text-slate-600">Loading affiliates...</p>
            ) : linkCandidateRows.length === 0 ? (
              <EmptyState
                title="No candidates"
                description="No eligible affiliates matched your search."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead />
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkCandidateRows.map((row) => {
                      const id = String(row?.id || "").trim();
                      const isSelected =
                        id && id === String(selectedAffiliateId || "").trim();
                      return (
                        <TableRow
                          key={id}
                          className={isSelected ? "bg-muted/40" : ""}
                          onClick={() => setSelectedAffiliateId(id)}
                        >
                          <TableCell className="w-10">
                            <input type="radio" checked={isSelected} readOnly />
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            {row?.full_name || row?.email || id}
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
                          <TableCell>
                            <Badge
                              variant={
                                row?.is_active === false
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {row?.is_active === false ? "Inactive" : "Active"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={linkAffiliateSaving}
              onClick={() => setLinkAffiliateOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionModal
        open={Boolean(unlinkTarget)}
        title="Unlink Affiliate"
        message={`Remove "${unlinkTarget?.full_name || unlinkTarget?.email || unlinkTarget?.id || "this affiliate"}" from this research center?`}
        confirmLabel="Unlink"
        loading={linkAffiliateSaving}
        onCancel={() => setUnlinkTarget(null)}
        onConfirm={handleUnlinkAffiliate}
      />
    </section>
  );
}
