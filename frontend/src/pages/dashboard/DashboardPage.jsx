import { useMemo } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { normalizeStatus } from "@/utils/status";
import {
  buildLifecycleBreakdown,
  buildMonthlySubmissions,
} from "@/utils/dashboard";
import { useDashboardData } from "@/hooks/dashboard";
import { ChartFrame, DashboardPanel } from "@/components/dashboard";
import PageHeader from "@/components/layout/PageHeader";
import InlineNotice from "@/components/feedback/InlineNotice";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const {
    projects,
    affiliateRows,
    refreshing,
    error,
    affiliateError,
    referenceError,
    effectiveCenters,
    effectiveAgendas,
    effectiveDepartments,
    loadData,
  } = useDashboardData({
    user,
    profile,
    isAdmin,
  });
  const scopedProjects = useMemo(() => {
    if (isAdmin) return projects;
    const ownerId = String(profile?.id || user?.id || "").trim();
    if (!ownerId) return [];
    return (projects || []).filter(
      (project) => String(project?.submitted_by || "").trim() === ownerId,
    );
  }, [isAdmin, profile?.id, projects, user?.id]);

  const chartProjects = isAdmin ? projects : scopedProjects;
  const monthlySubmissions = useMemo(
    () => buildMonthlySubmissions(chartProjects),
    [chartProjects],
  );
  const lifecycleBreakdown = useMemo(
    () => buildLifecycleBreakdown(chartProjects),
    [chartProjects],
  );
  const centerById = useMemo(
    () =>
      effectiveCenters.reduce((acc, center) => {
        acc[center.id] = center.name;
        return acc;
      }, {}),
    [effectiveCenters],
  );

  const departmentById = useMemo(
    () =>
      effectiveDepartments.reduce((acc, department) => {
        acc[department.id] = department.name;
        return acc;
      }, {}),
    [effectiveDepartments],
  );

  const centersWithProjectsSet = useMemo(
    () =>
      new Set(
        (scopedProjects || [])
          .map((project) => project.research_center_id)
          .filter(Boolean),
      ),
    [scopedProjects],
  );

  const projectsByStatus = useMemo(() => {
    const result = { proposal: 0, ongoing: 0, completed: 0, rejected: 0 };
    (scopedProjects || []).forEach((project) => {
      const status = normalizeStatus(project.status);
      if (result[status] !== undefined) result[status] += 1;
    });
    return result;
  }, [scopedProjects]);

  const projectsThisYear = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return (scopedProjects || []).filter((project) => {
      if (project.year && Number(project.year) === currentYear) return true;
      if (!project.created_at) return false;
      return new Date(project.created_at).getFullYear() === currentYear;
    }).length;
  }, [scopedProjects]);

  const projectsNearingDeadline = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + 14);
    return (scopedProjects || []).filter((project) => {
      if (!project.end_date) return false;
      const status = normalizeStatus(project.status);
      if (status === "completed" || status === "rejected") return false;
      const due = new Date(project.end_date);
      return due >= now && due <= cutoff;
    }).length;
  }, [scopedProjects]);

  const adminSummaries = useMemo(() => {
    const totalCenters = effectiveCenters.length;
    const activeCenters = centersWithProjectsSet.size;
    const centersWithNoProjects = Math.max(0, totalCenters - activeCenters);
    const totalAgenda = effectiveAgendas.length;

    const totalAffiliates = affiliateRows.length;
    const activeAffiliates = affiliateRows.filter(
      (row) => row.is_active,
    ).length;
    const inactiveAffiliates = Math.max(0, totalAffiliates - activeAffiliates);
    const facultyCount = affiliateRows.filter(
      (row) => row.role === "faculty",
    ).length;
    const studentCount = affiliateRows.filter(
      (row) => row.role === "student",
    ).length;

    return {
      researchCenters: {
        totalCenters,
        activeCenters,
        centersWithNoProjects,
        totalAgenda,
      },
      affiliates: {
        totalAffiliates,
        activeAffiliates,
        inactiveAffiliates,
        facultyCount,
        studentCount,
      },
      projects: {
        totalProjects: scopedProjects.length,
        ...projectsByStatus,
        thisYear: projectsThisYear,
        nearingDeadline: projectsNearingDeadline,
      },
    };
  }, [
    effectiveCenters.length,
    centersWithProjectsSet.size,
    effectiveAgendas.length,
    affiliateRows,
    scopedProjects.length,
    projectsByStatus,
    projectsThisYear,
    projectsNearingDeadline,
  ]);

  const crossModuleHealth = useMemo(() => {
    const projectTotal = chartProjects.length || 1;
    const affiliateTotal = affiliateRows.length || 1;
    const projectsWithCenter = chartProjects.filter((project) =>
      Boolean(project.research_center_id),
    ).length;
    const projectsWithAgenda = chartProjects.filter(
      (project) =>
        Boolean(project.research_agenda_id) ||
        Boolean(project.agenda_id) ||
        Boolean(project.agenda_name),
    ).length;
    const affiliatesWithCenter = affiliateRows.filter((row) =>
      Boolean(row.research_center_id),
    ).length;

    const projectCenterPct = Math.round(
      (projectsWithCenter / projectTotal) * 100,
    );
    const projectAgendaPct = Math.round(
      (projectsWithAgenda / projectTotal) * 100,
    );
    const affiliateCenterPct = Math.round(
      (affiliatesWithCenter / affiliateTotal) * 100,
    );

    return {
      projectCenterPct,
      projectAgendaPct,
      affiliateCenterPct,
      dataQualityScore: Math.round(
        (projectCenterPct + projectAgendaPct + affiliateCenterPct) / 3,
      ),
    };
  }, [chartProjects, affiliateRows]);

  const topDepartmentsByAffiliate = useMemo(() => {
    const counts = new Map();
    affiliateRows.forEach((row) => {
      const label = String(row.department || "Unassigned").trim();
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [affiliateRows]);

  const topCentersByProject = useMemo(() => {
    const counts = new Map();
    chartProjects.forEach((project) => {
      const centerId = project.research_center_id || "__unassigned__";
      counts.set(centerId, (counts.get(centerId) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([centerId, count]) => ({
        label:
          centerId === "__unassigned__"
            ? "Unassigned Center"
            : centerById[centerId] || "Unknown Center",
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [chartProjects, centerById]);

  const topAgendaByUsage = useMemo(() => {
    const counts = new Map();
    chartProjects.forEach((project) => {
      const label = String(
        project.agenda_name ||
          (project.agenda_id
            ? `Agenda ${project.agenda_id}`
            : "Unassigned Agenda"),
      ).trim();
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [chartProjects]);

  const topDepartmentsByProject = useMemo(() => {
    const counts = new Map();
    chartProjects.forEach((project) => {
      const label =
        departmentById[project.department_id] ||
        project.department_name ||
        "Unassigned Department";
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [chartProjects, departmentById]);

  const recentSubmittedProjects = useMemo(
    () =>
      [...chartProjects]
        .filter((project) => Boolean(project.created_at))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5),
    [chartProjects],
  );

  const recentUpdatedAffiliates = useMemo(
    () =>
      [...affiliateRows]
        .filter((row) => Boolean(row.updated_at || row.created_at))
        .sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at) -
            new Date(a.updated_at || a.created_at),
        )
        .slice(0, 5),
    [affiliateRows],
  );

  const recentCentersActivity = useMemo(
    () =>
      [...effectiveCenters]
        .filter((center) => Boolean(center.updated_at || center.created_at))
        .sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at) -
            new Date(a.updated_at || a.created_at),
        )
        .slice(0, 5),
    [effectiveCenters],
  );

  

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Dashboard"
        description="Monitor proposal lifecycle, filter records, and track upcoming deadlines."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => loadData({ silent: true })}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />


      <InlineNotice
        type="error"
        title="Dashboard load issue"
        message={error || affiliateError || referenceError?.message}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardPanel title="Monthly Submissions (Line)">
          <ChartFrame height={300}>
            <LineChart
              data={monthlySubmissions}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="submissions"
                name="Submissions"
                stroke="#1557a1"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ChartFrame>
        </DashboardPanel>

        <DashboardPanel title="Lifecycle Status Breakdown (Stacked Bar)">
          {lifecycleBreakdown.length === 0 ? (
            <Card className="shadow-none">
              <CardContent className="p-4">
                <p className="text-sm text-slate-600">
                  No lifecycle data available yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ChartFrame height={300}>
              <BarChart
                data={lifecycleBreakdown}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="proposal"
                  stackId="status"
                  fill="#f59e0b"
                  name="Proposal"
                />
                <Bar
                  dataKey="ongoing"
                  stackId="status"
                  fill="#1557a1"
                  name="Ongoing"
                />
                <Bar
                  dataKey="completed"
                  stackId="status"
                  fill="#0e8a54"
                  name="Completed"
                />
                <Bar
                  dataKey="rejected"
                  stackId="status"
                  fill="#c4332b"
                  name="Rejected"
                />
              </BarChart>
            </ChartFrame>
          )}
        </DashboardPanel>
      </div>

      {isAdmin ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          <DashboardPanel title="Research Centers Summary">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Total centers</p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.researchCenters.totalCenters}
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Active centers</p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.researchCenters.activeCenters}
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">
                    Centers with no projects
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.researchCenters.centersWithNoProjects}
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Total agenda count</p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.researchCenters.totalAgenda}
                  </p>
                </CardContent>
              </Card>
            </div>
          </DashboardPanel>

          <DashboardPanel title="Affiliates Summary">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Total affiliates</p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.affiliates.totalAffiliates}
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Active vs inactive</p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.affiliates.activeAffiliates} /{" "}
                    {adminSummaries.affiliates.inactiveAffiliates}
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Faculty vs student</p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.affiliates.facultyCount} /{" "}
                    {adminSummaries.affiliates.studentCount}
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">
                    Top departments by affiliate count
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {(topDepartmentsByAffiliate[0] &&
                      `${topDepartmentsByAffiliate[0].label} (${topDepartmentsByAffiliate[0].count})`) ||
                      "-"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </DashboardPanel>

          <DashboardPanel title="Research Projects Summary">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Total projects</p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.projects.totalProjects}
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">
                    This year submissions
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.projects.thisYear}
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-none sm:col-span-2">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">By status</p>
                  <p className="text-sm font-semibold text-slate-900">
                    Proposal {adminSummaries.projects.proposal} | Ongoing{" "}
                    {adminSummaries.projects.ongoing} | Completed{" "}
                    {adminSummaries.projects.completed} | Rejected{" "}
                    {adminSummaries.projects.rejected}
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-none sm:col-span-2">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">
                    Projects nearing deadline
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.projects.nearingDeadline}
                  </p>
                </CardContent>
              </Card>
            </div>
          </DashboardPanel>

          <DashboardPanel title="Cross-Module Health Widget">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">
                    % projects with assigned center
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {crossModuleHealth.projectCenterPct}%
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">
                    % projects with assigned agenda
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {crossModuleHealth.projectAgendaPct}%
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">
                    % affiliates with center assignment
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {crossModuleHealth.affiliateCenterPct}%
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Data quality score</p>
                  <p className="text-xl font-bold text-slate-900">
                    {crossModuleHealth.dataQualityScore}%
                  </p>
                </CardContent>
              </Card>
            </div>
          </DashboardPanel>
        </div>
      ) : null}
      {isAdmin ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <DashboardPanel title="Top 5 Centers by Project Count">
            <ul className="space-y-2">
              {topCentersByProject.length === 0 ? (
                <li className="text-sm text-slate-500">No project data.</li>
              ) : (
                topCentersByProject.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-card-foreground shadow-sm"
                  >
                    <span className="text-sm text-slate-700">{item.label}</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {item.count}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </DashboardPanel>

          <DashboardPanel title="Top 5 Agenda by Usage">
            <ul className="space-y-2">
              {topAgendaByUsage.length === 0 ? (
                <li className="text-sm text-slate-500">No agenda usage data.</li>
              ) : (
                topAgendaByUsage.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-card-foreground shadow-sm"
                  >
                    <span className="text-sm text-slate-700">{item.label}</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {item.count}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </DashboardPanel>

          <DashboardPanel title="Top 5 Departments by Projects">
            <ul className="space-y-2">
              {topDepartmentsByProject.length === 0 ? (
                <li className="text-sm text-slate-500">
                  No project department data.
                </li>
              ) : (
                topDepartmentsByProject.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-card-foreground shadow-sm"
                  >
                    <span className="text-sm text-slate-700">{item.label}</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {item.count}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </DashboardPanel>
        </div>
      ) : null}
      {isAdmin ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <DashboardPanel title="Recent Submitted Projects">
            <ul className="space-y-2">
              {recentSubmittedProjects.length === 0 ? (
                <li className="text-sm text-slate-500">
                  No recent project submissions.
                </li>
              ) : (
                recentSubmittedProjects.map((project) => (
                  <li
                    key={project.id}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-card-foreground shadow-sm"
                  >
                    <p className="text-sm font-medium text-slate-900">
                      {project.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(project.created_at).toLocaleString()}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </DashboardPanel>

          <DashboardPanel title="Recently Updated Affiliate Profiles">
            <ul className="space-y-2">
              {recentUpdatedAffiliates.length === 0 ? (
                <li className="text-sm text-slate-500">
                  No recent affiliate updates.
                </li>
              ) : (
                recentUpdatedAffiliates.map((affiliate) => (
                  <li
                    key={affiliate.id}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-card-foreground shadow-sm"
                  >
                    <p className="text-sm font-medium text-slate-900">
                      {affiliate.full_name || affiliate.email || affiliate.id}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(
                        affiliate.updated_at || affiliate.created_at,
                      ).toLocaleString()}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </DashboardPanel>

          <DashboardPanel title="Recently Created/Edited Research Centers">
            <ul className="space-y-2">
              {recentCentersActivity.length === 0 ? (
                <li className="text-sm text-slate-500">
                  No timestamped center activity available.
                </li>
              ) : (
                recentCentersActivity.map((center) => (
                  <li
                    key={center.id}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-card-foreground shadow-sm"
                  >
                    <p className="text-sm font-medium text-slate-900">
                      {center.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(
                        center.updated_at || center.created_at,
                      ).toLocaleString()}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </DashboardPanel>
        </div>
      ) : null}

    </section>
  );
}
