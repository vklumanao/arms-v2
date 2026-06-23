import { Building2, Link2, Search, Users } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import PaginationControls from "@/components/navigation/PaginationControls";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function DepartmentDirectoryPanel({
  rows,
  paginatedRows,
  filters,
  onSearchChange,
  quickFilter,
  onQuickFilterChange,
  onResetFilters,
  quickFilterChips,
  selectedDepartmentId,
  onSelectDepartment,
  metrics,
  dataLoading,
  currentPage,
  totalPages,
  onPageChange,
  useWindowedScroll = true,
  embedded = false,
}) {
  const shellClassName = embedded
    ? "overflow-hidden"
    : "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm";

  const content = (
    <>
      <div className="space-y-4 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 sm:py-5">
        <label className="relative block">
          <span className="sr-only">Search departments</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-10 rounded-md border-slate-300 bg-white pl-9 text-sm shadow-none"
            placeholder="Search name, code, chairperson, or id"
            value={filters.search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Departments"
            value={metrics.totalDepartments}
            caption="Registered academic units"
            icon={Building2}
          />
          <MetricCard
            label="Links"
            value={metrics.totalLinks}
            caption="Affiliates and projects connected"
            icon={Link2}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {quickFilterChips.map((chip) => (
            <Button
              key={chip.key}
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "h-8 rounded-md border px-3 text-xs font-medium shadow-none",
                quickFilter === chip.key
                  ? "border-slate-300 bg-slate-900 text-white hover:bg-slate-900"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
              )}
              onClick={() => onQuickFilterChange(chip.key)}
            >
              {chip.label}
              <span
                className={cn(
                  "ml-2 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold",
                  quickFilter === chip.key
                    ? "bg-white/15 text-white"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                {chip.count}
              </span>
            </Button>
          ))}
          {(quickFilter !== "all" || filters.search.trim()) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 rounded-md px-2 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              onClick={onResetFilters}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      <div className="p-3">
        <div
          className={cn(
            "space-y-2",
            useWindowedScroll ? "max-h-[72vh] overflow-y-auto pr-1" : "",
          )}
        >
          {dataLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`department-directory-skeleton-${index}`}
                  className="h-24 animate-pulse rounded-lg bg-slate-200"
                />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
              No department records matched the current filters.
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedRows.map((row) => {
                const selected =
                  String(selectedDepartmentId || "") === String(row?.id || "");

                return (
                  <button
                    key={row.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectDepartment(row.id)}
                    className={cn(
                      "group w-full rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                      selected
                        ? "border-emerald-300 bg-emerald-50/50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-[11px] font-medium uppercase tracking-[0.12em] transition-colors",
                            selected ? "text-emerald-700" : "text-slate-500",
                          )}
                        >
                          {row.code || "No Code"}
                        </p>
                        <h3
                          className={cn(
                            "mt-1 truncate text-sm font-semibold transition-colors",
                            selected
                              ? "text-slate-950"
                              : "text-slate-900 group-hover:text-slate-950",
                          )}
                        >
                          {row.name}
                        </h3>
                        <p
                          className={cn(
                            "mt-2 truncate text-xs transition-colors",
                            selected
                              ? "text-emerald-800/90"
                              : "text-slate-600",
                          )}
                        >
                          Chairperson: {row.chairpersonName || "-"}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
                          selected ? "bg-emerald-500" : "bg-slate-300",
                        )}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <PaginationControls
        page={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        className="rounded-none border-0 border-t border-[var(--border)]"
      />
    </>
  );

  if (embedded) {
    return <div className={shellClassName}>{content}</div>;
  }

  return (
    <Card className={shellClassName}>
      <CardContent className="p-0">{content}</CardContent>
    </Card>
  );
}

function MetricCard({ label, value, caption, icon: Icon }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{caption}</p>
    </div>
  );
}
