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
}) {
  return (
    <Card className="overflow-hidden border-blue-200/80 bg-white/95 shadow-[0_24px_64px_rgba(30,58,138,0.10)] backdrop-blur">
      <CardHeader className="space-y-4 border-b border-blue-100 bg-[linear-gradient(135deg,rgba(239,246,255,0.94),rgba(255,255,255,0.96),rgba(236,253,245,0.88))] px-5 py-5">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold text-[#1E3A8A]">
            Research Center Directory
          </CardTitle>
          <CardDescription>
            Browse centers, narrow the registry, and keep one workspace pinned
            on the right.
          </CardDescription>
        </div>

        <label className="relative">
          <span className="sr-only">Search research centers</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1E3A8A]" />
          <Input
            className="h-11 rounded-2xl border-blue-200 bg-white pl-9 shadow-sm"
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
                  ? "border-blue-300 bg-blue-100 text-[#1E3A8A] hover:bg-blue-100"
                  : "border-blue-200 bg-white text-[#1E3A8A] hover:bg-blue-50",
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
              className="rounded-full text-xs text-[#1E3A8A] hover:bg-blue-100/80"
              onClick={onResetFilters}
            >
              Reset all filters
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="max-h-[72vh] overflow-y-auto p-3">
          {dataLoading ? (
            <div className="space-y-3">
              {Array.from({ length: DIRECTORY_SKELETON_COUNT }).map(
                (_, index) => (
                  <div
                    key={`directory-skeleton-${index}`}
                    className="h-28 animate-pulse rounded-[1.4rem] bg-blue-100/70"
                  />
                ),
              )}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-blue-200 bg-blue-50/70 p-8 text-center text-sm text-[#1E3A8A]">
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
                        ? "border-[#1E3A8A] bg-[linear-gradient(135deg,rgba(239,246,255,0.98),rgba(255,255,255,0.96),rgba(219,234,254,0.82))] shadow-[0_18px_42px_rgba(30,58,138,0.14)]"
                        : "border-blue-100 bg-white hover:border-blue-200 hover:bg-blue-50/60 hover:shadow-sm",
                    )}
                    onClick={() => onSelectCenter(row.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1E3A8A]">
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
                        <Badge className="border-blue-200 bg-white text-[#1E3A8A] hover:bg-white">
                          Pinned
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-2xl bg-blue-100/75 px-2 py-2 text-center text-[#1E3A8A]">
                        <div className="font-bold">{row.profileCount}</div>
                        <div>Members</div>
                      </div>
                      <div className="rounded-2xl bg-emerald-100/75 px-2 py-2 text-center text-emerald-700">
                        <div className="font-bold">{row.projectCount}</div>
                        <div>Projects</div>
                      </div>
                      <div className="rounded-2xl bg-amber-100/80 px-2 py-2 text-center text-amber-700">
                        <div className="font-bold">{row.agendaCount}</div>
                        <div>Agendas</div>
                      </div>
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
