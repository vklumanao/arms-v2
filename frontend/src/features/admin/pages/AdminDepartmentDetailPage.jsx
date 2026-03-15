import { useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import PageHeader from "@/shared/components/layout/PageHeader";
import EmptyState from "@/shared/components/feedback/EmptyState";
import PaginationControls from "@/shared/components/navigation/PaginationControls";
import { useAuth } from "@/app/providers/AuthProvider";
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
} from "@/features/admin/services";
import { Building2, ChevronLeft, FolderKanban, Users } from "lucide-react";

const PAGE_SIZE = 10;

function normalizeTab(value) {
  const tab = String(value || "")
    .trim()
    .toLowerCase();
  if (["overview", "affiliates", "projects"].includes(tab)) return tab;
  return "overview";
}

export default function AdminDepartmentDetailPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const params = useParams();
  const departmentId = String(params?.id || "").trim();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeTab(searchParams.get("tab"));

  const isAdmin =
    String(profile?.role || "")
      .trim()
      .toLowerCase() === "admin";
  const canAccess = Boolean(departmentId) && isAdmin;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [department, setDepartment] = useState(null);
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
  const [links, setLinks] = useState({ profiles: [], projects: [] });
  const [deleting, setDeleting] = useState(false);
  const [affiliatesPage, setAffiliatesPage] = useState(1);
  const [projectsPage, setProjectsPage] = useState(1);

  useEffect(() => {
    setAffiliatesPage(1);
    setProjectsPage(1);
  }, [departmentId]);

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [referencePayload, usagePayload, linksPayload] =
          await Promise.all([
            fetchReferenceData(),
            fetchReferenceUsageCounts({ type: "department", id: departmentId }),
            fetchReferenceLinks({ type: "department", id: departmentId }),
          ]);

        const departmentsData = referencePayload?.departmentsRes?.data || [];
        const ckanUsersData = referencePayload?.ckanUsersRes?.data || [];
        const deptRow = departmentsData.find(
          (row) => String(row?.id || "").trim() === departmentId,
        );

        const chairpersonId = String(deptRow?.chairperson_id || "").trim();
        const chairpersonNameFromMeta = String(
          deptRow?.chairperson_name || "",
        ).trim();
        const chairpersonNameFromId = ckanUsersData.find(
          (ckanUser) => String(ckanUser?.id || "").trim() === chairpersonId,
        )?.name;
        const chairpersonName =
          chairpersonNameFromMeta || chairpersonNameFromId || "";

        if (cancelled) return;
        setDepartment(
          deptRow
            ? {
                id: departmentId,
                name:
                  deptRow?.title ||
                  deptRow?.display_name ||
                  deptRow?.name ||
                  "-",
                code: String(deptRow?.code || "").trim() || departmentId,
                chairpersonId: chairpersonId || null,
                chairpersonName: chairpersonName || "-",
              }
            : null,
        );
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
        });
      } catch (e) {
        if (cancelled) return;
        setError(String(e?.message || "Unable to load department details."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [canAccess, departmentId]);

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

  const affiliatesTotalPages = useMemo(
    () => Math.max(1, Math.ceil(links.profiles.length / PAGE_SIZE)),
    [links.profiles.length],
  );
  const paginatedAffiliates = useMemo(() => {
    const start = (affiliatesPage - 1) * PAGE_SIZE;
    return links.profiles.slice(start, start + PAGE_SIZE);
  }, [affiliatesPage, links.profiles]);

  const projectsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(links.projects.length / PAGE_SIZE)),
    [links.projects.length],
  );
  const paginatedProjects = useMemo(() => {
    const start = (projectsPage - 1) * PAGE_SIZE;
    return links.projects.slice(start, start + PAGE_SIZE);
  }, [projectsPage, links.projects]);

  const setTab = (tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!departmentId || deleting) return;
    if (deleteGuard.blocked) {
      toast.error(
        "Cannot delete department",
        "This department still has linked projects or affiliates.",
      );
      return;
    }
    setDeleting(true);
    try {
      const { error: deleteError } = await deleteReference({
        type: "department",
        id: departmentId,
      });
      if (deleteError) throw deleteError;
      toast.success("Department deleted", "The record has been removed.");
      navigate("/admin/departments", { replace: true });
    } catch (e) {
      toast.error(
        "Delete failed",
        String(e?.message || "Unable to delete department."),
      );
    } finally {
      setDeleting(false);
    }
  };

  if (!canAccess) return <Navigate to="/unauthorized" replace />;

  const title = department?.name
    ? `Department: ${department.name}`
    : "Department";

  return (
    <section className="page-stack-lg">
      <PageHeader
        title={title}
        description="Dedicated view for department information, affiliates, and linked projects."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="outline">
          <Link to="/admin/departments">
            <ChevronLeft className="h-4 w-4" />
            Back to Departments
          </Link>
        </Button>

        <Button
          variant="destructive"
          disabled={deleting || loading || deleteGuard.blocked}
          onClick={handleDelete}
          title={
            deleteGuard.blocked
              ? "Remove linked projects/affiliates first"
              : "Delete department"
          }
        >
          Delete
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold text-slate-900">
                {department?.name || "Department"}
              </CardTitle>
              <CardDescription>
                Code:{" "}
                <span className="font-mono font-semibold text-slate-700">
                  {department?.code || "-"}
                </span>{" "}
                | Chairperson:{" "}
                <span className="font-semibold text-slate-700">
                  {department?.chairpersonName || "-"}
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
                Department record
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          {loading ? (
            <p className="text-sm text-slate-600">Loading department...</p>
          ) : error ? (
            <EmptyState title="Unable to load" description={error} />
          ) : !department ? (
            <EmptyState
              title="Department not found"
              description="The requested department could not be found."
            />
          ) : (
            <>
              {deleteGuard.blocked ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">Deletion is blocked</p>
                  <p className="mt-1 text-amber-800">
                    This department cannot be deleted while it has{" "}
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
                          Chair {usage.memberBreakdown?.adminCount || 0} ·
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
                          Code
                        </p>
                        <p className="mt-1 font-mono text-xl font-bold text-slate-900">
                          {department.code}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Department code identifier.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="affiliates" className="mt-4 space-y-3">
                  {links.profiles.length === 0 ? (
                    <EmptyState
                      title="No affiliates"
                      description="No linked affiliates found for this department."
                    />
                  ) : (
                    <Card className="overflow-hidden">
                      <CardHeader className="border-b border-[var(--border)] px-6 py-5">
                        <CardTitle className="text-base font-bold text-slate-900">
                          Linked Affiliates
                        </CardTitle>
                        <CardDescription>
                          Showing {links.profiles.length} affiliate(s).
                        </CardDescription>
                      </CardHeader>
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
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {paginatedAffiliates.map((row, idx) => (
                                <TableRow key={row?.id || `${idx}`}>
                                  <TableCell>
                                    {(affiliatesPage - 1) * PAGE_SIZE + idx + 1}
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
                                </TableRow>
                              ))}
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
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="projects" className="mt-4 space-y-3">
                  {links.projects.length === 0 ? (
                    <EmptyState
                      title="No projects"
                      description="No linked projects found for this department."
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
                                <TableHead>Research Center</TableHead>
                                <TableHead>Agendum</TableHead>
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
                                    {row?.organization_name ||
                                      row?.research_center ||
                                      "-"}
                                  </TableCell>
                                  <TableCell className="text-slate-700">
                                    {row?.agenda_name || "-"}
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
    </section>
  );
}
