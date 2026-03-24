import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
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
import InlineNotice from "@/components/feedback/InlineNotice";
import PageHeader from "@/components/layout/PageHeader";
import { ChartFrame, DashboardPanel } from "@/components/dashboard";
import { useDashboardData, useDashboardSections } from "@/hooks/dashboard";
import {
  Award,
  BookOpen,
  Building2,
  FileText,
  FolderKanban,
  Link2,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PALETTE = [
  "#0f4c81",
  "#2f7bbd",
  "#36b7a6",
  "#f0b429",
  "#e56b6f",
  "#9f86c0",
  "#0ea5e9",
  "#22c55e",
];

const PANEL_CARD_CLASS =
  "min-h-[420px] flex flex-col border-slate-200/70 bg-white/90 shadow-[0_18px_40px_-32px_rgba(15,76,129,0.65)]";
const PANEL_HEADER_CLASS =
  "bg-gradient-to-r from-slate-50 via-white to-slate-100";
const PANEL_BODY_CLASS = "p-6 flex-1";

function safeString(value) {
  return String(value ?? "").trim();
}

function normalizeCenterId(value, knownCenterIds) {
  const raw = safeString(value);
  if (!raw) return "__unassigned__";
  if (raw === "__unassigned__") return "__unassigned__";
  if (knownCenterIds && knownCenterIds.has(raw)) return raw;

  const lowered = raw.toLowerCase();
  if (
    lowered === "0" ||
    lowered === "null" ||
    lowered === "undefined" ||
    lowered === "none" ||
    lowered === "n/a"
  ) {
    return "__unassigned__";
  }

  return raw;
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCount(value) {
  return toNumber(value).toLocaleString();
}

function resolveYearFromRecord(record) {
  const directYear = safeString(record?.year || record?.year_received);
  if (directYear && /^\d{4}$/.test(directYear)) return directYear;

  const candidates = [
    record?.submitted_at,
    record?.created_at,
    record?.updated_at,
    record?.start_date,
    record?.end_date,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return String(d.getFullYear());
  }

  return "";
}

function SummaryCard({ label, value, hint, Icon = null }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-slate-300/70 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>
        {Icon ? (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/70 bg-white text-slate-700 shadow-sm transition group-hover:border-slate-300/80">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-3xl font-semibold leading-none text-slate-900">
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const role = safeString(profile?.role).toLowerCase();
  const isAdmin = role === "admin";

  const {
    projects,
    error,
    referenceError,
    effectiveCenters,
    effectiveDepartments,
  } = useDashboardData({ user, profile, isAdmin });

  const knownCenterIds = useMemo(() => {
    return new Set(
      (effectiveCenters || [])
        .map((center) => safeString(center?.id))
        .filter(Boolean),
    );
  }, [effectiveCenters]);

  const scopedProjects = useMemo(() => {
    if (isAdmin) return projects || [];
    const ownerId = safeString(profile?.id || user?.id);
    if (!ownerId) return [];
    return (projects || []).filter(
      (project) => safeString(project?.submitted_by) === ownerId,
    );
  }, [isAdmin, profile?.id, projects, user?.id]);

  const visibleProjects = scopedProjects;

  const [filters, setFilters] = useState({
    centerId: "",
    departmentId: "",
    year: "",
  });

  const {
    yearOptions: dashboardYearOptions,
    overview: dashboardOverview,
    centerBreakdownRows: dashboardCenterBreakdownRows,
    projectsPerCenterData: dashboardProjectsPerCenterData,
    outputsByDepartmentData: dashboardOutputsByDepartmentData,
    outputsOverTimeData: dashboardOutputsOverTimeData,
    awardsByCategoryData: dashboardAwardsByCategoryData,
    recentProjects: dashboardRecentProjects,
    recentOutputs: dashboardRecentOutputs,
    recentAwards: dashboardRecentAwards,
    loading: dashboardLoading,
    error: dashboardError,
  } = useDashboardSections({ filters });

  const visibleCenterIds = useMemo(() => {
    if (isAdmin) {
      return new Set(
        (effectiveCenters || []).map((center) => safeString(center?.id)),
      );
    }

    const ids = new Set(
      (visibleProjects || [])
        .map((project) =>
          normalizeCenterId(project?.research_center_id, knownCenterIds),
        )
        .filter(Boolean),
    );
    const profileCenterId = normalizeCenterId(
      profile?.ckan_org_id || profile?.research_center_id,
      knownCenterIds,
    );
    if (profileCenterId) ids.add(profileCenterId);
    return ids;
  }, [
    effectiveCenters,
    isAdmin,
    knownCenterIds,
    profile?.ckan_org_id,
    profile?.research_center_id,
    visibleProjects,
  ]);

  const visibleCenters = useMemo(() => {
    if (isAdmin) return effectiveCenters || [];
    return (effectiveCenters || []).filter((center) =>
      visibleCenterIds.has(safeString(center?.id)),
    );
  }, [effectiveCenters, isAdmin, visibleCenterIds]);

  const visibleDepartmentIds = useMemo(() => {
    if (isAdmin) {
      return new Set(
        (effectiveDepartments || []).map((department) =>
          safeString(department?.id),
        ),
      );
    }

    const ids = new Set(
      (visibleProjects || [])
        .map((project) => safeString(project?.department_id))
        .filter(Boolean),
    );
    const profileDepartmentId = safeString(profile?.department_id);
    if (profileDepartmentId) ids.add(profileDepartmentId);
    return ids;
  }, [effectiveDepartments, isAdmin, profile?.department_id, visibleProjects]);

  const visibleDepartments = useMemo(() => {
    if (isAdmin) return effectiveDepartments || [];
    return (effectiveDepartments || []).filter((department) =>
      visibleDepartmentIds.has(safeString(department?.id)),
    );
  }, [effectiveDepartments, isAdmin, visibleDepartmentIds]);

  const yearOptions = Array.isArray(dashboardYearOptions)
    ? dashboardYearOptions
    : [];

  const summaryCounts = dashboardOverview || {
    centers: 0,
    departments: 0,
    affiliates: 0,
    linkedProjects: 0,
    projects: 0,
    outputs: 0,
    outputsSubmitted: 0,
    outputsExpected: 0,
    awards: 0,
  };

  const projectsPerCenterData = Array.isArray(dashboardProjectsPerCenterData)
    ? dashboardProjectsPerCenterData
    : [];

  const outputsByDepartmentData = Array.isArray(
    dashboardOutputsByDepartmentData,
  )
    ? dashboardOutputsByDepartmentData
    : [];

  const outputsOverTimeData = Array.isArray(dashboardOutputsOverTimeData)
    ? dashboardOutputsOverTimeData
    : [];

  const awardsByCategoryData = Array.isArray(dashboardAwardsByCategoryData)
    ? dashboardAwardsByCategoryData
    : [];

  const centerBreakdownRows = Array.isArray(dashboardCenterBreakdownRows)
    ? dashboardCenterBreakdownRows
    : [];

  const recentProjects = Array.isArray(dashboardRecentProjects)
    ? dashboardRecentProjects
    : [];

  const recentOutputs =
    dashboardRecentOutputs && typeof dashboardRecentOutputs === "object"
      ? dashboardRecentOutputs
      : { mode: "submitted", rows: [] };

  const recentAwards = Array.isArray(dashboardRecentAwards)
    ? dashboardRecentAwards
    : [];

  const loadIssueMessage =
    error || dashboardError || referenceError?.message || "";

  return (
    <section className="page-stack-lg">
      <div className="rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6 shadow-sm">
        <PageHeader
          title={
            isAdmin ? "Research Management Dashboard" : "My Research Dashboard"
          }
        />
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {isAdmin
            ? "Institution-wide overview across research centers, departments, affiliates, projects, outputs, and awards."
            : "Quick insights scoped to your affiliated portfolio: projects, outputs, and recognitions you can access."}
        </p>

        {isAdmin ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Research Center
              </p>
              <Select
                value={filters.centerId || "__all__"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    centerId: value === "__all__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger className="mt-2 bg-white/80">
                  <SelectValue placeholder="All centers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All centers</SelectItem>
                  {visibleCenters.map((center) => (
                    <SelectItem
                      key={`center-${safeString(center?.id)}`}
                      value={safeString(center?.id)}
                    >
                      {safeString(center?.name) || "Unnamed Center"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Department
              </p>
              <Select
                value={filters.departmentId || "__all__"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    departmentId: value === "__all__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger className="mt-2 bg-white/80">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All departments</SelectItem>
                  {visibleDepartments.map((department) => (
                    <SelectItem
                      key={`dept-${safeString(department?.id)}`}
                      value={safeString(department?.id)}
                    >
                      {safeString(department?.name) || "Unnamed Department"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Year
              </p>
              <Select
                value={filters.year || "__all__"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    year: value === "__all__" ? "" : value,
                  }))
                }
                disabled={yearOptions.length <= 1}
              >
                <SelectTrigger className="mt-2 bg-white/80">
                  <SelectValue placeholder="All years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All years</SelectItem>
                  {yearOptions.map((year) => (
                    <SelectItem key={`year-${year}`} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end justify-end sm:col-span-2 lg:col-span-1">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setFilters({ centerId: "", departmentId: "", year: "" })
                }
                disabled={dashboardLoading}
              >
                Reset filters
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <InlineNotice
        type="error"
        title="Dashboard load issue"
        message={loadIssueMessage}
      />

      <DashboardPanel
        title="Overview"
        cardClassName="border-slate-200/70 bg-white/90 shadow-sm"
        headerClassName={PANEL_HEADER_CLASS}
        bodyClassName="p-6"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isAdmin ? (
            <>
              <SummaryCard
                label="Research Centers"
                value={formatCount(summaryCounts.centers)}
                hint="Institution-wide"
                Icon={Building2}
              />
              <SummaryCard
                label="Departments"
                value={formatCount(summaryCounts.departments)}
                hint="Institution-wide"
                Icon={BookOpen}
              />
              <SummaryCard
                label="Affiliates"
                value={formatCount(summaryCounts.affiliates)}
                hint="Unique collaborators in scoped projects"
                Icon={Users}
              />
            </>
          ) : (
            <SummaryCard
              label="Linked Projects"
              value={formatCount(summaryCounts.linkedProjects)}
              hint="Projects where you are part of the research team"
              Icon={Link2}
            />
          )}
          <SummaryCard
            label={isAdmin ? "Research Projects" : "My Submitted Projects"}
            value={formatCount(summaryCounts.projects)}
            hint={
              isAdmin
                ? "Based on current filters"
                : "Projects you submitted (based on current filters)"
            }
            Icon={FolderKanban}
          />
          <SummaryCard
            label="Research Outputs"
            value={formatCount(summaryCounts.outputs)}
            hint={
              summaryCounts.outputsSubmitted && summaryCounts.outputsExpected
                ? `Submitted: ${formatCount(summaryCounts.outputsSubmitted)} · Expected: ${formatCount(
                    summaryCounts.outputsExpected,
                  )}`
                : summaryCounts.outputsSubmitted
                  ? "Submitted research outputs"
                  : summaryCounts.outputsExpected
                    ? "Expected outputs from projects"
                    : "No outputs in scope"
            }
            Icon={FileText}
          />
          <SummaryCard
            label="Awards & Recognitions"
            value={formatCount(summaryCounts.awards)}
            hint={
              summaryCounts.awards
                ? "From awards records"
                : safeString(filters.year)
                  ? "No awards for selected year"
                  : "No awards in scope"
            }
            Icon={Award}
          />
        </div>
        {dashboardLoading ? (
          <p className="mt-4 text-sm text-slate-600">Loading analytics...</p>
        ) : null}
      </DashboardPanel>

      <DashboardPanel
        title="Research Center Breakdown"
        cardClassName={PANEL_CARD_CLASS}
        headerClassName={PANEL_HEADER_CLASS}
        bodyClassName={PANEL_BODY_CLASS}
      >
        {centerBreakdownRows.length === 0 ? (
          <p className="text-sm text-slate-600">
            No research center metrics available for the current scope.
          </p>
        ) : (
          <Table className="rounded-2xl border border-slate-200/70">
            <TableHeader>
              <TableRow>
                <TableHead>Research Center</TableHead>
                <TableHead className="text-right">Projects</TableHead>
                <TableHead className="text-right">Affiliates</TableHead>
                <TableHead className="text-right">Outputs</TableHead>
                <TableHead className="text-right">Awards</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {centerBreakdownRows.slice(0, 12).map((row) => (
                <TableRow key={`center-breakdown-${row.id}`}>
                  <TableCell className="font-medium text-slate-900">
                    {isAdmin && row.id && row.id !== "__unassigned__" ? (
                      <Link
                        to={`/admin/research-center/${encodeURIComponent(
                          String(row.id),
                        )}`}
                        className="hover:underline"
                      >
                        {row.name}
                      </Link>
                    ) : (
                      row.name
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCount(row.projects)}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.affiliates === null
                      ? "-"
                      : formatCount(row.affiliates)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCount(row.outputs)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCount(row.awards)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {centerBreakdownRows.length > 12 ? (
          <p className="mt-3 text-xs text-slate-500">
            Showing top 12 centers by activity. Refine filters to focus.
          </p>
        ) : null}
      </DashboardPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardPanel
          title="Projects per Research Center"
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
        >
          {projectsPerCenterData.length === 0 ? (
            <p className="text-sm text-slate-600">No projects found.</p>
          ) : (
            <ChartFrame height={320}>
              <BarChart
                data={projectsPerCenterData}
                margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="center"
                  tick={{ fontSize: 12 }}
                  interval={0}
                  textAnchor="end"
                  height={60}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Projects" radius={[10, 10, 0, 0]}>
                  {projectsPerCenterData.map((row, index) => (
                    <Cell
                      key={`projects-center-${row.center}`}
                      fill={PALETTE[index % PALETTE.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartFrame>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Research Outputs by Department"
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
        >
          {outputsByDepartmentData.length === 0 ? (
            <p className="text-sm text-slate-600">
              No research outputs available for the current scope.
            </p>
          ) : (
            <ChartFrame height={320}>
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie
                  data={outputsByDepartmentData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={2}
                >
                  {outputsByDepartmentData.map((entry, index) => (
                    <Cell
                      key={`outputs-dept-${entry.name}`}
                      fill={PALETTE[index % PALETTE.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartFrame>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Research Outputs Over Time"
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
        >
          <ChartFrame height={320}>
            <LineChart
              data={outputsOverTimeData}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="outputs"
                name="Outputs"
                stroke="#0f4c81"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ChartFrame>
        </DashboardPanel>

        <DashboardPanel
          title="Awards by Category"
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
        >
          {awardsByCategoryData.length === 0 ? (
            <p className="text-sm text-slate-600">
              No awards found for the current scope.
            </p>
          ) : (
            <ChartFrame height={320}>
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie
                  data={awardsByCategoryData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={2}
                >
                  {awardsByCategoryData.map((entry, index) => (
                    <Cell
                      key={`awards-cat-${entry.name}`}
                      fill={PALETTE[index % PALETTE.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartFrame>
          )}
        </DashboardPanel>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Recent Activity / Highlights
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Latest updates across projects, outputs, and awards within your
          current scope.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DashboardPanel
          title="Recently Updated Projects"
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
        >
          {recentProjects.length === 0 ? (
            <p className="text-sm text-slate-600">No project activity yet.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-700">
              {recentProjects.map((project) => {
                const projectId = safeString(project?.id);
                const centerName =
                  safeString(project?.research_center_name) || "Unassigned";
                const updatedLabel = safeString(
                  project?.updated_at ||
                    project?.submitted_at ||
                    project?.created_at,
                );

                return (
                  <li
                    key={`recent-project-${projectId || safeString(project?.title)}`}
                    className="rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3"
                  >
                    {projectId ? (
                      <Link
                        to={`/projects/${encodeURIComponent(projectId)}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {safeString(project?.title) || "Untitled project"}
                      </Link>
                    ) : (
                      <span className="font-medium text-slate-900">
                        {safeString(project?.title) || "Untitled project"}
                      </span>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {centerName}
                      {updatedLabel
                        ? ` · ${new Date(updatedLabel).toLocaleDateString()}`
                        : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4">
            <Link
              to="/projects"
              className="text-sm font-medium text-sky-700 hover:underline"
            >
              View projects
            </Link>
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Latest Research Outputs"
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
        >
          {recentOutputs.mode === "submitted" &&
          Array.isArray(recentOutputs.rows) &&
          recentOutputs.rows.length ? (
            <ul className="space-y-2 text-sm text-slate-700">
              {recentOutputs.rows.map((row) => (
                <li
                  key={`recent-output-${safeString(row?.id) || safeString(row?.file_name)}`}
                  className="rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3"
                >
                  <p className="font-medium text-slate-900">
                    {safeString(row?.file_name) ||
                      safeString(row?.output_type) ||
                      "Research output"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {safeString(row?.output_type) || "Output"}
                    {safeString(row?.created_at || row?.updated_at)
                      ? ` · ${new Date(
                          row?.created_at || row?.updated_at,
                        ).toLocaleDateString()}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : recentOutputs.mode === "expected" &&
            Array.isArray(recentOutputs.rows) &&
            recentOutputs.rows.length ? (
            <ul className="space-y-2 text-sm text-slate-700">
              {recentOutputs.rows.map((row) => {
                return (
                  <li
                    key={`recent-expected-${row.projectId}`}
                    className="rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3"
                  >
                    {row.projectId ? (
                      <Link
                        to={`/projects/${encodeURIComponent(row.projectId)}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {safeString(row?.projectTitle) ||
                          "Project outputs updated"}
                      </Link>
                    ) : (
                      <span className="font-medium text-slate-900">
                        Project outputs updated
                      </span>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {row.labels?.length
                        ? row.labels.join(" · ")
                        : "Expected outputs"}
                      {row.timestamp
                        ? ` · ${new Date(row.timestamp).toLocaleDateString()}`
                        : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">No output activity yet.</p>
          )}

          <div className="mt-4">
            <Link
              to="/outputs"
              className="text-sm font-medium text-sky-700 hover:underline"
            >
              View research outputs
            </Link>
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Newly Received Awards"
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
        >
          {recentAwards.length === 0 ? (
            <p className="text-sm text-slate-600">No awards recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-700">
              {recentAwards.map((award) => (
                <li
                  key={`recent-award-${safeString(award?.id) || safeString(award?.ckan_dataset_id) || safeString(award?.award_recognition)}`}
                  className="rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3"
                >
                  <p className="font-medium text-slate-900">
                    {safeString(award?.award_recognition) ||
                      "Award / Recognition"}
                  </p>
                  {safeString(award?.recipients) ? (
                    <p className="mt-1 text-xs text-slate-600">
                      Recipient: {safeString(award?.recipients)}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">
                    {safeString(award?.level) || "Level"} ·{" "}
                    {safeString(award?.year_received) ||
                      resolveYearFromRecord(award) ||
                      "Year"}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Link
              to="/awards"
              className="text-sm font-medium text-sky-700 hover:underline"
            >
              View awards &amp; recognitions
            </Link>
          </div>
        </DashboardPanel>
      </div>
    </section>
  );
}
