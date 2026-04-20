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
  Banknote,
  BookOpen,
  Building2,
  FileText,
  FolderKanban,
  Link2,
  Lock,
  Unlock,
  Users,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  Filler,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  ALL_VALUE,
  MAX_BAR_LABELS,
  MAX_PIE_CATEGORIES,
  TOP_CENTER_ROWS,
  formatCount,
  formatCountAndPercent,
  formatCurrencyPHP,
  formatDateLabel,
  formatPercentage,
  resolveYearFromRecord,
  safeString,
  toNumber,
} from "./dashboardUtils";
import { Input } from "@/components/ui/input";
import { normalizeStatus } from "@/utils/status";

const CHART_COLORS = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
];

const STATUS_COLOR_MAP = {
  Completed: CHART_COLORS[2],
  Ongoing: CHART_COLORS[0],
  Proposal: CHART_COLORS[1],
  Rejected: CHART_COLORS[3],
};

const tintColor = (hex, amount) => {
  const normalized = String(hex || "").replace("#", "");
  if (normalized.length !== 6) return hex;
  const num = Number.parseInt(normalized, 16);
  if (Number.isNaN(num)) return hex;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const mix = (channel) =>
    Math.round(channel + (255 - channel) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${mix(r)}${mix(g)}${mix(b)}`;
};

const getChartColor = (index) => {
  const base = CHART_COLORS[index % CHART_COLORS.length];
  const cycle = Math.floor(index / CHART_COLORS.length);
  if (!cycle) return base;
  const tintAmount = Math.min(0.6, cycle * 0.15);
  return tintColor(base, tintAmount);
};

const getChartColors = (count) =>
  Array.from({ length: count }, (_, index) => getChartColor(index));

const PANEL_CARD_CLASS =
  "min-h-[320px] md:min-h-[420px] min-w-0 flex flex-col border-zinc-200/70 bg-white/90 shadow-[0_18px_40px_-32px_rgba(15,76,129,0.65)]";
const PANEL_HEADER_CLASS =
  "bg-gradient-to-r from-zinc-50 via-white to-zinc-100 px-4 sm:px-5 py-3 sm:py-4";
const PANEL_BODY_CLASS = "p-4 sm:p-6 flex-1";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  ChartTooltip,
  ChartLegend,
  Filler,
);

function SummaryCard({ label, value, hint, Icon = null }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/90 p-4 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-zinc-300/70 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600 break-words">
          {label}
        </p>
        {Icon ? (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200/70 bg-white text-zinc-700 shadow-sm transition group-hover:border-zinc-300/80">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-3xl font-semibold leading-none text-zinc-900">
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-zinc-600">{hint}</p> : null}
    </div>
  );
}

function SummaryCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/90 p-4 shadow-sm">
      <div className="h-3 w-24 rounded-full bg-zinc-200/70" />
      <div className="mt-3 h-8 w-20 rounded-full bg-zinc-200/70" />
      <div className="mt-3 h-3 w-32 rounded-full bg-zinc-200/60" />
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
      <div className={`h-4 ${headerWidthClass} rounded-full bg-zinc-200/70`} />
      <div
        className={`h-3 ${subHeaderWidthClass} rounded-full bg-zinc-200/70`}
      />
      <div
        className={`${chartHeightClass} w-full rounded-2xl bg-zinc-200/50`}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function LoadingListBlock({ label = "Loading recent activity...", rows = 3 }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <div className="h-4 w-32 rounded-full bg-zinc-200/70" />
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`loading-row-${index}`}
          className="h-12 w-full rounded-xl bg-zinc-200/60"
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
      className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500"
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
    <div className="rounded-xl border border-zinc-200/70 bg-white/80 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-2 w-2 rounded-full ${colorClass}`} />
        <div className="min-w-0">
          <p className="font-medium text-zinc-900 break-words">{title}</p>
          {secondary ? (
            <p className="mt-1 text-xs text-zinc-600 break-words">
              {secondary}
            </p>
          ) : null}
          {meta ? (
            <p className="mt-1 text-xs text-zinc-500 break-words">{meta}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DashboardSection({
  eyebrow,
  title,
  description,
  action,
  children,
  tone = "neutral",
  framed = true,
}) {
  const toneClass =
    tone === "contrast"
      ? "bg-gradient-to-br from-zinc-50 via-white to-zinc-100"
      : "bg-white/80";
  if (!framed) {
    return (
      <section className="space-y-4 min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {eyebrow}
              </p>
            ) : null}
            <h2 className="mt-1 text-xl font-semibold text-zinc-900">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 max-w-3xl text-sm text-zinc-600">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
        <div className="space-y-4">{children}</div>
      </section>
    );
  }
  return (
    <section className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 text-xl font-semibold text-zinc-900">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm text-zinc-600">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div
        className={`rounded-3xl border border-zinc-200/70 ${toneClass} p-4 sm:p-5 shadow-sm`}
      >
        {children}
      </div>
    </section>
  );
}

export function DashboardHeader({
  isAdmin,
  title,
  description,
  greetingName,
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
  onApplyPreset,
  presetFlags,
}) {
  const resolvedTitle =
    !isAdmin && greetingName ? `Good to see you, ${greetingName}` : title;

  return (
    <div className="rounded-3xl border border-zinc-200/70 bg-gradient-to-br from-zinc-50 via-white to-zinc-100 p-4 sm:p-6 shadow-sm">
      <PageHeader
        title={resolvedTitle}
        actions={
          <div className="flex flex-col items-start gap-1.5 text-xs text-zinc-500 md:items-end">
            <div className="flex flex-wrap items-center gap-3 text-zinc-400">
              <span>
                {lastUpdatedLabel
                  ? `Updated ${lastUpdatedLabel}`
                  : "Updated --"}
              </span>

              {!isAdmin && (
                <span className="font-medium text-zinc-500">My scope</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-zinc-500">
              {activeFilterCount > 0 && (
                <span className="font-medium text-zinc-700">
                  {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
                </span>
              )}

              {filters?.range && (
                <span>
                  {filters.range === "last12"
                    ? "Last 12 months"
                    : filters.range}
                </span>
              )}

              {(filters?.startDate || filters?.endDate) && (
                <span>
                  {`${
                    filters?.startDate
                      ? formatDateLabel(filters.startDate)
                      : "--"
                  } ? ${
                    filters?.endDate ? formatDateLabel(filters.endDate) : "--"
                  }`}
                </span>
              )}
            </div>
          </div>
        }
      />
      <p className="mt-2 max-w-3xl text-sm text-zinc-600">
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
              <span className="rounded-full border border-zinc-200/70 bg-white/80 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                {activeFilterCount} active
              </span>
            ) : null}
          </div>

          <div
            className={`${
              showFilters ? "grid" : "hidden"
            } mt-4 gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-6`}
          >
            <div className="sm:col-span-2 lg:col-span-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Global Filters
                </p>
                {activeFilterCount ? (
                  <span className="rounded-full border border-zinc-200/70 bg-white/80 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    {activeFilterCount} active filter
                    {activeFilterCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 h-px w-full bg-zinc-200/70" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Year
              </p>
              <Select
                value={filters.year || ALL_VALUE}
                onValueChange={(value) =>
                  onUpdateFilters((prev) => ({
                    ...prev,
                    year: value === ALL_VALUE ? "" : value,
                    range: "",
                    startDate: "",
                    endDate: "",
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

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Date from
              </p>
              <Input
                type="date"
                value={filters.startDate || ""}
                onChange={(event) =>
                  onUpdateFilters((prev) => ({
                    ...prev,
                    startDate: event.target.value,
                    year: "",
                    range: "",
                  }))
                }
                className="mt-2 bg-white/80"
              />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Date to
              </p>
              <Input
                type="date"
                value={filters.endDate || ""}
                onChange={(event) =>
                  onUpdateFilters((prev) => ({
                    ...prev,
                    endDate: event.target.value,
                    year: "",
                    range: "",
                  }))
                }
                className="mt-2 bg-white/80"
              />
            </div>

            <div className="flex items-end justify-between sm:col-span-2 lg:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClearFilters}
                disabled={dashboardLoading || activeFilterCount === 0}
              >
                Clear all
              </Button>
              {activeFilterCount ? (
                <span className="hidden text-xs text-zinc-500 lg:inline">
                  Showing filtered results
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Presets
            </span>
            <Button
              type="button"
              variant={presetFlags?.thisYear ? "default" : "outline"}
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => onApplyPreset?.("thisYear")}
              aria-pressed={presetFlags?.thisYear}
            >
              This year
            </Button>
            <Button
              type="button"
              variant={presetFlags?.last12 ? "default" : "outline"}
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => onApplyPreset?.("last12")}
              aria-pressed={presetFlags?.last12}
            >
              Last 12 months
            </Button>
            <Button
              type="button"
              variant={presetFlags?.topCenters ? "default" : "outline"}
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => onApplyPreset?.("topCenters")}
              aria-pressed={presetFlags?.topCenters}
            >
              Top centers
            </Button>
            <Button
              type="button"
              variant={presetFlags?.unassigned ? "default" : "outline"}
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => onApplyPreset?.("unassigned")}
              aria-pressed={presetFlags?.unassigned}
            >
              Unassigned
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function OverviewSection({
  isAdmin,
  summaryCounts,
  filters,
  loading,
  asPanel = true,
}) {
  const content = loading ? (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: isAdmin ? 6 : 4 }).map((_, index) => (
        <SummaryCardSkeleton
          key={`summary-skeleton-${index}`}
          className="rounded-xl border border-zinc-200 bg-white"
        />
      ))}
    </div>
  ) : (
    <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
      {isAdmin ? (
        <>
          <SummaryCard
            label="Research Centers"
            value={formatCount(summaryCounts.centers)}
            hint="All centers"
            Icon={Building2}
            className="rounded-xl border border-zinc-200 bg-white"
          />
          <SummaryCard
            label="Departments"
            value={formatCount(summaryCounts.departments)}
            hint="All departments"
            Icon={BookOpen}
            className="rounded-xl border border-zinc-200 bg-white"
          />
          <SummaryCard
            label="Affiliates"
            value={formatCount(summaryCounts.affiliates)}
            hint="Active faculty + students"
            Icon={Users}
            className="rounded-xl border border-zinc-200 bg-white"
          />
          <SummaryCard
            label="Research Projects"
            value={formatCount(summaryCounts.projects)}
            hint="Filtered projects"
            Icon={FolderKanban}
            className="rounded-xl border border-zinc-200 bg-white"
          />
        </>
      ) : (
        <>
          <SummaryCard
            label="My Projects"
            value={formatCount(summaryCounts.projects)}
            hint="Projects I submitted"
            Icon={FolderKanban}
            className="rounded-xl border border-zinc-200 bg-white"
          />
        </>
      )}

      <SummaryCard
        label={isAdmin ? "Research Outputs" : "My Outputs"}
        value={formatCount(summaryCounts.outputs)}
        hint={
          summaryCounts.outputsSubmitted && summaryCounts.outputsExpected
            ? `Submitted: ${formatCount(summaryCounts.outputsSubmitted)} ? Expected: ${formatCount(
                summaryCounts.outputsExpected,
              )}`
            : summaryCounts.outputsSubmitted
              ? "Submitted outputs"
              : summaryCounts.outputsExpected
                ? "Expected outputs"
                : "No outputs"
        }
        Icon={FileText}
        className="rounded-xl border border-zinc-200 bg-white"
      />

      <SummaryCard
        label={isAdmin ? "Awards & Recognitions" : "My Awards"}
        value={formatCount(summaryCounts.awards)}
        hint={
          summaryCounts.awards
            ? "Awards recorded"
            : safeString(filters.year)
              ? "No awards this year"
              : "No awards"
        }
        Icon={Award}
        className="rounded-xl border border-zinc-200 bg-white"
      />

      {!isAdmin ? (
        <SummaryCard
          label="Team Projects"
          value={formatCount(summaryCounts.linkedProjects)}
          hint="Projects where I'm listed"
          Icon={Users}
          className="rounded-xl border border-zinc-200 bg-white"
        />
      ) : null}
    </div>
  );

  if (!asPanel) return content;

  return (
    <DashboardPanel
      title="Overview"
      cardClassName="border border-zinc-200 bg-white/95 rounded-2xl"
      headerClassName={PANEL_HEADER_CLASS}
      bodyClassName="p-6"
    >
      {content}
    </DashboardPanel>
  );
}

export function TopContributorsSection({
  loading,
  contributors,
  view,
  onViewChange,
}) {
  const active = view === "year" ? contributors?.year : contributors?.month;
  const rows = Array.isArray(active?.rows) ? active.rows : [];
  const label = active?.label || (view === "year" ? "This year" : "This month");

  return (
    <DashboardPanel
      title={`Top Contributors${loading ? " (Loading...)" : ""}`}
      cardClassName={PANEL_CARD_CLASS}
      headerClassName={PANEL_HEADER_CLASS}
      bodyClassName={PANEL_BODY_CLASS}
      action={
        <div className="inline-flex items-center gap-1 rounded-full bg-zinc-100 p-1">
          <Button
            type="button"
            variant={view === "month" ? "outline" : "ghost"}
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => onViewChange?.("month")}
            aria-pressed={view === "month"}
          >
            Month
          </Button>
          <Button
            type="button"
            variant={view === "year" ? "outline" : "ghost"}
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => onViewChange?.("year")}
            aria-pressed={view === "year"}
          >
            Year
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-xs text-zinc-600">
        Top 5 faculty by owned projects ({label}).
      </p>
      {loading ? (
        <LoadingListBlock label="Loading top contributors..." rows={4} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No contributor activity yet for this period.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200/70 bg-white/80 shadow-sm">
          <Table className="min-w-[520px] w-full text-sm">
            <TableHeader>
              <TableRow className="bg-zinc-50/90">
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Contributor
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Projects
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={`contrib-${safeString(row?.key) || safeString(row?.name)}`}
                  className="hover:bg-zinc-100/70"
                >
                  <TableCell className="py-3 font-medium text-zinc-900">
                    {safeString(row?.name) || "Unnamed"}
                  </TableCell>
                  <TableCell className="py-3 text-right tabular-nums text-zinc-700">
                    {formatCount(row?.projects)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </DashboardPanel>
  );
}

export function FundingOverviewSection({ loading, fundingOverview }) {
  const totalAmount = toNumber(fundingOverview?.totalAmount);
  const totalProjects = toNumber(fundingOverview?.totalProjects);
  const internalAmount = toNumber(fundingOverview?.internalAmount);
  const internalProjects = toNumber(fundingOverview?.internalProjects);
  const externalAmount = toNumber(fundingOverview?.externalAmount);
  const externalProjects = toNumber(fundingOverview?.externalProjects);
  const unknownAmount = toNumber(fundingOverview?.unknownAmount);
  const unknownProjects = toNumber(fundingOverview?.unknownProjects);
  const showUnknown = unknownProjects > 0 || unknownAmount > 0;

  return (
    <DashboardPanel
      title={`Funding Overview${loading ? " (Loading...)" : ""}`}
      cardClassName={PANEL_CARD_CLASS}
      headerClassName={PANEL_HEADER_CLASS}
      bodyClassName={PANEL_BODY_CLASS}
    >
      <p className="mb-3 text-xs text-zinc-600">
        Aggregated funding totals across current filters.
      </p>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <SummaryCardSkeleton key={`funding-skeleton-${index}`} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <SummaryCard
            label="Total Funding"
            value={formatCurrencyPHP(totalAmount)}
            hint={`Funded projects: ${formatCount(totalProjects)}`}
            Icon={Banknote}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryCard
              label="Internal Funding"
              value={formatCurrencyPHP(internalAmount)}
              hint={`${formatCount(internalProjects)} projects`}
              Icon={Banknote}
            />
            <SummaryCard
              label="External Funding"
              value={formatCurrencyPHP(externalAmount)}
              hint={`${formatCount(externalProjects)} projects`}
              Icon={Banknote}
            />
          </div>
        </div>
      )}
    </DashboardPanel>
  );
}

export function AwardsByLevelSection({
  loading,
  awardsByLevelData,
  chartTheme = "branded",
}) {
  const useBrandedCharts = chartTheme !== "default";
  const totalAwards = awardsByLevelData.reduce(
    (sum, entry) => sum + toNumber(entry?.value),
    0,
  );
  const levelRows = awardsByLevelData.map((entry) => ({
    label: safeString(entry?.level) || "Other",
    value: toNumber(entry?.value),
  }));

  const awardsByLevelChartData = {
    labels: levelRows.map((row) => row.label),
    datasets: [
      {
        label: "Awards",
        data: levelRows.map((row) => row.value),
        backgroundColor: useBrandedCharts
          ? getChartColors(levelRows.length)
          : undefined,
      },
    ],
  };
  const awardsByLevelOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `Awards: ${formatCount(context.parsed.y)}`,
        },
      },
    },
  };

  return (
    <DashboardPanel
      title={`Awards by Level${loading ? " (Loading...)" : ""}`}
      cardClassName={PANEL_CARD_CLASS}
      headerClassName={PANEL_HEADER_CLASS}
      bodyClassName={PANEL_BODY_CLASS}
    >
      <p className="mb-3 text-xs text-zinc-600">
        Distribution of awards across recognition levels.
      </p>
      {loading ? (
        <LoadingBlock
          label="Loading awards by level..."
          chartHeightClass="h-40"
        />
      ) : totalAwards === 0 ? (
        <p className="text-sm text-zinc-600">
          No awards recorded for the current scope.
        </p>
      ) : (
        <div role="img" aria-label="Bar chart showing awards by level">
          <ChartFrame height={220}>
            <Bar data={awardsByLevelChartData} options={awardsByLevelOptions} />
          </ChartFrame>
          <p className="sr-only">
            {`Awards by level totals ${formatCount(totalAwards)}.`}
          </p>
        </div>
      )}
    </DashboardPanel>
  );
}

export function OutputVisibilitySection({ loading, visibility }) {
  const publicCount = toNumber(visibility?.public);
  const privateCount = toNumber(visibility?.private);
  const total = toNumber(visibility?.total ?? publicCount + privateCount);

  return (
    <DashboardPanel
      title={`Output Visibility${loading ? " (Loading...)" : ""}`}
      cardClassName={PANEL_CARD_CLASS}
      headerClassName={PANEL_HEADER_CLASS}
      bodyClassName={PANEL_BODY_CLASS}
    >
      <p className="mb-3 text-xs text-zinc-600">
        Public vs private research outputs for compliance tracking.
      </p>
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <SummaryCardSkeleton key={`visibility-skeleton-${index}`} />
          ))}
        </div>
      ) : total === 0 ? (
        <p className="text-sm text-zinc-600">No outputs recorded yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryCard
            label="Public Outputs"
            value={formatCount(publicCount)}
            hint={formatPercentage(publicCount, total)}
            Icon={Unlock}
          />
          <SummaryCard
            label="Private Outputs"
            value={formatCount(privateCount)}
            hint={formatPercentage(privateCount, total)}
            Icon={Lock}
          />
        </div>
      )}
    </DashboardPanel>
  );
}

export function FacultyActivitySection({ loading, activity }) {
  const items = [
    {
      label: "Projects Updated",
      value: formatCount(activity?.projects),
    },
    {
      label: "Outputs Added",
      value: formatCount(activity?.outputs),
    },
    {
      label: "Awards Logged",
      value: formatCount(activity?.awards),
    },
  ];

  return (
    <DashboardPanel
      title="My Activity This Month"
      cardClassName="border-zinc-200/70 bg-white/90 shadow-sm"
      headerClassName={PANEL_HEADER_CLASS}
      bodyClassName="p-6"
    >
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <SummaryCardSkeleton key={`activity-skeleton-${item.label}`} />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={`activity-${item.label}`}
              className="rounded-2xl border border-zinc-200/70 bg-zinc-50/60 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </DashboardPanel>
  );
}

export function FacultyStatusSection({
  loading,
  projects,
  statusCounts,
  ownerId = "",
  title = "My Project Status",
  description = "A quick snapshot of your project pipeline.",
  chartTheme = "branded",
}) {
  const useBrandedCharts = chartTheme !== "default";
  const statusData = useMemo(() => {
    const normalizedBuckets = new Map([
      ["Completed", 0],
      ["Ongoing", 0],
      ["Proposal", 0],
      ["Rejected", 0],
    ]);

    const mapNormalizedStatusToLabel = (normalized) => {
      if (normalized === "completed") return "Completed";
      if (normalized === "ongoing") return "Ongoing";
      if (normalized === "proposal") return "Proposal";
      if (normalized === "rejected") return "Rejected";
      if (normalized === "other") return "Rejected";
      if (normalized === "proposed") return "Proposal";
      return "";
    };

    if (statusCounts != null) {
      if (Array.isArray(statusCounts)) {
        statusCounts.forEach((row) => {
          const key = mapNormalizedStatusToLabel(normalizeStatus(row?.name));
          const value = toNumber(row?.value);
          if (!key) return;
          normalizedBuckets.set(key, value);
        });
      }
      return Array.from(normalizedBuckets.entries()).map(([name, value]) => ({
        name,
        value,
      }));
    }

    const scopedProjects = ownerId
      ? (projects || []).filter(
          (project) => safeString(project?.submitted_by) === ownerId,
        )
      : projects || [];

    scopedProjects.forEach((project) => {
      const normalized = normalizeStatus(project?.status);
      const key = mapNormalizedStatusToLabel(normalized);
      if (!key) return;
      normalizedBuckets.set(key, (normalizedBuckets.get(key) || 0) + 1);
    });

    return [...normalizedBuckets.entries()].map(([name, value]) => ({
      name,
      value,
    }));
  }, [projects, statusCounts, ownerId]);

  const total = statusData.reduce((sum, row) => sum + toNumber(row.value), 0);
  const statusColors = statusData.map(
    (row, index) => STATUS_COLOR_MAP[row.name] || getChartColor(index),
  );

  return (
    <DashboardPanel
      title={title}
      cardClassName={PANEL_CARD_CLASS}
      headerClassName={PANEL_HEADER_CLASS}
      bodyClassName={PANEL_BODY_CLASS}
    >
      <p className="mb-3 text-xs text-zinc-600">{description}</p>
      {loading ? (
        <LoadingBlock
          label="Loading project status..."
          chartHeightClass="h-40"
        />
      ) : total === 0 ? (
        <p className="text-sm text-zinc-600">No projects found.</p>
      ) : (
        <div
          role="img"
          aria-label="Bar chart showing project status counts"
          className="w-full min-w-0"
        >
          <ChartFrame className="w-full" height="clamp(220px, 55vw, 350px)">
            <Bar
              data={{
                labels: statusData.map((row) => row.name),
                datasets: [
                  {
                    label: "Projects",
                    data: statusData.map((row) => row.value),
                    backgroundColor: useBrandedCharts
                      ? statusColors
                      : undefined,
                  },
                ],
              }}
              options={{
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { left: 0, right: 4, top: 0, bottom: 0 } },
                scales: {
                  x: {
                    beginAtZero: true,
                    ticks: {
                      precision: 0,
                      font: { size: 10 },
                      callback: (value) => formatCount(Number(value) || 0),
                    },
                  },
                  y: {
                    ticks: {
                      font: { size: 10 },
                    },
                  },
                },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (context) =>
                        `Projects: ${formatCount(context.parsed.x)}`,
                    },
                  },
                },
              }}
            />
          </ChartFrame>
        </div>
      )}
    </DashboardPanel>
  );
}

export function LinkedProjectsSection({ loading, linkedProjects }) {
  const rows = useMemo(() => {
    const items = Array.isArray(linkedProjects) ? linkedProjects : [];
    return items
      .map((project) => {
        const timestamp =
          project?.updated_at || project?.submitted_at || project?.created_at;
        return {
          ...project,
          _ts: timestamp ? new Date(timestamp).getTime() : 0,
        };
      })
      .sort((a, b) => b._ts - a._ts)
      .slice(0, 5);
  }, [linkedProjects]);

  return (
    <DashboardPanel
      title="Team Projects"
      cardClassName={PANEL_CARD_CLASS}
      headerClassName={PANEL_HEADER_CLASS}
      bodyClassName={PANEL_BODY_CLASS}
      action={
        <Link
          to="/projects"
          className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700 hover:underline"
        >
          View all
        </Link>
      }
    >
      <p className="mb-3 text-xs text-zinc-600">
        Projects where you are part of the research team.
      </p>
      {loading ? (
        <LoadingListBlock label="Loading linked projects..." rows={3} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-600">No linked projects yet.</p>
      ) : (
        <ul className="space-y-2 text-sm text-zinc-700">
          {rows.map((project) => {
            const projectId = safeString(
              project?.ckan_dataset_id || project?.id,
            );
            const updatedLabel = safeString(
              project?.updated_at ||
                project?.submitted_at ||
                project?.created_at,
            );
            return (
              <li
                key={`linked-project-${projectId || safeString(project?.title)}`}
                className="rounded-xl border border-zinc-200/70 bg-white/80 px-4 py-3"
              >
                {projectId ? (
                  <Link
                    to={`/projects/${encodeURIComponent(projectId)}`}
                    className="font-medium text-zinc-900 break-words hover:underline"
                  >
                    {safeString(project?.title) || "Untitled project"}
                  </Link>
                ) : (
                  <span className="font-medium text-zinc-900 break-words">
                    {safeString(project?.title) || "Untitled project"}
                  </span>
                )}
                <p className="mt-1 text-xs text-zinc-500">
                  {updatedLabel
                    ? `Updated ${formatDateLabel(updatedLabel)}`
                    : "Updated date unavailable"}
                </p>
              </li>
            );
          })}
        </ul>
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
      <p className="mb-3 text-xs text-zinc-600">
        Top centers by activity across projects and outputs.
      </p>
      {loading ? (
        <LoadingBlock
          label="Loading research center breakdown..."
          chartHeightClass="h-48"
        />
      ) : centerBreakdownRows.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No research center metrics available for the current scope.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <span>
              {showAllCenters
                ? `Showing all ${centerBreakdownRows.length} centers`
                : `Showing ${TOP_CENTER_ROWS} of ${centerBreakdownRows.length} centers`}
            </span>
            <span className="hidden sm:inline">
              Click a column to sort the table.
            </span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-zinc-200/70 bg-white/80 shadow-sm">
            <div className="max-h-[420px] overflow-auto">
              <Table
                aria-label="Research center breakdown table"
                className="min-w-[680px] w-full text-sm"
              >
                <caption className="sr-only">
                  Research center breakdown showing projects, affiliates, and
                  outputs.
                </caption>
                <TableHeader>
                  <TableRow className="bg-zinc-50/90">
                    <TableHead className="sticky top-0 z-10 bg-zinc-50/95 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      <SortableHeader
                        label="Research Center"
                        sortKey="name"
                        sortConfig={sortConfig}
                        onChange={onSortChange}
                      />
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-zinc-50/95 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      <SortableHeader
                        label="Projects"
                        sortKey="projects"
                        sortConfig={sortConfig}
                        onChange={onSortChange}
                      />
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-zinc-50/95 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      <SortableHeader
                        label="Affiliates"
                        sortKey="affiliates"
                        sortConfig={sortConfig}
                        onChange={onSortChange}
                      />
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-zinc-50/95 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      <SortableHeader
                        label="Outputs"
                        sortKey="outputs"
                        sortConfig={sortConfig}
                        onChange={onSortChange}
                      />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedCenterRows.map((row, index) => (
                    <TableRow
                      key={`center-breakdown-${row.id}`}
                      className={`transition ${
                        index % 2 === 0 ? "bg-white" : "bg-zinc-50/40"
                      } hover:bg-zinc-100/70`}
                    >
                      <TableCell className="py-3 font-medium text-zinc-900">
                        {isAdmin && row.id && row.id !== "__unassigned__" ? (
                          <Link
                            to={`/admin/research-center/${encodeURIComponent(
                              String(row.id),
                            )}`}
                            className="decoration-zinc-300 underline-offset-4 hover:underline"
                          >
                            {row.name}
                          </Link>
                        ) : (
                          row.name
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums text-zinc-700">
                        {formatCount(row.projects)}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums text-zinc-700">
                        {row.affiliates === null
                          ? "-"
                          : formatCount(row.affiliates)}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums text-zinc-700">
                        {formatCount(row.outputs)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
      {centerBreakdownRows.length > TOP_CENTER_ROWS ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">
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
  chartTheme = "branded",
}) {
  const useBrandedCharts = chartTheme !== "default";
  const projectsBarIsHorizontal = projectsPerCenterData.length > 12;
  const totalProjects =
    Number.isFinite(totalProjectsPerCenter) && totalProjectsPerCenter > 0
      ? totalProjectsPerCenter
      : projectsPerCenterData.reduce(
          (sum, row) => sum + toNumber(row.count),
          0,
        );
  const projectsPerCenterChartData = {
    labels: projectsPerCenterData.map((row) => row.center),
    datasets: [
      {
        label: "Projects",
        data: projectsPerCenterData.map((row) => toNumber(row.count)),
        backgroundColor: useBrandedCharts
          ? getChartColors(projectsPerCenterData.length)
          : undefined,
      },
    ],
  };
  const projectsPerCenterOptions = {
    indexAxis: projectsBarIsHorizontal ? "y" : "x",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) =>
            `Projects: ${formatCountAndPercent(
              projectsBarIsHorizontal ? context.parsed.x : context.parsed.y,
              totalProjects,
            )}`,
        },
      },
    },
  };

  return (
    <DashboardPanel
      title={`Projects per Research Center${loading ? " (Loading...)" : ""}`}
      cardClassName={PANEL_CARD_CLASS}
      headerClassName={PANEL_HEADER_CLASS}
      bodyClassName={PANEL_BODY_CLASS}
    >
      <p className="mb-3 text-xs text-zinc-600">
        Distribution of projects by research center.
      </p>
      {loading ? (
        <LoadingBlock label="Loading projects per research center..." />
      ) : projectsPerCenterData.length === 0 ? (
        <p className="text-sm text-zinc-600">No projects found.</p>
      ) : (
        <div
          role="img"
          aria-label="Bar chart showing projects per research center"
        >
          <ChartFrame height={420}>
            <Bar
              data={projectsPerCenterChartData}
              options={projectsPerCenterOptions}
            />
          </ChartFrame>
          <p className="sr-only">
            {`Projects per research center across ${projectsPerCenterData.length} center${
              projectsPerCenterData.length === 1 ? "" : "s"
            }.`}
          </p>
          {projectsPerCenterData.length > MAX_BAR_LABELS ? (
            <p className="mt-3 text-xs text-zinc-500">
              Showing labels for top {MAX_BAR_LABELS}. Hover for full details.
            </p>
          ) : null}
        </div>
      )}
    </DashboardPanel>
  );
}

export function OutputsByTypeSection({
  loading,
  outputsByTypeData,
  totalOutputsByType,
  chartTheme = "branded",
}) {
  const useBrandedCharts = chartTheme !== "default";
  const totalOutputs =
    Number.isFinite(totalOutputsByType) && totalOutputsByType > 0
      ? totalOutputsByType
      : outputsByTypeData.reduce((sum, row) => sum + toNumber(row.value), 0);
  const outputsByTypePieData = {
    labels: outputsByTypeData.map((row) => row.name),
    datasets: [
      {
        data: outputsByTypeData.map((row) => toNumber(row.value)),
        backgroundColor: useBrandedCharts
          ? getChartColors(outputsByTypeData.length)
          : undefined,
      },
    ],
  };
  const outputsByTypePieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: (context) =>
            `${context.label}: ${formatCountAndPercent(
              context.parsed,
              totalOutputs,
            )}`,
        },
      },
    },
  };

  return (
    <DashboardPanel
      title={`Research Outputs by Type${loading ? " (Loading...)" : ""}`}
      cardClassName={PANEL_CARD_CLASS}
      headerClassName={PANEL_HEADER_CLASS}
      bodyClassName={PANEL_BODY_CLASS}
    >
      <p className="mb-3 text-xs text-zinc-600">
        Output distribution across publication and innovation categories.
      </p>
      {loading ? (
        <LoadingBlock label="Loading outputs by type..." />
      ) : outputsByTypeData.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No research outputs available for the current scope.
        </p>
      ) : (
        <div role="img" aria-label="Pie chart showing research outputs by type">
          <ChartFrame height={320}>
            <Doughnut
              data={outputsByTypePieData}
              options={outputsByTypePieOptions}
            />
          </ChartFrame>
          <p className="sr-only">
            {`Outputs by type across ${outputsByTypeData.length} category${
              outputsByTypeData.length === 1 ? "" : "ies"
            }.`}
          </p>
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
  rangeView,
  onRangeChange,
  isAdmin,
  totalOutputsTrend,
  chartTheme = "branded",
}) {
  const useBrandedCharts = chartTheme !== "default";
  const totalOutputs =
    Number.isFinite(totalOutputsTrend) && totalOutputsTrend > 0
      ? totalOutputsTrend
      : outputsTrendData.reduce((sum, row) => sum + toNumber(row.outputs), 0);
  const outputsOverTimeChartData = {
    labels: outputsTrendData.map((row) => row.month),
    datasets: [
      {
        label: "Outputs",
        data: outputsTrendData.map((row) => toNumber(row.outputs)),
        borderColor: useBrandedCharts ? CHART_COLORS[0] : undefined,
        backgroundColor: useBrandedCharts ? CHART_COLORS[0] : undefined,
      },
    ],
  };
  const outputsOverTimeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) =>
            `Outputs: ${formatCountAndPercent(context.parsed.y, totalOutputs)}`,
        },
      },
    },
  };
  return (
    <DashboardPanel
      title={`Research Outputs Over Time${loading ? " (Loading...)" : ""}`}
      cardClassName={PANEL_CARD_CLASS}
      headerClassName={PANEL_HEADER_CLASS}
      bodyClassName={PANEL_BODY_CLASS}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {!isAdmin ? (
            <div className="inline-flex items-center gap-1 rounded-full bg-zinc-100 p-1">
              <Button
                type="button"
                variant={rangeView === "last6" ? "outline" : "ghost"}
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => onRangeChange?.("last6")}
                aria-pressed={rangeView === "last6"}
              >
                Last 6 months
              </Button>
              <Button
                type="button"
                variant={rangeView === "last12" ? "outline" : "ghost"}
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => onRangeChange?.("last12")}
                aria-pressed={rangeView === "last12"}
              >
                Last 12 months
              </Button>
            </div>
          ) : null}
          <div className="inline-flex items-center gap-1 rounded-full bg-zinc-100 p-1">
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
        </div>
      }
    >
      {loading ? (
        <LoadingBlock label="Loading outputs over time..." />
      ) : outputsTrendData.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No output trend data available for the current scope.
        </p>
      ) : (
        <div
          role="img"
          aria-label="Line chart showing research outputs over time"
        >
          <ChartFrame height={320}>
            <Line
              data={outputsOverTimeChartData}
              options={outputsOverTimeOptions}
            />
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

export function RecentActivitySection({
  loading,
  recentProjects,
  recentOutputs,
  recentAwards,
  showHeader = true,
}) {
  return (
    <>
      {showHeader ? (
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200/70 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">
              Recent Activity / Highlights
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Latest updates across projects, outputs, and awards within your
              current scope.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DashboardPanel
          title={`Recently Updated Projects${loading ? " (Loading...)" : ""}`}
          cardClassName={PANEL_CARD_CLASS}
          headerClassName={PANEL_HEADER_CLASS}
          bodyClassName={PANEL_BODY_CLASS}
          action={
            <Link
              to="/projects"
              className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700 hover:underline"
            >
              View all
            </Link>
          }
        >
          {loading ? (
            <LoadingListBlock label="Loading recent projects..." rows={3} />
          ) : recentProjects.length === 0 ? (
            <p className="text-sm text-zinc-600">No project activity yet.</p>
          ) : (
            <ul className="space-y-2 text-sm text-zinc-700">
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
                        colorClass="bg-zinc-500/70"
                        title={
                          <Link
                            to={`/projects/${encodeURIComponent(projectId)}`}
                            className="font-medium text-zinc-900 hover:underline"
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
                        colorClass="bg-zinc-500/70"
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
              className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700 hover:underline"
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
            <ul className="space-y-2 text-sm text-zinc-700">
              {recentOutputs.rows.map((row) => (
                <li
                  key={`recent-output-${safeString(row?.id) || safeString(row?.file_name)}`}
                >
                  <ActivityItem
                    colorClass="bg-zinc-500/70"
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
            <ul className="space-y-2 text-sm text-zinc-700">
              {recentOutputs.rows.map((row) => (
                <li key={`recent-expected-${row.projectId}`}>
                  {row.projectId ? (
                    <ActivityItem
                      colorClass="bg-zinc-500/70"
                      title={
                        <Link
                          to={`/projects/${encodeURIComponent(row.projectId)}`}
                          className="font-medium text-zinc-900 hover:underline"
                        >
                          {safeString(row?.projectTitle) ||
                            "Project outputs updated"}
                        </Link>
                      }
                      meta={`${
                        row.labels?.length
                          ? row.labels.join(" - ")
                          : "Expected outputs"
                      }${
                        row.timestamp
                          ? ` - ${formatDateLabel(row.timestamp)}`
                          : ""
                      }`}
                    />
                  ) : (
                    <ActivityItem
                      colorClass="bg-zinc-500/70"
                      title="Project outputs updated"
                      meta={`${
                        row.labels?.length
                          ? row.labels.join(" - ")
                          : "Expected outputs"
                      }${
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
            <p className="text-sm text-zinc-600">No output activity yet.</p>
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
              className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700 hover:underline"
            >
              View all
            </Link>
          }
        >
          {loading ? (
            <LoadingListBlock label="Loading recent awards..." rows={3} />
          ) : recentAwards.length === 0 ? (
            <p className="text-sm text-zinc-600">No awards recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm text-zinc-700">
              {recentAwards.map((award) => (
                <li
                  key={`recent-award-${safeString(award?.id) || safeString(award?.ckan_dataset_id) || safeString(award?.award_recognition)}`}
                >
                  <ActivityItem
                    colorClass="bg-zinc-500/70"
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
