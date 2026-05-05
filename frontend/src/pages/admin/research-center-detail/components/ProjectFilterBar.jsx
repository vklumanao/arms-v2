import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProjectFilterBar({
  agendaFilter,
  setAgendaFilter,
  projectSearch,
  setProjectSearch,
  projectStatus,
  setProjectStatus,
  projectStatusOptions,
  projectYear,
  setProjectYear,
  projectYearOptions,
  activeFilterCount,
  onReset,
}) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Project Filters
        </p>
        {activeFilterCount > 0 ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-[#1E293B]">
            {activeFilterCount} active
          </span>
        ) : null}
      </div>

      {agendaFilter ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 font-semibold text-slate-800">
            Agenda: {agendaFilter}
          </span>
          <button
            className="text-xs font-semibold text-slate-500 hover:text-[#1E293B]"
            onClick={() => setAgendaFilter("")}
          >
            Clear agenda
          </button>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_170px_120px_auto]">
        <Input
          className="h-9 w-full border-slate-300 text-sm focus:border-emerald-500 focus:ring-0"
          placeholder="Search title, status, or lead"
          value={projectSearch}
          onChange={(event) => setProjectSearch(event.target.value)}
        />

        <Select value={projectStatus} onValueChange={setProjectStatus}>
          <SelectTrigger className="h-9 w-full border-slate-300 text-sm focus:border-emerald-500 focus:ring-0">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {projectStatusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {status === "all" ? "All statuses" : status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={projectYear} onValueChange={setProjectYear}>
          <SelectTrigger className="h-9 w-full border-slate-300 text-sm focus:border-emerald-500 focus:ring-0">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {projectYearOptions.map((year) => (
              <SelectItem key={year} value={year}>
                {year === "all" ? "All years" : year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          className="h-9 w-full border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-[#1E293B] sm:w-auto"
          onClick={onReset}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
