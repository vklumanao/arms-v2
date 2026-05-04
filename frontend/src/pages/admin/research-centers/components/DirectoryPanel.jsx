import { Building2, Layers3, Search } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import PaginationControls from "@/components/navigation/PaginationControls";
import MetricCard from "./MetricCard";
import { DIRECTORY_SKELETON_COUNT } from "../constants";

export default function DirectoryPanel({
  rows,
  paginatedRows,
  filters,
  onSearchChange,
  quickFilter,
  onQuickFilterChange,
  onResetFilters,
  quickFilterChips,
  selectedCenterId,
  onSelectCenter,
  metrics,
  dataLoading,
  currentPage,
  totalPages,
  onPageChange,
  useWindowedScroll = true,
}) {
  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardHeader className="space-y-4 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 sm:py-5">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold text-slate-900">
            Research Center Directory
          </CardTitle>
          <CardDescription>
            Browse centers, narrow the registry, and keep one workspace pinned
            on the right.
          </CardDescription>
        </div>

        <label className="relative">
          <span className="sr-only">Search research centers</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            className="h-11 rounded-2xl border-slate-300 bg-white pl-9 shadow-sm"
            placeholder="Search name, code, chief, agenda, or id"
            value={filters.search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={Building2}
            label="Centers"
            value={metrics.totalCenters}
            caption="Registered research centers"
          />
          <MetricCard
            icon={Layers3}
            label="Links"
            value={metrics.totalLinks}
            caption="Profiles and projects connected"
            tone="emerald"
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
                "rounded-full border px-3 text-xs shadow-sm",
                quickFilter === chip.key
                  ? "border-slate-400 bg-slate-100 text-slate-900 hover:bg-slate-100"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
              )}
              onClick={() => onQuickFilterChange(chip.key)}
            >
              {chip.label}
              <span className="ml-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {chip.count}
              </span>
            </Button>
          ))}
          {(quickFilter !== "all" || filters.search.trim()) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-full text-xs text-slate-700 hover:bg-slate-100"
              onClick={onResetFilters}
            >
              Reset all filters
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div
          className={cn(
            "p-3",
            useWindowedScroll ? "max-h-[72vh] overflow-y-auto" : "",
          )}
        >
          {dataLoading ? (
            <div className="space-y-3">
              {Array.from({ length: DIRECTORY_SKELETON_COUNT }).map(
                (_, index) => (
                  <div
                    key={`directory-skeleton-${index}`}
                    className="h-28 animate-pulse rounded-[1.4rem] bg-slate-200"
                  />
                ),
              )}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
              No research center records matched the current filters.
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedRows.map((row) => {
                const isSelected =
                  String(selectedCenterId || "") === String(row?.id || "");
                return (
                  <button
                    key={`${row.tag}-${row.id}`}
                    type="button"
                    className={cn(
                      "w-full overflow-hidden rounded-[1.45rem] border p-4 text-left transition-all duration-200",
                      isSelected
                        ? "border-slate-400 bg-slate-50 shadow-sm"
                        : "border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm",
                    )}
                    onClick={() => onSelectCenter(row.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {row.code || "No Code"}
                        </p>
                        <h3 className="mt-1 truncate text-base font-bold text-[#0F172A]">
                          {row.name}
                        </h3>
                        <p className="mt-1 truncate text-sm text-slate-600">
                          Chief: {row.centerChiefName || "-"}
                        </p>
                      </div>
                      {isSelected ? (
                        <Badge className="border-slate-300 bg-white text-slate-700 hover:bg-white">
                          Pinned
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>

      <PaginationControls
        page={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        className="rounded-none border-0 border-t border-[var(--border)]"
      />
    </Card>
  );
}
