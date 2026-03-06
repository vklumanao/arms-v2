import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { normalizeStatus } from "@/shared/utils/status";
import {
  ACTIVITY_PAGE_SIZE,
  DASHBOARD_COUNT_META,
  FEATURED_PAGE_SIZE,
  QUICK_FILTER_OPTIONS,
  RECORDS_PAGE_SIZE,
  STATUS_FILTER_OPTIONS,
} from "@/features/dashboard/constants";
import {
  applyDashboardQuickFilter,
  buildDashboardActivityRail,
  buildDashboardCounts,
  buildDeadlineCalendar,
  buildDashboardFeaturedRecords,
  buildLifecycleBreakdown,
  buildMonthlySubmissions,
  createDashboardFilters,
  filterDashboardProjects,
  findDashboardDeadlineAlerts,
  getActivityToneClass,
  getQuickFilterButtonClass,
  isDashboardNeedsAction,
  paginateItems,
} from "@/features/dashboard/utils";
import { useDashboardData } from "@/features/dashboard/hooks";
import { ChartFrame, DashboardPanel } from "@/features/dashboard/components";
import PageHeader from "@/shared/components/layout/PageHeader";
import InlineNotice from "@/shared/components/feedback/InlineNotice";
import PaginationControls from "@/shared/components/navigation/PaginationControls";
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
    historyRows,
    loading,
    refreshing,
    error,
    affiliateError,
    referenceError,
    centers,
    departments,
    effectiveCenters,
    effectiveAgendas,
    effectiveDepartments,
    loadData,
  } = useDashboardData({
    user,
    profile,
    isAdmin,
  });
  const [filters, setFilters] = useState(createDashboardFilters());
  const [quickFilter, setQuickFilter] = useState("all");
  const [featuredPage, setFeaturedPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [recordsPage, setRecordsPage] = useState(1);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const globallyFiltered = useMemo(
    () => filterDashboardProjects(projects, filters),
    [projects, filters],
  );

  const filtered = useMemo(
    () =>
      applyDashboardQuickFilter(globallyFiltered, quickFilter, {
        userId: user?.id,
        role: profile?.role || "",
      }),
    [globallyFiltered, quickFilter, user?.id, profile?.role],
  );

  const counts = useMemo(() => buildDashboardCounts(filtered), [filtered]);
  const alerts = useMemo(
    () => findDashboardDeadlineAlerts(filtered, 14),
    [filtered],
  );
  const deadlineCalendar = useMemo(
    () => buildDeadlineCalendar(alerts, 10),
    [alerts],
  );
  const chartProjects = isAdmin ? projects : filtered;
  const monthlySubmissions = useMemo(
    () => buildMonthlySubmissions(chartProjects),
    [chartProjects],
  );
  const lifecycleBreakdown = useMemo(
    () => buildLifecycleBreakdown(chartProjects),
    [chartProjects],
  );
  const featuredRecords = useMemo(
    () => buildDashboardFeaturedRecords(filtered, 6),
    [filtered],
  );
  const activityRail = useMemo(
    () => buildDashboardActivityRail(filtered, historyRows, 14),
    [filtered, historyRows],
  );
  const featuredPagination = useMemo(
    () => paginateItems(featuredRecords, featuredPage, FEATURED_PAGE_SIZE),
    [featuredRecords, featuredPage],
  );
  const activityPagination = useMemo(
    () => paginateItems(activityRail, activityPage, ACTIVITY_PAGE_SIZE),
    [activityRail, activityPage],
  );
  const recordsPagination = useMemo(
    () => paginateItems(filtered, recordsPage, RECORDS_PAGE_SIZE),
    [filtered, recordsPage],
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
        (projects || [])
          .map((project) => project.research_center_id)
          .filter(Boolean),
      ),
    [projects],
  );

  const projectsByStatus = useMemo(() => {
    const result = { proposal: 0, ongoing: 0, completed: 0, rejected: 0 };
    (projects || []).forEach((project) => {
      const status = normalizeStatus(project.status);
      if (result[status] !== undefined) result[status] += 1;
    });
    return result;
  }, [projects]);

  const projectsThisYear = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return (projects || []).filter((project) => {
      if (project.year && Number(project.year) === currentYear) return true;
      if (!project.created_at) return false;
      return new Date(project.created_at).getFullYear() === currentYear;
    }).length;
  }, [projects]);

  const projectsNearingDeadline = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + 14);
    return (projects || []).filter((project) => {
      if (!project.end_date) return false;
      const status = normalizeStatus(project.status);
      if (status === "completed" || status === "rejected") return false;
      const due = new Date(project.end_date);
      return due >= now && due <= cutoff;
    }).length;
  }, [projects]);

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
        totalProjects: projects.length,
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
    projects.length,
    projectsByStatus,
    projectsThisYear,
    projectsNearingDeadline,
  ]);

  const crossModuleHealth = useMemo(() => {
    const projectTotal = projects.length || 1;
    const affiliateTotal = affiliateRows.length || 1;
    const projectsWithCenter = projects.filter((project) =>
      Boolean(project.research_center_id),
    ).length;
    const projectsWithAgenda = projects.filter(
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
  }, [projects, affiliateRows]);

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
    projects.forEach((project) => {
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
  }, [projects, centerById]);

  const topAgendaByUsage = useMemo(() => {
    const counts = new Map();
    projects.forEach((project) => {
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
  }, [projects]);

  const topDepartmentsByProject = useMemo(() => {
    const counts = new Map();
    projects.forEach((project) => {
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
  }, [projects, departmentById]);

  const recentSubmittedProjects = useMemo(
    () =>
      [...projects]
        .filter((project) => Boolean(project.created_at))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5),
    [projects],
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

  useEffect(() => {
    setFeaturedPage(1);
    setActivityPage(1);
    setRecordsPage(1);
  }, [filters, quickFilter, projects.length, historyRows.length]);

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Dashboard"
        description="Monitor proposal lifecycle, filter records, and track upcoming deadlines."
        actions={
          isAdmin ? (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => loadData({ silent: true })}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          ) : null
        }
      />

      {!isAdmin ? (
        <div className="kpi-grid">
          {Object.entries(counts).map(([key, value]) => {
            const Icon = DASHBOARD_COUNT_META[key]?.icon;
            return (
              <div key={key} className="kpi-card">
                <p className="kpi-label flex items-center gap-2">
                  {Icon ? <Icon size={14} /> : null}
                  {DASHBOARD_COUNT_META[key]?.label || key}
                </p>
                <p className="kpi-value">{value}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      {profile?.role && profile.role !== "admin" ? (
        <DashboardPanel
          title="Quick Actions"
          bodyClassName="panel-body flex flex-wrap gap-2"
        >
          <Link className="btn btn-primary" to="/submit-affiliation">
            Open Research Projects
          </Link>
          <Link className="btn btn-outline" to="/my-submissions">
            View My Submissions
          </Link>
          <Link className="btn btn-outline" to="/public-records">
            Browse Public Records
          </Link>
        </DashboardPanel>
      ) : null}

      {!isAdmin ? (
        <>
          <DashboardPanel
            title="Global Filters"
            bodyClassName="panel-body grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          >
            <input
              className="control-input"
              placeholder="Search title"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
            />

            <select
              className="control-select"
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="">Filter by status</option>
              {STATUS_FILTER_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status[0].toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>

            <input
              className="control-input"
              placeholder="Year"
              value={filters.year}
              onChange={(event) => updateFilter("year", event.target.value)}
            />

            <select
              className="control-select"
              value={filters.center}
              onChange={(event) => updateFilter("center", event.target.value)}
            >
              <option value="">Filter by center</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>

            <select
              className="control-select"
              value={filters.department}
              onChange={(event) =>
                updateFilter("department", event.target.value)
              }
            >
              <option value="">Filter by department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </DashboardPanel>

          <DashboardPanel
            title="Quick Filters"
            bodyClassName="panel-body flex flex-wrap gap-2"
          >
            {QUICK_FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={getQuickFilterButtonClass(
                  quickFilter === option.value,
                )}
                onClick={() => setQuickFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </DashboardPanel>
        </>
      ) : null}

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
            <div className="app-card app-card-compact">
              <p className="text-sm text-slate-600">
                No lifecycle data available yet.
              </p>
            </div>
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
        <>
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
            <DashboardPanel title="Research Centers Summary">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="app-card app-card-compact">
                  <p className="text-xs text-slate-500">Total centers</p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.researchCenters.totalCenters}
                  </p>
                </div>
                <div className="app-card app-card-compact">
                  <p className="text-xs text-slate-500">Active centers</p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.researchCenters.activeCenters}
                  </p>
                </div>
                <div className="app-card app-card-compact">
                  <p className="text-xs text-slate-500">
                    Centers with no projects
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.researchCenters.centersWithNoProjects}
                  </p>
                </div>
                <div className="app-card app-card-compact">
                  <p className="text-xs text-slate-500">Total agenda count</p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.researchCenters.totalAgenda}
                  </p>
                </div>
              </div>
            </DashboardPanel>

            <DashboardPanel title="Affiliates Summary">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="app-card app-card-compact">
                  <p className="text-xs text-slate-500">Total affiliates</p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.affiliates.totalAffiliates}
                  </p>
                </div>
                <div className="app-card app-card-compact">
                  <p className="text-xs text-slate-500">Active vs inactive</p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.affiliates.activeAffiliates} /{" "}
                    {adminSummaries.affiliates.inactiveAffiliates}
                  </p>
                </div>
                <div className="app-card app-card-compact">
                  <p className="text-xs text-slate-500">Faculty vs student</p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.affiliates.facultyCount} /{" "}
                    {adminSummaries.affiliates.studentCount}
                  </p>
                </div>
                <div className="app-card app-card-compact">
                  <p className="text-xs text-slate-500">
                    Top departments by affiliate count
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {(topDepartmentsByAffiliate[0] &&
                      `${topDepartmentsByAffiliate[0].label} (${topDepartmentsByAffiliate[0].count})`) ||
                      "-"}
                  </p>
                </div>
              </div>
            </DashboardPanel>

            <DashboardPanel title="Research Projects Summary">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="app-card app-card-compact">
                  <p className="text-xs text-slate-500">Total projects</p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.projects.totalProjects}
                  </p>
                </div>
                <div className="app-card app-card-compact">
                  <p className="text-xs text-slate-500">
                    This year submissions
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.projects.thisYear}
                  </p>
                </div>
                <div className="app-card app-card-compact sm:col-span-2">
                  <p className="text-xs text-slate-500">By status</p>
                  <p className="text-sm font-semibold text-slate-900">
                    Proposal {adminSummaries.projects.proposal} | Ongoing{" "}
                    {adminSummaries.projects.ongoing} | Completed{" "}
                    {adminSummaries.projects.completed} | Rejected{" "}
                    {adminSummaries.projects.rejected}
                  </p>
                </div>
                <div className="app-card app-card-compact sm:col-span-2">
                  <p className="text-xs text-slate-500">
                    Projects nearing deadline
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {adminSummaries.projects.nearingDeadline}
                  </p>
                </div>
              </div>
            </DashboardPanel>

            <DashboardPanel title="Cross-Module Health Widget">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="app-card app-card-compact">
                  <p className="text-xs text-slate-500">
                    % projects with assigned center
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {crossModuleHealth.projectCenterPct}%
                  </p>
                </div>
                <div className="app-card app-card-compact">
                  <p className="text-xs text-slate-500">
                    % projects with assigned agenda
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {crossModuleHealth.projectAgendaPct}%
                  </p>
                </div>
                <div className="app-card app-card-compact">
                  <p className="text-xs text-slate-500">
                    % affiliates with center assignment
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {crossModuleHealth.affiliateCenterPct}%
                  </p>
                </div>
                <div className="app-card app-card-compact">
                  <p className="text-xs text-slate-500">Data quality score</p>
                  <p className="text-xl font-bold text-slate-900">
                    {crossModuleHealth.dataQualityScore}%
                  </p>
                </div>
              </div>
            </DashboardPanel>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <DashboardPanel title="Top 5 Centers by Project Count">
              <ul className="space-y-2">
                {topCentersByProject.length === 0 ? (
                  <li className="text-sm text-slate-500">No project data.</li>
                ) : (
                  topCentersByProject.map((item) => (
                    <li
                      key={item.label}
                      className="app-card app-card-micro flex items-center justify-between"
                    >
                      <span className="text-sm text-slate-700">
                        {item.label}
                      </span>
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
                  <li className="text-sm text-slate-500">
                    No agenda usage data.
                  </li>
                ) : (
                  topAgendaByUsage.map((item) => (
                    <li
                      key={item.label}
                      className="app-card app-card-micro flex items-center justify-between"
                    >
                      <span className="text-sm text-slate-700">
                        {item.label}
                      </span>
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
                      className="app-card app-card-micro flex items-center justify-between"
                    >
                      <span className="text-sm text-slate-700">
                        {item.label}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {item.count}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </DashboardPanel>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <DashboardPanel title="Recent Submitted Projects">
              <ul className="space-y-2">
                {recentSubmittedProjects.length === 0 ? (
                  <li className="text-sm text-slate-500">
                    No recent project submissions.
                  </li>
                ) : (
                  recentSubmittedProjects.map((project) => (
                    <li key={project.id} className="app-card app-card-micro">
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
                    <li key={affiliate.id} className="app-card app-card-micro">
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
                    <li key={center.id} className="app-card app-card-micro">
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
        </>
      ) : null}

      {!isAdmin ? (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <DashboardPanel title="Featured Records">
            {featuredRecords.length === 0 ? (
              <p className="text-sm text-slate-600">No records to feature.</p>
            ) : (
              <>
                <div className="grid gap-3 lg:grid-cols-2">
                  {featuredPagination.items.map((record) => {
                    const status = normalizeStatus(record.status);
                    const hasAbstract = Boolean(record.abstract);
                    const hasTimeline = Boolean(
                      record.start_date && record.end_date,
                    );
                    const hasOutputs = Boolean(record.expected_outputs);
                    const isReady =
                      hasAbstract && hasOutputs && status !== "proposal";

                    return (
                      <article
                        key={record.id}
                        className="app-card app-card-compact"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {record.title}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-500">
                          {record.year || "-"} |{" "}
                          {centerById[record.research_center_id] ||
                            "Unknown Center"}{" "}
                          |{" "}
                          {departmentById[record.department_id] ||
                            "Unknown Department"}{" "}
                          | {record.classification || "unspecified"} | {status}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`status-chip status-${status}`}>
                            {status}
                          </span>
                          <span className="status-chip status-ongoing">
                            {hasAbstract ? "Has abstract" : "No abstract"}
                          </span>
                          <span className="status-chip status-ongoing">
                            {hasTimeline ? "Has timeline" : "No timeline"}
                          </span>
                          <span className="status-chip status-ongoing">
                            {hasOutputs ? "Has outputs" : "No outputs"}
                          </span>
                          <span
                            className={`status-chip ${
                              isReady ? "status-completed" : "status-rejected"
                            }`}
                          >
                            {isReady ? "Public-ready" : "Needs enrichment"}
                          </span>
                          {isDashboardNeedsAction(
                            record,
                            profile?.role || "",
                          ) ? (
                            <span className="status-chip status-proposal">
                              Needs action
                            </span>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
                <PaginationControls
                  page={featuredPagination.page}
                  totalPages={featuredPagination.totalPages}
                  onPageChange={setFeaturedPage}
                  className="mt-3 border-t border-[var(--border)] pt-3"
                />
              </>
            )}
          </DashboardPanel>

          <DashboardPanel title="Activity Rail">
            {activityRail.length === 0 ? (
              <p className="text-sm text-slate-600">No recent activity.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {activityPagination.items.map((item) => (
                    <li
                      key={item.id}
                      className={`rounded-[var(--radius-sm)] border p-3 ${getActivityToneClass(item.tone)}`}
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {item.title}
                      </p>
                      <p className="text-sm text-slate-700">{item.detail}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
                <PaginationControls
                  page={activityPagination.page}
                  totalPages={activityPagination.totalPages}
                  onPageChange={setActivityPage}
                  className="mt-3 border-t border-[var(--border)] pt-3"
                />
              </>
            )}
          </DashboardPanel>
        </div>
      ) : null}

      {!isAdmin ? (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <DashboardPanel
            title={`Records (${filtered.length})`}
            className="overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Year</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4}>Loading records...</td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        No records found for selected filters.
                      </td>
                    </tr>
                  ) : (
                    recordsPagination.items.map((project) => {
                      const status = normalizeStatus(project.status);
                      return (
                        <tr key={project.id}>
                          <td>{project.title}</td>
                          <td>
                            <span className={`status-chip status-${status}`}>
                              {status}
                            </span>
                          </td>
                          <td>{project.year}</td>
                          <td>
                            {new Date(project.updated_at).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={recordsPagination.page}
              totalPages={recordsPagination.totalPages}
              onPageChange={setRecordsPage}
              className="mt-3 border-t border-[var(--border)] pt-3"
            />
          </DashboardPanel>

          <DashboardPanel title="Upcoming Deadlines">
            {alerts.length === 0 ? (
              <div className="app-card app-card-compact">
                <p className="text-sm font-semibold text-slate-800">
                  No upcoming deadlines
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  No ongoing projects are due within the next 14 days.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <ul className="space-y-2 text-sm">
                  {alerts.slice(0, 5).map((alert) => (
                    <li key={alert.id} className="app-card app-card-compact">
                      <p className="font-semibold text-slate-900">
                        {alert.title}
                      </p>
                      <p className="text-slate-600">
                        Due {new Date(alert.end_date).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-[var(--border)] pt-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                    Calendar Snapshot
                  </p>
                  <div className="grid gap-2">
                    {deadlineCalendar.slice(0, 4).map((item) => (
                      <div key={item.id} className="app-card app-card-micro">
                        <p className="text-sm font-semibold text-slate-900">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-600">
                          Due {new Date(item.end_date).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DashboardPanel>
        </div>
      ) : null}
    </section>
  );
}
