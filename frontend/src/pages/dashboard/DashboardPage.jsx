import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { normalizeStatus } from "@/utils/status";
import {
  buildLifecycleBreakdown,
  buildMonthlySubmissions,
} from "@/utils/dashboard";
import { useDashboardData } from "@/hooks/dashboard";
import { ChartFrame, DashboardPanel } from "@/components/dashboard";
import PageHeader from "@/components/layout/PageHeader";
import InlineNotice from "@/components/feedback/InlineNotice";
import { EXPECTED_OUTPUT_TYPE_OPTIONS } from "@/utils/submissions/submissionFormUtils";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const STATUS_COLORS = ["#f59e0b", "#1557a1", "#0e8a54", "#c4332b"];
const PALETTE = [
  "#0f4c81",
  "#2f7bbd",
  "#36b7a6",
  "#f0b429",
  "#e56b6f",
  "#9f86c0",
];
const PANEL_CARD_CLASS =
  "min-h-[420px] flex flex-col border-slate-200/70 bg-white/90 shadow-[0_18px_40px_-32px_rgba(15,76,129,0.65)]";
const PANEL_HEADER_CLASS =
  "bg-gradient-to-r from-slate-50 via-white to-slate-100";
const PANEL_BODY_CLASS = "p-6 flex-1";

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const isFaculty = profile?.role === "faculty";
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
        (chartProjects || [])
          .map((project) => project.research_center_id)
          .filter(Boolean),
      ),
    [chartProjects],
  );

  const projectsByStatus = useMemo(() => {
    const result = { proposal: 0, ongoing: 0, completed: 0, rejected: 0 };
    (chartProjects || []).forEach((project) => {
      const status = normalizeStatus(project.status);
      if (result[status] !== undefined) result[status] += 1;
    });
    return result;
  }, [chartProjects]);

  const projectsThisYear = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return (chartProjects || []).filter((project) => {
      if (project.year && Number(project.year) === currentYear) return true;
      if (!project.created_at) return false;
      return new Date(project.created_at).getFullYear() === currentYear;
    }).length;
  }, [chartProjects]);

  const projectsNearingDeadline = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + 14);
    return (chartProjects || []).filter((project) => {
      if (!project.end_date) return false;
      const status = normalizeStatus(project.status);
      if (status === "completed" || status === "rejected") return false;
      const due = new Date(project.end_date);
      return due >= now && due <= cutoff;
    }).length;
  }, [chartProjects]);

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
        totalProjects: chartProjects.length,
        ...projectsByStatus,
        thisYear: projectsThisYear,
        nearingDeadline: projectsNearingDeadline,
      },
    };
  }, [
    affiliateRows,
    chartProjects.length,
    centersWithProjectsSet.size,
    effectiveAgendas.length,
    effectiveCenters.length,
    projectsByStatus,
    projectsNearingDeadline,
    projectsThisYear,
  ]);

  const crossModuleHealth = useMemo(() => {
    const projectTotal = chartProjects.length || 1;
    const projectsWithCenter = chartProjects.filter((project) =>
      Boolean(project.research_center_id),
    ).length;
    const projectsWithAgenda = chartProjects.filter(
      (project) =>
        Boolean(project.research_agenda_id) ||
        Boolean(project.agenda_id) ||
        Boolean(project.agenda_name),
    ).length;

    const projectCenterPct = Math.round(
      (projectsWithCenter / projectTotal) * 100,
    );
    const projectAgendaPct = Math.round(
      (projectsWithAgenda / projectTotal) * 100,
    );

    if (!isAdmin) {
      return {
        projectCenterPct,
        projectAgendaPct,
        affiliateCenterPct: null,
        dataQualityScore: Math.round((projectCenterPct + projectAgendaPct) / 2),
      };
    }

    const affiliateTotal = affiliateRows.length || 1;
    const affiliatesWithCenter = affiliateRows.filter((row) =>
      Boolean(row.research_center_id),
    ).length;
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
  }, [affiliateRows, chartProjects, isAdmin]);

  const statusChartData = useMemo(
    () => [
      { name: "Proposal", value: projectsByStatus.proposal },
      { name: "Ongoing", value: projectsByStatus.ongoing },
      { name: "Completed", value: projectsByStatus.completed },
      { name: "Rejected", value: projectsByStatus.rejected },
    ],
    [projectsByStatus],
  );

  const centersCoverageData = useMemo(() => {
    if (isAdmin) {
      return [
        {
          name: "Centers with projects",
          value: adminSummaries.researchCenters.activeCenters,
        },
        {
          name: "Centers with no projects",
          value: adminSummaries.researchCenters.centersWithNoProjects,
        },
      ];
    }

    const assigned = (chartProjects || []).filter((project) =>
      Boolean(project?.research_center_id),
    ).length;
    const unassigned = Math.max(0, (chartProjects || []).length - assigned);

    return [
      { name: "Assigned to center", value: assigned },
      { name: "Unassigned center", value: unassigned },
    ];
  }, [adminSummaries.researchCenters, chartProjects, isAdmin]);

  const centerAssignmentSummary = useMemo(() => {
    if (isAdmin) return null;
    const assigned = (chartProjects || []).filter((project) =>
      Boolean(project?.research_center_id),
    ).length;
    const total = (chartProjects || []).length;
    return { assigned, unassigned: Math.max(0, total - assigned) };
  }, [chartProjects, isAdmin]);

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
      .slice(0, 6);
  }, [centerById, chartProjects]);

  const departmentMixData = useMemo(() => {
    const map = new Map();

    chartProjects.forEach((project) => {
      const label =
        departmentById[project.department_id] ||
        project.department_name ||
        "Unassigned Department";
      if (!map.has(label)) {
        map.set(label, { label, projects: 0, affiliates: 0, awards: 0 });
      }
      map.get(label).projects += 1;
    });

    affiliateRows.forEach((row) => {
      const label = String(row.department || "Unassigned Department").trim();
      if (!map.has(label)) {
        map.set(label, { label, projects: 0, affiliates: 0, awards: 0 });
      }
      map.get(label).affiliates += 1;
      map.get(label).awards += Number(row.awards_count || 0);
    });

    return [...map.values()]
      .sort((a, b) => b.projects + b.affiliates - (a.projects + a.affiliates))
      .slice(0, 6);
  }, [affiliateRows, chartProjects, departmentById]);

  const affiliateRoleData = useMemo(() => {
    const counts = new Map();
    affiliateRows.forEach((row) => {
      const label = String(row.role || "other").trim() || "other";
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts.entries()].map(([label, value], index) => ({
      name: label,
      value,
      fill: PALETTE[index % PALETTE.length],
    }));
  }, [affiliateRows]);

  const affiliateStatusData = useMemo(() => {
    const active = affiliateRows.filter((row) => row.is_active).length;
    const inactive = Math.max(0, affiliateRows.length - active);
    return [
      { name: "Active", value: active, fill: "#1d9a6c" },
      { name: "Inactive", value: inactive, fill: "#e5e7eb" },
    ];
  }, [affiliateRows]);

  const outputTypeLabelByValue = useMemo(
    () =>
      EXPECTED_OUTPUT_TYPE_OPTIONS.reduce((acc, item) => {
        acc[item.value] = item.label;
        return acc;
      }, {}),
    [],
  );

  const outputsByType = useMemo(() => {
    const counts = new Map();

    chartProjects.forEach((project) => {
      const items = Array.isArray(project.expected_outputs_items)
        ? project.expected_outputs_items
        : [];

      if (items.length) {
        items.forEach((item) => {
          const raw = String(item.output_type || item.outputType || "").trim();
          const label = outputTypeLabelByValue[raw] || raw || "Unspecified";
          counts.set(label, (counts.get(label) || 0) + 1);
        });
        return;
      }

      const fallback = String(project.expected_outputs || "").trim();
      if (!fallback) return;
      fallback
        .split(",")
        .map((segment) => segment.trim())
        .filter(Boolean)
        .forEach((label) => {
          counts.set(label, (counts.get(label) || 0) + 1);
        });
    });

    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [chartProjects, outputTypeLabelByValue]);

  const outputsMonthly = useMemo(() => {
    const monthMap = new Map();
    const today = new Date();

    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, {
        key,
        month: d.toLocaleDateString(undefined, { month: "short" }),
        outputs: 0,
      });
    }

    chartProjects.forEach((project) => {
      const rawDate =
        project.submitted_at || project.updated_at || project.created_at;
      if (!rawDate) return;
      const d = new Date(rawDate);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap.has(key)) return;

      const items = Array.isArray(project.expected_outputs_items)
        ? project.expected_outputs_items.length
        : 0;
      const fallback = String(project.expected_outputs || "")
        .split(",")
        .map((segment) => segment.trim())
        .filter(Boolean).length;
      const total = items || fallback;
      if (!total) return;

      monthMap.get(key).outputs += total;
    });

    return Array.from(monthMap.values());
  }, [chartProjects]);

  const awardsByDepartment = useMemo(() => {
    const map = new Map();
    affiliateRows.forEach((row) => {
      const label = String(row.department || "Unassigned Department").trim();
      const count = Number(row.awards_count || 0);
      if (!map.has(label)) {
        map.set(label, { label, count: 0 });
      }
      map.get(label).count += count;
    });

    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [affiliateRows]);

  const awardsSummaryData = useMemo(() => {
    const totalAwards = affiliateRows.reduce(
      (sum, row) => sum + Number(row.awards_count || 0),
      0,
    );
    const affiliatesWithAwards = affiliateRows.filter(
      (row) => Number(row.awards_count || 0) > 0,
    ).length;
    const affiliatesWithoutAwards = Math.max(
      0,
      affiliateRows.length - affiliatesWithAwards,
    );

    return {
      totalAwards,
      donut: [
        { name: "Affiliates with awards", value: affiliatesWithAwards },
        { name: "Affiliates without awards", value: affiliatesWithoutAwards },
      ],
    };
  }, [affiliateRows]);

  const qualityPulseData = useMemo(() => {
    const base = [
      {
        name: "Projects with center",
        value: crossModuleHealth.projectCenterPct,
        fill: "#1557a1",
      },
      {
        name: "Projects with agenda",
        value: crossModuleHealth.projectAgendaPct,
        fill: "#36b7a6",
      },
    ];

    if (isAdmin) {
      base.push({
        name: "Affiliates with center",
        value: crossModuleHealth.affiliateCenterPct,
        fill: "#f59e0b",
      });
    }

    return base;
  }, [crossModuleHealth, isAdmin]);

  const facultyInsights = useMemo(() => {
    if (isAdmin) {
      return {
        upcomingDeadlines: [],
        needsAttention: [],
        counts: {
          drafts: 0,
          missingOutputs: 0,
          missingCenter: 0,
          missingAgenda: 0,
          missingEndDate: 0,
        },
      };
    }

    const now = new Date();

    const counts = {
      drafts: 0,
      missingOutputs: 0,
      missingCenter: 0,
      missingAgenda: 0,
      missingEndDate: 0,
    };

    const needsAttention = [];

    (chartProjects || []).forEach((project) => {
      const issues = [];
      const title = project?.title || "Untitled project";
      const submissionState = String(project?.submission_state || "")
        .trim()
        .toLowerCase();

      if (submissionState === "draft") {
        counts.drafts += 1;
        issues.push("Draft");
      }

      if (!project?.research_center_id) {
        counts.missingCenter += 1;
        issues.push("Missing center");
      }

      const hasAgenda =
        Boolean(project?.research_agenda_id) ||
        Boolean(project?.agenda_id) ||
        Boolean(project?.agenda_name);
      if (!hasAgenda) {
        counts.missingAgenda += 1;
        issues.push("Missing agenda");
      }

      const items = Array.isArray(project?.expected_outputs_items)
        ? project.expected_outputs_items
        : [];
      const fallbackOutputs = String(project?.expected_outputs || "").trim();
      if (!items.length && !fallbackOutputs) {
        counts.missingOutputs += 1;
        issues.push("Missing outputs");
      }

      const status = normalizeStatus(project?.status);
      if (
        (status === "ongoing" || status === "proposal") &&
        !project?.end_date
      ) {
        counts.missingEndDate += 1;
        issues.push("Missing end date");
      }

      if (issues.length) {
        needsAttention.push({
          id: project?.id,
          title,
          issues,
        });
      }
    });

    const upcomingDeadlines = (chartProjects || [])
      .map((project) => {
        if (!project?.end_date) return null;
        const status = normalizeStatus(project?.status);
        if (status === "completed" || status === "rejected") return null;
        const due = new Date(project.end_date);
        if (Number.isNaN(due.getTime())) return null;
        const daysLeft = Math.ceil((due - now) / (24 * 60 * 60 * 1000));
        if (daysLeft < 0) return null;
        return {
          id: project?.id,
          title: project?.title || "Untitled project",
          due,
          daysLeft,
          status,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.due - b.due)
      .slice(0, 5);

    const sortedNeedsAttention = needsAttention
      .sort((a, b) => b.issues.length - a.issues.length)
      .slice(0, 5);

    return {
      upcomingDeadlines,
      needsAttention: sortedNeedsAttention,
      counts,
    };
  }, [chartProjects, isAdmin]);

  return (
    <section className="page-stack-lg">
      <div className="rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6 shadow-sm">
        <PageHeader
          title="Dashboard"
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
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {isAdmin
            ? "A visual pulse check across research centers, departments, affiliates, projects, outputs, and recognitions. Trends update from live records and focus on momentum, coverage, and quality."
            : "A personal pulse check for your research submissions and progress. Metrics focus on momentum, coverage, and completeness of your project records."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          {isAdmin ? (
            <>
              <span className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2">
                Centers: {adminSummaries.researchCenters.totalCenters}
              </span>
              <span className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2">
                Departments: {effectiveDepartments.length}
              </span>
              <span className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2">
                Affiliates: {adminSummaries.affiliates.totalAffiliates}
              </span>
              <span className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2">
                Projects: {adminSummaries.projects.totalProjects}
              </span>
              <span className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2">
                Data quality: {crossModuleHealth.dataQualityScore}%
              </span>
            </>
          ) : (
            <>
              <span className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2">
                {isFaculty ? "Faculty projects" : "My projects"}:{" "}
                {adminSummaries.projects.totalProjects}
              </span>
              <span className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2">
                This year: {adminSummaries.projects.thisYear}
              </span>
              <span className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2">
                Deadline soon: {adminSummaries.projects.nearingDeadline}
              </span>
              <span className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2">
                Data quality: {crossModuleHealth.dataQualityScore}%
              </span>
            </>
          )}
        </div>
      </div>

      <InlineNotice
        type="error"
        title="Dashboard load issue"
        message={error || affiliateError || referenceError?.message}
      />

      <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Portfolio Pulse
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Highlights for research activity volume and project momentum over the
          last 12 months.
        </p>
      </div>

      {!isAdmin ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <DashboardPanel
            title="Next Steps"
            cardClassName={PANEL_CARD_CLASS}
            headerClassName={PANEL_HEADER_CLASS}
            bodyClassName={PANEL_BODY_CLASS}
          >
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to="/projects/submit">New project</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/projects">View projects</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/outputs">Outputs</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/profile">Profile</Link>
              </Button>
            </div>

            <div className="mt-6 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Draft Projects
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {facultyInsights.counts.drafts}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Continue drafts from Projects.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Missing Outputs
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {facultyInsights.counts.missingOutputs}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Add expected outputs to improve tracking.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Missing Center / Agenda
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {facultyInsights.counts.missingCenter} /{" "}
                  {facultyInsights.counts.missingAgenda}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Assign classification for reporting.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Missing End Date
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {facultyInsights.counts.missingEndDate}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Helps deadline and progress monitoring.
                </p>
              </div>
            </div>

            {facultyInsights.needsAttention.length ? (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Needs Attention
                </p>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {facultyInsights.needsAttention.map((item) => (
                    <li
                      key={`attention-${item.id || item.title}`}
                      className="rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3"
                    >
                      {item.id ? (
                        <Link
                          to={`/projects/${encodeURIComponent(String(item.id))}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-900">
                          {item.title}
                        </span>
                      )}
                      <p className="mt-1 text-xs text-slate-500">
                        {item.issues.join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </DashboardPanel>

          <DashboardPanel
            title="Upcoming Deadlines"
            cardClassName={PANEL_CARD_CLASS}
            headerClassName={PANEL_HEADER_CLASS}
            bodyClassName={PANEL_BODY_CLASS}
          >
            {facultyInsights.upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-slate-600">
                No upcoming deadlines found in your projects.
              </p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-700">
                {facultyInsights.upcomingDeadlines.map((item) => {
                  const dueLabel = item.due.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });
                  const urgencyClass =
                    item.daysLeft <= 7
                      ? "text-rose-700"
                      : item.daysLeft <= 14
                        ? "text-amber-700"
                        : "text-slate-500";

                  return (
                    <li
                      key={`deadline-${item.id || item.title}`}
                      className="rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3"
                    >
                      {item.id ? (
                        <Link
                          to={`/projects/${encodeURIComponent(String(item.id))}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-900">
                          {item.title}
                        </span>
                      )}
                      <p className="mt-1 text-xs text-slate-500">
                        Due {dueLabel} ·{" "}
                        <span className={urgencyClass}>
                          {item.daysLeft === 0
                            ? "due today"
                            : `${item.daysLeft} day${
                                item.daysLeft === 1 ? "" : "s"
                              } left`}
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </DashboardPanel>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardPanel
          title="Portfolio Pulse (Monthly Submissions)"
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
        >
          <ChartFrame height={320}>
            <AreaChart
              data={monthlySubmissions}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="submissionGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1557a1" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#1557a1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="submissions"
                name="Submissions"
                stroke="#1557a1"
                strokeWidth={2}
                fill="url(#submissionGlow)"
              />
            </AreaChart>
          </ChartFrame>
        </DashboardPanel>

        <DashboardPanel
          title="Project Status Distribution"
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
        >
          <ChartFrame height={320}>
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie
                data={statusChartData}
                dataKey="value"
                nameKey="name"
                innerRadius={65}
                outerRadius={110}
                paddingAngle={2}
              >
                {statusChartData.map((entry, index) => (
                  <Cell
                    key={`status-${entry.name}`}
                    fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ChartFrame>
        </DashboardPanel>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Project Health
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Yearly lifecycle mix and data completeness for projects and
          affiliates.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <DashboardPanel
          title="Lifecycle Status Breakdown"
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
        >
          {lifecycleBreakdown.length === 0 ? (
            <p className="text-sm text-slate-600">No lifecycle data yet.</p>
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

        <DashboardPanel
          title="Data Quality Pulse"
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
        >
          <ChartFrame height={300}>
            <RadialBarChart
              innerRadius="35%"
              outerRadius="90%"
              data={qualityPulseData}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background dataKey="value" cornerRadius={6} />
              <Legend />
              <Tooltip />
            </RadialBarChart>
          </ChartFrame>
        </DashboardPanel>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Centers and Departments
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Coverage and activity concentration by research centers and
          departments.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DashboardPanel
          title={isAdmin ? "Research Centers Coverage" : "Center Assignment"}
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
        >
          <ChartFrame height={260}>
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie
                data={centersCoverageData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {centersCoverageData.map((entry, index) => (
                  <Cell
                    key={`center-${entry.name}`}
                    fill={PALETTE[index % PALETTE.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ChartFrame>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
            {isAdmin ? (
              <>
                <div>
                  Total centers: {adminSummaries.researchCenters.totalCenters}
                </div>
                <div>
                  Total agendas: {adminSummaries.researchCenters.totalAgenda}
                </div>
              </>
            ) : (
              <>
                <div>With center: {centerAssignmentSummary?.assigned ?? 0}</div>
                <div>
                  Without center: {centerAssignmentSummary?.unassigned ?? 0}
                </div>
              </>
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Top Centers by Project Count"
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
        >
          {topCentersByProject.length === 0 ? (
            <p className="text-sm text-slate-600">No center data available.</p>
          ) : (
            <ChartFrame height={260}>
              <BarChart
                data={topCentersByProject}
                layout="vertical"
                margin={{ top: 8, right: 12, left: 24, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={140}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Bar dataKey="count" fill="#1557a1" radius={[6, 6, 6, 6]} />
              </BarChart>
            </ChartFrame>
          )}
        </DashboardPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-1">
        <DashboardPanel
          title={
            isAdmin
              ? "Department Mix (Projects vs Affiliates)"
              : "Department Mix (Projects)"
          }
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
        >
          {departmentMixData.length === 0 ? (
            <p className="text-sm text-slate-600">No department data yet.</p>
          ) : (
            <ChartFrame height={300}>
              <BarChart
                data={departmentMixData}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="projects" name="Projects" fill="#1557a1" />
                {isAdmin ? (
                  <Bar dataKey="affiliates" name="Affiliates" fill="#36b7a6" />
                ) : null}
              </BarChart>
            </ChartFrame>
          )}
        </DashboardPanel>
      </div>

      {isAdmin ? (
        <>
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Affiliates Snapshot
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Quick counts for affiliates, roles, and activation status.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <DashboardPanel
              title="Affiliates Footprint"
              cardClassName={PANEL_CARD_CLASS}
              headerClassName={PANEL_HEADER_CLASS}
              bodyClassName={PANEL_BODY_CLASS}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Total Affiliates
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {adminSummaries.affiliates.totalAffiliates}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Active: {adminSummaries.affiliates.activeAffiliates}{" "}
                    {"\u00b7"} Inactive:{" "}
                    {adminSummaries.affiliates.inactiveAffiliates}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Role Split
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {adminSummaries.affiliates.facultyCount} /{" "}
                    {adminSummaries.affiliates.studentCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Faculty / Student
                  </p>
                </div>
              </div>
            </DashboardPanel>

            <DashboardPanel
              title="Research Projects Focus"
              cardClassName={PANEL_CARD_CLASS}
              headerClassName={PANEL_HEADER_CLASS}
              bodyClassName={PANEL_BODY_CLASS}
            >
              <div className="grid gap-4 sm:grid-cols-3 text-sm text-slate-600">
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Total Projects
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {adminSummaries.projects.totalProjects}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    This Year
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {adminSummaries.projects.thisYear}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Deadline Soon
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {adminSummaries.projects.nearingDeadline}
                  </p>
                </div>
              </div>
            </DashboardPanel>
          </div>
        </>
      ) : null}

      <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {isAdmin ? "Outputs and Recognition" : "Outputs"}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {isAdmin
            ? "Expected outputs volume and recognition counts for research impact."
            : "Expected outputs volume tracked across your projects."}
        </p>
      </div>

      <div
        className={`grid gap-4 ${isAdmin ? "xl:grid-cols-2" : "xl:grid-cols-1"}`}
      >
        <DashboardPanel
          title="Research Outputs (Expected)"
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
        >
          {outputsByType.length === 0 ? (
            <p className="text-sm text-slate-600">
              No expected outputs attached to projects yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Total Expected Outputs
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {outputsByType.reduce((sum, item) => sum + item.count, 0)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Based on project output tracking.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Top Output Type
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {outputsByType[0]?.label || "-"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Count: {outputsByType[0]?.count || 0}
                </p>
              </div>
            </div>
          )}
        </DashboardPanel>

        {isAdmin ? (
          <DashboardPanel
            title="Awards and Recognition"
            cardClassName={PANEL_CARD_CLASS}
            headerClassName={PANEL_HEADER_CLASS}
            bodyClassName={PANEL_BODY_CLASS}
          >
            {affiliateRows.length === 0 ? (
              <p className="text-sm text-slate-600">
                No awards data available.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Total Awards
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {awardsSummaryData.totalAwards}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Across all affiliates.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Top Department
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {awardsByDepartment[0]?.label || "-"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Awards: {awardsByDepartment[0]?.count || 0}
                  </p>
                </div>
              </div>
            )}
          </DashboardPanel>
        ) : null}
      </div>
    </section>
  );
}
