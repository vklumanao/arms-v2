import { useMemo, useState } from "react";
import { useReferenceData } from "@/hooks/useReferenceData";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/utils/cn";

const ALL_VALUE = "__all__";

const KPI_DEFINITIONS = [
  {
    sheetCode: "A1",
    title: "Research Output Volume",
    deliverable: "Completed research outputs submitted for recognition.",
    target: 24,
    targetUnit: "count",
    successIndicator: "At least 24 outputs submitted.",
  },
  {
    sheetCode: "B1",
    title: "Publications",
    deliverable: "Peer-reviewed and institutional publications logged.",
    target: 18,
    targetUnit: "count",
    successIndicator: "At least 18 publications logged.",
  },
  {
    sheetCode: "C1",
    title: "Research Engagement",
    deliverable: "Active participation across centers and projects.",
    target: 80,
    targetUnit: "count",
    successIndicator: "80 or more active participants.",
  },
  {
    sheetCode: "D1",
    title: "On-time Completion",
    deliverable: "Projects completed within planned timelines.",
    target: 95,
    targetUnit: "percent",
    successIndicator: "95% or higher on-time completion.",
  },
];

function safeString(value) {
  return String(value || "").trim();
}

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function calculateAccomplishment(actual, target, targetUnit = "") {
  const actualValue = Number(actual || 0);
  const targetValue = Number(target || 0);
  if (targetValue <= 0) return 0;
  if (targetUnit === "percent") return actualValue;
  return (actualValue / targetValue) * 100;
}

function getStatusVariant(percent) {
  if (percent >= 100) return "success";
  if (percent >= 50) return "warning";
  return "danger";
}

function formatTarget(target, targetUnit = "") {
  if (targetUnit === "percent") return `${formatCount(target)}%`;
  return formatCount(target);
}

function DashboardHeader({ title, description, children }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          RDISO Balanced Scorecard
        </p>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{title}</h1>
        <p className="max-w-2xl text-sm text-slate-600">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function DashboardSection({ title, description, children }) {
  return (
    <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            {description ? (
              <p className="text-sm text-slate-600">{description}</p>
            ) : null}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function SummaryTile({ label, value, hint, tone = "neutral" }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <Card className={cn("border shadow-sm", toneClass)}>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em]">{label}</p>
        <p className="mt-2 text-2xl font-bold">{value}</p>
        {hint ? <p className="mt-1 text-xs opacity-80">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function ScorecardRow({ item }) {
  return (
    <tr className="border-t border-slate-200">
      <td className="px-3 py-3 text-sm text-slate-700">{item.sheetCode}</td>
      <td className="px-3 py-3 text-sm text-slate-700">{item.deliverable}</td>
      <td className="px-3 py-3 text-sm text-slate-700">{item.targetLabel}</td>
      <td className="px-3 py-3 text-sm text-slate-700">{item.actualLabel}</td>
      <td className="px-3 py-3 text-sm text-slate-700">
        <Badge variant="outline" className={item.badgeClass}>
          {item.percentLabel}
        </Badge>
      </td>
      <td className="px-3 py-3 text-sm text-slate-700">{item.successIndicator || "-"}</td>
    </tr>
  );
}

const demoActualsByCenter = {
  [ALL_VALUE]: {},
};

export default function DashboardPage() {
  const { centers } = useReferenceData();
  const [selectedCenterId, setSelectedCenterId] = useState(ALL_VALUE);

  const centerOptions = useMemo(
    () => [
      { value: ALL_VALUE, label: "All Research Centers" },
      ...(Array.isArray(centers)
        ? centers.map((center) => ({
            value: safeString(center?.id),
            label: safeString(center?.name || center?.title || center?.id),
          }))
        : []),
    ],
    [centers],
  );

  const scorecard = useMemo(() => {
    const actuals = demoActualsByCenter[selectedCenterId] || {};
    return KPI_DEFINITIONS.map((item) => {
      const actual = actuals[item.sheetCode] ?? "";
      const percent = calculateAccomplishment(
        actual,
        item.target,
        item.targetUnit,
      );
      return {
        ...item,
        actual,
        percent,
        targetLabel: formatTarget(item.target, item.targetUnit),
        actualLabel:
          actual === "" || actual === null || actual === undefined
            ? "-"
            : formatCount(actual),
        percentLabel: formatPercent(percent),
        badgeClass:
          getStatusVariant(percent) === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : getStatusVariant(percent) === "warning"
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-rose-200 bg-rose-50 text-rose-700",
      };
    });
  }, [selectedCenterId]);

  const summary = useMemo(() => {
    const total = scorecard.length;
    const achieved = scorecard.filter((item) => item.percent >= 100).length;
    const partial = scorecard.filter(
      (item) => item.percent > 0 && item.percent < 100,
    ).length;
    const behind = scorecard.filter((item) => item.percent <= 0).length;
    return { total, achieved, partial, behind };
  }, [scorecard]);

  return (
    <section className="page-stack-lg">
      <DashboardHeader
        title="Dashboard"
        description="RDISO Balanced Scorecard for monitoring center KPI accomplishments, deliverables, and indicators."
      >
        <div className="grid gap-2 sm:min-w-[280px]">
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Research Center</span>
            <Select value={selectedCenterId} onValueChange={setSelectedCenterId}>
              <SelectTrigger className="border-slate-300 bg-white text-slate-700">
                <SelectValue placeholder="Select center" />
              </SelectTrigger>
              <SelectContent className="border border-slate-200 bg-white text-slate-700">
                {centerOptions.map((center) => (
                  <SelectItem key={center.value} value={center.value}>
                    {center.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      </DashboardHeader>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          label="Total Indicators"
          value={summary.total}
          hint="All scorecard rows"
        />
        <SummaryTile
          label="Achieved"
          value={summary.achieved}
          hint="At or above target"
          tone="success"
        />
        <SummaryTile
          label="Partially Achieved"
          value={summary.partial}
          hint="Progress but below target"
          tone="warning"
        />
        <SummaryTile
          label="Behind Target"
          value={summary.behind}
          hint="Need follow-up"
          tone="danger"
        />
      </div>

      <DashboardSection
        title="RDISO KPI / Deliverables Scorecard"
        description="Monitor target vs actual accomplishment per research center."
      >
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50 text-slate-600">
              <TableRow>
                <TableHead className="w-[90px]">Sheet Code</TableHead>
                <TableHead>Deliverables</TableHead>
                <TableHead className="w-[120px]">Target</TableHead>
                <TableHead className="w-[140px]">Actual</TableHead>
                <TableHead className="w-[140px]">% Accomplishment</TableHead>
                <TableHead className="w-[220px]">Success Indicator</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scorecard.map((item) => (
                <ScorecardRow key={item.sheetCode} item={item} />
              ))}
            </TableBody>
          </Table>
        </div>
      </DashboardSection>

      <DashboardSection
        title="Notes"
        description="This is the fresh dashboard foundation. Next we can connect actual accomplishments from project outputs, awards, patents, MOA/MOU, and funding records."
      >
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          <p>
            Right now the scorecard is scaffolded with the KPI definitions and
            calculation logic. The next step is mapping actual accomplishments
            from real database sources per Research Center.
          </p>
        </div>
      </DashboardSection>
    </section>
  );
}
