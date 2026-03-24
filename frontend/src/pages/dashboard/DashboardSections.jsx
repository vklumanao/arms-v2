import { useMemo } from "react";
import { Link } from "react-router-dom";
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
import PageHeader from "@/components/layout/PageHeader";
import { ChartFrame, DashboardPanel } from "@/components/dashboard";
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
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ALL_VALUE,
  MAX_BAR_LABELS,
  MAX_PIE_CATEGORIES,
  TOP_CENTER_ROWS,
  formatCount,
  formatCountAndPercent,
  formatDateLabel,
  getTopIndices,
  resolveYearFromRecord,
  safeString,
  toNumber,
} from "./dashboardUtils";

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

function SummaryCard({ label, value, hint, Icon = null }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-slate-300/70 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
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
      {hint ? <p className="mt-2 text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}

function SummaryCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm">
      <div className="h-3 w-24 rounded-full bg-slate-200/70" />
      <div className="mt-3 h-8 w-20 rounded-full bg-slate-200/70" />
      <div className="mt-3 h-3 w-32 rounded-full bg-slate-200/60" />
    </div>
  );
}

function LoadingBlock({
  label = "Loading analytics...",
  headerWidthClass = "w-40",
  subHeaderWidthClass = "w-64",
  chartHeightClass = "h-56",
}) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <div className={`h-4 ${headerWidthClass} rounded-full bg-slate-200/70`} />
      <div
        className={`h-3 ${subHeaderWidthClass} rounded-full bg-slate-200/70`}
      />
      <div
        className={`${chartHeightClass} w-full rounded-2xl bg-slate-200/50`}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function LoadingListBlock({ label = "Loading recent activity...", rows = 3 }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <div className="h-4 w-32 rounded-full bg-slate-200/70" />
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`loading-row-${index}`}
          className="h-12 w-full rounded-xl bg-slate-200/60"
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

function SortableHeader({ label, sortKey, sortConfig, onChange }) {
  const isActive = sortConfig.key === sortKey;
  const direction = isActive ? sortConfig.direction : "none";
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
      onClick={() => {
        onChange((prev) => {
          const nextDirection =
            prev.key === sortKey && prev.direction === "desc" ? "asc" : "desc";
          return { key: sortKey, direction: nextDirection };
        });
      }}
      aria-sort={
        direction === "none"
          ? "none"
          : direction === "asc"
            ? "ascending"
            : "descending"
      }
    >
      <span>{label}</span>
      <span className="text-[10px]">
        {direction === "none" ? "<>" : direction === "asc" ? "^" : "v"}
      </span>
    </button>
  );
}

function ActivityItem({ colorClass, title, meta, secondary }) {
  return (
    <li className="rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-2 w-2 rounded-full ${colorClass}`} />
        <div>
          <p className="font-medium text-slate-900">{title}</p>
          {secondary ? (
            <p className="mt-1 text-xs text-slate-600">{secondary}</p>
          ) : null}
          {meta ? <p className="mt-1 text-xs text-slate-500">{meta}</p> : null}
        </div>
      </div>
    </li>
  );
}

export function DashboardHeader({
  isAdmin,
  title,
  description,
  filters,
  visibleCenters,
  visibleDepartments,
  yearOptions,
  activeFilterCount,
  lastUpdatedLabel,
  dashboardLoading,
  showFilters,
  onToggleFilters,
  onUpdateFilters,
  onClearFilters,
}) {
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6 shadow-sm">
      <PageHeader
        title={title}
        actions={
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {activeFilterCount ? (
              <span className="rounded-full border border-slate-200/80 bg-white/80 px-2 py-1 font-semibold uppercase tracking-[0.12em] text-slate-500">
                Filtered view - {activeFilterCount}
              </span>
            ) : null}
            <span className="rounded-full border border-slate-200/70 bg-white/70 px-2 py-1">
              {lastUpdatedLabel
                ? `Last updated ${lastUpdatedLabel}`
                : "Last updated --"}
            </span>
          </div>
        }
      />
      <p className="mt-2 max-w-3xl text-sm text-slate-600">
        <span className="sm:hidden">
          Quick overview of key research metrics.
        </span>
        <span className="hidden sm:inline">{description}</span>
      </p>

      {isAdmin ? (
        <>
          <div className="mt-5 flex items-center justify-between gap-3 sm:hidden">
            <Button
              type="button"
              variant="outline"
              onClick={onToggleFilters}
              aria-expanded={showFilters}
            >
              {showFilters ? "Hide filters" : "Filters"}
            </Button>
            {activeFilterCount ? (
              <span className="rounded-full border border-slate-200/70 bg-white/80 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                {activeFilterCount} active
              </span>
            ) : null}
          </div>

          <div
            className={`${
              showFilters ? "grid" : "hidden"
            } mt-4 gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4`}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Research Center
              </p>
              <Select
                value={filters.centerId || ALL_VALUE}
                onValueChange={(value) =>
                  onUpdateFilters((prev) => ({
                    ...prev,
                    centerId: value === ALL_VALUE ? "" : value,
                  }))
                }
              >
                <SelectTrigger className="mt-2 bg-white/80">
                  <SelectValue placeholder="All centers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All centers</SelectItem>
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
                value={filters.departmentId || ALL_VALUE}
                onValueChange={(value) =>
                  onUpdateFilters((prev) => ({
                    ...prev,
                    departmentId: value === ALL_VALUE ? "" : value,
                  }))
                }
              >
                <SelectTrigger className="mt-2 bg-white/80">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All departments</SelectItem>
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
                value={filters.year || ALL_VALUE}
                onValueChange={(value) =>
                  onUpdateFilters((prev) => ({
                    ...prev,
                    year: value === ALL_VALUE ? "" : value,
                  }))
                }
                disabled={yearOptions.length <= 1}
              >
                <SelectTrigger className="mt-2 bg-white/80">
                  <SelectValue placeholder="All years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All years</SelectItem>
                  {yearOptions.map((year) => (
                    <SelectItem key={`year-${year}`} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end justify-between sm:col-span-2 lg:col-span-1">
              <Button
                type="button"
                variant="outline"
                onClick={onClearFilters}
                disabled={dashboardLoading || activeFilterCount === 0}
              >
                Clear all
              </Button>
              {activeFilterCount ? (
                <span className="hidden text-xs text-slate-500 lg:inline">
                  Showing filtered results
                </span>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function OverviewSection({ isAdmin, summaryCounts, filters, loading }) {
  return (
    <DashboardPanel
      title="Overview"
      cardClassName="border-slate-200/70 bg-white/90 shadow-sm"
      headerClassName={PANEL_HEADER_CLASS}
      bodyClassName="p-6"
    >
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: isAdmin ? 6 : 4 }).map((_, index) => (
            <SummaryCardSkeleton key={`summary-skeleton-${index}`} />
          ))}
        </div>
      ) : (
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
                ? `Submitted: ${formatCount(summaryCounts.outputsSubmitted)} - Expected: ${formatCount(
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
      )}
    </DashboardPanel>
  );
}

export function CenterBreakdownSection({
  isAdmin,
  loading,
  centerBreakdownRows,
  showAllCenters,
  onToggleShowAll,
  sortConfig,
  onSortChange,
}) {
  const sortedCenterRows = useMemo(() => {
    const rows = [...centerBreakdownRows];
    const { key, direction } = sortConfig;
    if (!key) return rows;
    rows.sort((a, b) => {
      const aValue = key === "name" ? safeString(a?.name) : toNumber(a?.[key]);
      const bValue = key === "name" ? safeString(b?.name) : toNumber(b?.[key]);
      if (aValue < bValue) return direction === "asc" ? -1 : 1;
      if (aValue > bValue) return direction === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [centerBreakdownRows, sortConfig]);

  const displayedCenterRows = showAllCenters
    ? sortedCenterRows
    : sortedCenterRows.slice(0, TOP_CENTER_ROWS);

  return (
    <DashboardPanel
      title={`Research Center Breakdown${loading ? " (Loading...)" : ""}`}
      cardClassName={PANEL_CARD_CLASS}
      headerClassName={PANEL_HEADER_CLASS}
      bodyClassName={PANEL_BODY_CLASS}
    >
      <p className="mb-3 text-xs text-slate-600">
        Top centers by activity across projects, outputs, and awards.
      </p>
      {loading ? (
        <LoadingBlock
          label="Loading research center breakdown..."
          chartHeightClass="h-48"
        />
      ) : centerBreakdownRows.length === 0 ? (
        <p className="text-sm text-slate-600">
          No research center metrics available for the current scope.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {showAllCenters
                ? `Showing all ${centerBreakdownRows.length} centers`
                : `Showing ${TOP_CENTER_ROWS} of ${centerBreakdownRows.length} centers`}
            </span>
            <span className="hidden sm:inline">
              Click a column to sort the table.
            </span>
          </div>
          <div className="max-h-[420px] overflow-auto rounded-2xl border border-slate-200/70">
            <Table aria-label="Research center breakdown table">
              <caption className="sr-only">
                Research center breakdown showing projects, affiliates, outputs,
                and awards.
              </caption>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 z-10 bg-white/90">
                    <SortableHeader
                      label="Research Center"
                      sortKey="name"
                      sortConfig={sortConfig}
                      onChange={onSortChange}
                    />
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-white/90 text-right">
                    <SortableHeader
                      label="Projects"
                      sortKey="projects"
                      sortConfig={sortConfig}
                      onChange={onSortChange}
                    />
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-white/90 text-right">
                    <SortableHeader
                      label="Affiliates"
                      sortKey="affiliates"
                      sortConfig={sortConfig}
                      onChange={onSortChange}
                    />
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-white/90 text-right">
                    <SortableHeader
                      label="Outputs"
                      sortKey="outputs"
                      sortConfig={sortConfig}
                      onChange={onSortChange}
                    />
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-white/90 text-right">
                    <SortableHeader
                      label="Awards"
                      sortKey="awards"
                      sortConfig={sortConfig}
                      onChange={onSortChange}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedCenterRows.map((row) => (
                  <TableRow
                    key={`center-breakdown-${row.id}`}
                    className="transition hover:bg-slate-50/80"
                  >
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
          </div>
        </>
      )}
      {centerBreakdownRows.length > TOP_CENTER_ROWS ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            {showAllCenters
              ? "Showing all centers in scope."
              : `Showing top ${TOP_CENTER_ROWS} centers by activity. Refine filters to focus.`}
          </p>
          <Button
            type="button"
            variant="ghost"
            className="h-auto px-2 py-1 text-xs"
            onClick={onToggleShowAll}
          >
            {showAllCenters
              ? `Show top ${TOP_CENTER_ROWS}`
              : "Show all centers"}
          </Button>
        </div>
      ) : null}
    </DashboardPanel>
  );
}

export function ProjectsPerCenterSection({
  loading,
  projectsPerCenterData,
  totalProjectsPerCenter,
}) {
  const projectsBarIsHorizontal = projectsPerCenterData.length > 12;
  const renderBarLabel = ({ x, y, width, height, value, index }) => {
    if (index >= MAX_BAR_LABELS || value === undefined || value === null)
      return null;
    const formatted = formatCountAndPercent(
      toNumber(value),
      totalProjectsPerCenter,
    );
    if (projectsBarIsHorizontal) {
      return (
        <text
          x={x + width + 8}
          y={y + height / 2}
          dy={4}
          fill="#0f172a"
          fontSize={11}
        >
          {formatted}
        </text>
      );
    }
    return (
      <text
        x={x + width / 2}
        y={y - 6}
        textAnchor="middle"
        fill="#0f172a"
        fontSize={11}
      >
        {formatted}
      </text>
    );
  };

  return (
    <DashboardPanel
      title={`Projects per Research Center${loading ? " (Loading...)" : ""}`}
      cardClassName={PANEL_CARD_CLASS}
      headerClassName={PANEL_HEADER_CLASS}
      bodyClassName={PANEL_BODY_CLASS}
    >
      <p className="mb-3 text-xs text-slate-600">
        Distribution of projects by research center.
      </p>
      {loading ? (
        <LoadingBlock label="Loading projects per research center..." />
      ) : projectsPerCenterData.length === 0 ? (
        <p className="text-sm text-slate-600">No projects found.</p>
      ) : (
        <div
          role="img"
          aria-label="Bar chart showing projects per research center"
        >
          <ChartFrame height={420}>
            <BarChart
              data={projectsPerCenterData}
              layout={projectsBarIsHorizontal ? "vertical" : "horizontal"}
              margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              {projectsBarIsHorizontal ? (
                <>
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="center"
                    width={180}
                    tick={{ fontSize: 12 }}
                  />
                </>
              ) : (
                <>
                  <XAxis
                    dataKey="center"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                </>
              )}
              <Tooltip
                formatter={(value) =>
                  formatCountAndPercent(value, totalProjectsPerCenter)
                }
              />
              <Legend />
              <Bar
                dataKey="count"
                name="Projects"
                radius={
                  projectsBarIsHorizontal ? [0, 10, 10, 0] : [10, 10, 0, 0]
                }
                fill="#0f4c81"
              >
                <LabelList dataKey="count" content={renderBarLabel} />
              </Bar>
            </BarChart>
          </ChartFrame>
          <p className="sr-only">
            {`Projects per research center across ${projectsPerCenterData.length} center${
              projectsPerCenterData.length === 1 ? "" : "s"
            }.`}
          </p>
          {projectsPerCenterData.length > MAX_BAR_LABELS ? (
            <p className="mt-3 text-xs text-slate-500">
              Showing labels for top {MAX_BAR_LABELS}. Hover for full details.
            </p>
          ) : null}
        </div>
      )}
    </DashboardPanel>
  );
}

export function OutputsByDepartmentSection({
  loading,
  outputsByDepartmentData,
  totalOutputsByDepartment,
}) {
  const outputsByDepartmentIsBar =
    outputsByDepartmentData.length > MAX_PIE_CATEGORIES;
  const outputsTopIndices = getTopIndices(outputsByDepartmentData, 4);

  return (
    <DashboardPanel
      title={`Research Outputs by Department${loading ? " (Loading...)" : ""}`}
      cardClassName={PANEL_CARD_CLASS}
      headerClassName={PANEL_HEADER_CLASS}
      bodyClassName={PANEL_BODY_CLASS}
    >
      <p className="mb-3 text-xs text-slate-600">
        Outputs distribution across departments.
      </p>
      {loading ? (
        <LoadingBlock label="Loading outputs by department..." />
      ) : outputsByDepartmentData.length === 0 ? (
        <p className="text-sm text-slate-600">
          No research outputs available for the current scope.
        </p>
      ) : (
        <div
          role="img"
          aria-label="Pie chart showing research outputs by department"
        >
          <ChartFrame height={320}>
            {outputsByDepartmentIsBar ? (
              <BarChart
                data={outputsByDepartmentData}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) =>
                    formatCountAndPercent(value, totalOutputsByDepartment)
                  }
                />
                <Legend />
                <Bar
                  dataKey="value"
                  name="Outputs"
                  fill="#36b7a6"
                  radius={[0, 10, 10, 0]}
                >
                  <LabelList
                    dataKey="value"
                    content={({ x, y, width, height, value, index }) => {
                      if (index >= MAX_BAR_LABELS) return null;
                      return (
                        <text
                          x={x + width + 8}
                          y={y + height / 2}
                          dy={4}
                          fill="#0f172a"
                          fontSize={11}
                        >
                          {formatCountAndPercent(
                            value,
                            totalOutputsByDepartment,
                          )}
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            ) : (
              <PieChart>
                <Tooltip
                  formatter={(value) =>
                    formatCountAndPercent(value, totalOutputsByDepartment)
                  }
                />
                <Legend />
                <Pie
                  data={outputsByDepartmentData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={2}
                  label={({ value, index }) =>
                    outputsTopIndices.includes(index)
                      ? formatCountAndPercent(value, totalOutputsByDepartment)
                      : ""
                  }
                >
                  {outputsByDepartmentData.map((entry, index) => (
                    <Cell
                      key={`outputs-dept-${entry.name}`}
                      fill={PALETTE[index % PALETTE.length]}
                    />
                  ))}
                </Pie>
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={14}
                  fill="#0f172a"
                >
                  {formatCount(totalOutputsByDepartment)}
                </text>
              </PieChart>
            )}
          </ChartFrame>
          <p className="sr-only">
            {`Outputs by department across ${outputsByDepartmentData.length} department${
              outputsByDepartmentData.length === 1 ? "" : "s"
            }.`}
          </p>
          {outputsByDepartmentData.length > MAX_PIE_CATEGORIES ? (
            <p className="mt-3 text-xs text-slate-500">
              Large category set shown as a bar chart for readability.
            </p>
          ) : null}
        </div>
      )}
    </DashboardPanel>
  );
}

export function OutputsOverTimeSection({
  loading,
  outputsTrendData,
  trendView,
  onTrendChange,
  totalOutputsTrend,
}) {
  return (
    <DashboardPanel
      title={`Research Outputs Over Time${loading ? " (Loading...)" : ""}`}
      cardClassName={PANEL_CARD_CLASS}
      headerClassName={PANEL_HEADER_CLASS}
      bodyClassName={PANEL_BODY_CLASS}
      action={
        <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1">
          <Button
            type="button"
            variant={trendView === "monthly" ? "outline" : "ghost"}
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => onTrendChange("monthly")}
            aria-pressed={trendView === "monthly"}
          >
            Monthly
          </Button>
          <Button
            type="button"
            variant={trendView === "quarterly" ? "outline" : "ghost"}
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => onTrendChange("quarterly")}
            aria-pressed={trendView === "quarterly"}
          >
            Quarterly
          </Button>
        </div>
      }
    >
      {loading ? (
        <LoadingBlock label="Loading outputs over time..." />
      ) : outputsTrendData.length === 0 ? (
        <p className="text-sm text-slate-600">
          No output trend data available for the current scope.
        </p>
      ) : (
        <div
          role="img"
          aria-label="Line chart showing research outputs over time"
        >
          <ChartFrame height={320}>
            <AreaChart
              data={outputsTrendData}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) =>
                  formatCountAndPercent(value, totalOutputsTrend)
                }
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="outputs"
                name="Outputs"
                stroke="#0f4c81"
                strokeWidth={2}
                fill="#cfe3f6"
                fillOpacity={0.6}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ChartFrame>
          <p className="sr-only">
            {`Outputs trend over ${outputsTrendData.length} time period${
              outputsTrendData.length === 1 ? "" : "s"
            }.`}
          </p>
        </div>
      )}
    </DashboardPanel>
  );
}

export function AwardsByCategorySection({
  loading,
  awardsByCategoryData,
  totalAwardsByCategory,
}) {
  const awardsByCategoryIsBar =
    awardsByCategoryData.length > MAX_PIE_CATEGORIES;
  const awardsTopIndices = getTopIndices(awardsByCategoryData, 4);

  return (
    <DashboardPanel
      title={`Awards by Category${loading ? " (Loading...)" : ""}`}
      cardClassName={PANEL_CARD_CLASS}
      headerClassName={PANEL_HEADER_CLASS}
      bodyClassName={PANEL_BODY_CLASS}
    >
      <p className="mb-3 text-xs text-slate-600">
        Awards distribution across recognition categories.
      </p>
      {loading ? (
        <LoadingBlock label="Loading awards by category..." />
      ) : awardsByCategoryData.length === 0 ? (
        <p className="text-sm text-slate-600">
          No awards found for the current scope.
        </p>
      ) : (
        <div role="img" aria-label="Pie chart showing awards by category">
          <ChartFrame height={320}>
            {awardsByCategoryIsBar ? (
              <BarChart
                data={awardsByCategoryData}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) =>
                    formatCountAndPercent(value, totalAwardsByCategory)
                  }
                />
                <Legend />
                <Bar
                  dataKey="value"
                  name="Awards"
                  fill="#e56b6f"
                  radius={[0, 10, 10, 0]}
                >
                  <LabelList
                    dataKey="value"
                    content={({ x, y, width, height, value, index }) => {
                      if (index >= MAX_BAR_LABELS) return null;
                      return (
                        <text
                          x={x + width + 8}
                          y={y + height / 2}
                          dy={4}
                          fill="#0f172a"
                          fontSize={11}
                        >
                          {formatCountAndPercent(value, totalAwardsByCategory)}
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            ) : (
              <PieChart>
                <Tooltip
                  formatter={(value) =>
                    formatCountAndPercent(value, totalAwardsByCategory)
                  }
                />
                <Legend />
                <Pie
                  data={awardsByCategoryData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={2}
                  label={({ value, index }) =>
                    awardsTopIndices.includes(index)
                      ? formatCountAndPercent(value, totalAwardsByCategory)
                      : ""
                  }
                >
                  {awardsByCategoryData.map((entry, index) => (
                    <Cell
                      key={`awards-cat-${entry.name}`}
                      fill={PALETTE[index % PALETTE.length]}
                    />
                  ))}
                </Pie>
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={14}
                  fill="#0f172a"
                >
                  {formatCount(totalAwardsByCategory)}
                </text>
              </PieChart>
            )}
          </ChartFrame>
          <p className="sr-only">
            {`Awards by category across ${awardsByCategoryData.length} categor${
              awardsByCategoryData.length === 1 ? "y" : "ies"
            }.`}
          </p>
          {awardsByCategoryData.length > MAX_PIE_CATEGORIES ? (
            <p className="mt-3 text-xs text-slate-500">
              Large category set shown as a bar chart for readability.
            </p>
          ) : null}
        </div>
      )}
    </DashboardPanel>
  );
}

export function RecentActivitySection({
  loading,
  recentProjects,
  recentOutputs,
  recentAwards,
}) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200/70 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
            Recent Activity / Highlights
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Latest updates across projects, outputs, and awards within your
            current scope.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DashboardPanel
          title={`Recently Updated Projects${loading ? " (Loading...)" : ""}`}
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
          action={
            <Link
              to="/projects"
              className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700 hover:underline"
            >
              View all
            </Link>
          }
        >
          {loading ? (
            <LoadingListBlock label="Loading recent projects..." rows={3} />
          ) : recentProjects.length === 0 ? (
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
                  >
                    {projectId ? (
                      <ActivityItem
                        colorClass="bg-sky-500/70"
                        title={
                          <Link
                            to={`/projects/${encodeURIComponent(projectId)}`}
                            className="font-medium text-slate-900 hover:underline"
                          >
                            {safeString(project?.title) || "Untitled project"}
                          </Link>
                        }
                        meta={`${centerName}${
                          updatedLabel
                            ? ` - ${formatDateLabel(updatedLabel)}`
                            : ""
                        }`}
                      />
                    ) : (
                      <ActivityItem
                        colorClass="bg-sky-500/70"
                        title={safeString(project?.title) || "Untitled project"}
                        meta={`${centerName}${
                          updatedLabel
                            ? ` - ${formatDateLabel(updatedLabel)}`
                            : ""
                        }`}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </DashboardPanel>

        <DashboardPanel
          title={`Latest Research Outputs${loading ? " (Loading...)" : ""}`}
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
          action={
            <Link
              to="/outputs"
              className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700 hover:underline"
            >
              View all
            </Link>
          }
        >
          {loading ? (
            <LoadingListBlock label="Loading recent outputs..." rows={3} />
          ) : recentOutputs.mode === "submitted" &&
            Array.isArray(recentOutputs.rows) &&
            recentOutputs.rows.length ? (
            <ul className="space-y-2 text-sm text-slate-700">
              {recentOutputs.rows.map((row) => (
                <li
                  key={`recent-output-${safeString(row?.id) || safeString(row?.file_name)}`}
                >
                  <ActivityItem
                    colorClass="bg-emerald-500/70"
                    title={
                      safeString(row?.file_name) ||
                      safeString(row?.output_type) ||
                      "Research output"
                    }
                    meta={`${safeString(row?.output_type) || "Output"}${
                      safeString(row?.created_at || row?.updated_at)
                        ? ` - ${formatDateLabel(
                            row?.created_at || row?.updated_at,
                          )}`
                        : ""
                    }`}
                  />
                </li>
              ))}
            </ul>
          ) : recentOutputs.mode === "expected" &&
            Array.isArray(recentOutputs.rows) &&
            recentOutputs.rows.length ? (
            <ul className="space-y-2 text-sm text-slate-700">
              {recentOutputs.rows.map((row) => (
                <li key={`recent-expected-${row.projectId}`}>
                  {row.projectId ? (
                    <ActivityItem
                      colorClass="bg-amber-500/70"
                      title={
                        <Link
                          to={`/projects/${encodeURIComponent(row.projectId)}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {safeString(row?.projectTitle) ||
                            "Project outputs updated"}
                        </Link>
                      }
                      meta={`${row.labels?.length ? row.labels.join(" - ") : "Expected outputs"}${
                        row.timestamp
                          ? ` - ${formatDateLabel(row.timestamp)}`
                          : ""
                      }`}
                    />
                  ) : (
                    <ActivityItem
                      colorClass="bg-amber-500/70"
                      title="Project outputs updated"
                      meta={`${row.labels?.length ? row.labels.join(" - ") : "Expected outputs"}${
                        row.timestamp
                          ? ` - ${formatDateLabel(row.timestamp)}`
                          : ""
                      }`}
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">No output activity yet.</p>
          )}
        </DashboardPanel>

        <DashboardPanel
          title={`Newly Received Awards${loading ? " (Loading...)" : ""}`}
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
          action={
            <Link
              to="/awards"
              className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700 hover:underline"
            >
              View all
            </Link>
          }
        >
          {loading ? (
            <LoadingListBlock label="Loading recent awards..." rows={3} />
          ) : recentAwards.length === 0 ? (
            <p className="text-sm text-slate-600">No awards recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-700">
              {recentAwards.map((award) => (
                <li
                  key={`recent-award-${safeString(award?.id) || safeString(award?.ckan_dataset_id) || safeString(award?.award_recognition)}`}
                >
                  <ActivityItem
                    colorClass="bg-rose-500/70"
                    title={
                      safeString(award?.award_recognition) ||
                      "Award / Recognition"
                    }
                    secondary={
                      safeString(award?.recipients)
                        ? `Recipient: ${safeString(award?.recipients)}`
                        : ""
                    }
                    meta={`${safeString(award?.level) || "Level"} - ${
                      safeString(award?.year_received) ||
                      resolveYearFromRecord(award) ||
                      "Year"
                    }`}
                  />
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>
      </div>
    </>
  );
}
