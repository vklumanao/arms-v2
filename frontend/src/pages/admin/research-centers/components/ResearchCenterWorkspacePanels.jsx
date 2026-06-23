import {
  DIRECTORY_SKELETON_COUNT,
  MEMBER_PAGE_SIZE,
  PROJECT_PAGE_SIZE,
  SOCIAL_MEDIA_OPTIONS,
} from "../constants";
import { getSocialPlaceholder } from "../helpers";
import PaginationControls from "@/components/navigation/PaginationControls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/utils/cn";
import {
  Building2,
  FolderKanban,
  Layers3,
  Search,
  Trash2,
  Users,
} from "lucide-react";

function MetricCard({ icon: Icon, label, value, caption, tone = "blue" }) {
  const toneClasses = {
    blue: "bg-white border-slate-200 text-slate-700",
    emerald:
      "bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(240,253,244,0.9))] border-emerald-200/90 text-emerald-700",
    amber:
      "bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(255,251,235,0.95))] border-amber-200/90 text-amber-700",
  };

  return (
    <div className={cn("rounded-lg border p-4 shadow-sm", toneClasses[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-slate-600">{caption}</p>
        </div>
        <div className="rounded-md border border-current/10 bg-white/80 p-2">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function WorkspaceOverview({ center, summary, agendaNames }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          icon={Users}
          label="Total Members"
          value={summary.totalMembers}
          caption={`${summary.activeMembers} active right now`}
        />
        <MetricCard
          icon={FolderKanban}
          label="Linked Projects"
          value={summary.linkedProjects}
          caption="Active project pipeline"
          tone="emerald"
        />
        <MetricCard
          icon={Layers3}
          label="Agenda"
          value={summary.totalAgenda}
          caption="Linked research directions"
          tone="amber"
        />
      </div>

      <div className="grid gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="space-y-1 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 sm:py-5">
            <CardTitle className="text-base font-semibold text-slate-900">
              Agenda Highlights
            </CardTitle>
            <CardDescription>
              The leading agenda tags connected to the selected center.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {agendaNames.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {agendaNames.map((agendaName) => (
                  <Badge
                    key={`${center.id}-${agendaName}`}
                    variant="secondary"
                    className="rounded-full bg-slate-50 px-3 py-1 text-slate-700"
                  >
                    {agendaName}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                No agendas linked to this center yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DirectoryPanel({
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
  embedded = false,
}) {
  const shellClassName = embedded
    ? "overflow-hidden"
    : "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm";

  const content = (
    <>
      <div className="space-y-4 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 sm:py-5">
        <label className="relative block">
          <span className="sr-only">Search research centers</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-10 rounded-md border-slate-300 bg-white pl-9 text-sm shadow-none"
            placeholder="Search name, code, chief, agenda, or id"
            value={filters.search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
            <div className="flex items-center gap-2 text-slate-500">
              <Building2 className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                Centers
              </span>
            </div>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {metrics.totalCenters}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Registered research centers
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
            <div className="flex items-center gap-2 text-slate-500">
              <Layers3 className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                Links
              </span>
            </div>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {metrics.totalLinks}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Profiles and projects connected
            </p>
          </div>
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
              {Array.from({ length: DIRECTORY_SKELETON_COUNT }).map(
                (_, index) => (
                  <div
                    key={`directory-skeleton-${index}`}
                    className="h-24 animate-pulse rounded-lg bg-slate-200"
                  />
                ),
              )}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
              No research center records matched the current filters.
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedRows.map((row) => {
                const isSelected =
                  String(selectedCenterId || "") === String(row?.id || "");

                return (
                  <button
                    key={`${row.tag}-${row.id}`}
                    type="button"
                    aria-pressed={isSelected}
                    className={cn(
                      "group w-full rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                      isSelected
                        ? "border-emerald-300 bg-emerald-50/50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                    )}
                    onClick={() => onSelectCenter(row.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-[11px] font-medium uppercase tracking-[0.12em] transition-colors",
                            isSelected ? "text-emerald-700" : "text-slate-500",
                          )}
                        >
                          {row.code || "No Code"}
                        </p>
                        <h3
                          className={cn(
                            "mt-1 truncate text-sm font-semibold transition-colors",
                            isSelected
                              ? "text-slate-950"
                              : "text-slate-900 group-hover:text-slate-950",
                          )}
                        >
                          {row.name}
                        </h3>
                        <p
                          className={cn(
                            "mt-2 truncate text-xs transition-colors",
                            isSelected
                              ? "text-emerald-800/90"
                              : "text-slate-600",
                          )}
                        >
                          Chief: {row.centerChiefName || "-"}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
                          isSelected ? "bg-emerald-500" : "bg-slate-300",
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

function MembersPanel({
  center,
  filters,
  onFiltersChange,
  departmentOptions,
  filteredRows,
  paginatedRows,
  loading,
  error,
  page,
  totalPages,
  onPageChange,
}) {
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="space-y-4 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold text-slate-900">
              Research Center Members
            </CardTitle>
            <CardDescription>
              {filteredRows.length} member(s) matched for {center.name}.
            </CardDescription>
          </div>
          <label className="relative w-full lg:max-w-md">
            <span className="sr-only">Search members</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-10 rounded-md border-slate-300 bg-white pl-9 shadow-none"
              placeholder="Search name or email"
              value={filters.search}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  search: event.target.value,
                })
              }
            />
          </label>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[10rem_minmax(0,14rem)_10rem]">
          <Select
            value={filters.role}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                role: value,
              })
            }
          >
            <SelectTrigger className="h-10 rounded-md border-slate-300 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="faculty">Faculty</SelectItem>
              <SelectItem value="student">Student</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.department}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                department: value,
              })
            }
          >
            <SelectTrigger className="h-10 rounded-md border-slate-300 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departmentOptions.map((department) => (
                <SelectItem key={department} value={department}>
                  {department}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.status}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                status: value,
              })
            }
          >
            <SelectTrigger className="h-10 rounded-md border-slate-300 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-40 rounded-full bg-slate-200" />
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`member-skeleton-${index}`}
                    className="h-10 w-full rounded-lg bg-slate-200"
                  />
                ))}
              </div>
            </div>
          ) : error ? (
            <p className="p-4 text-sm text-slate-700">{error}</p>
          ) : filteredRows.length === 0 ? (
            <p className="p-4 text-sm text-slate-700">
              No members matched the current filters.
            </p>
          ) : (
            <>
              <div className="space-y-3 p-3 md:hidden">
                {paginatedRows.map((member, index) => (
                  <div
                    key={member.id || `${member.email}-${index}`}
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[#0F172A]">
                        {(page - 1) * MEMBER_PAGE_SIZE + index + 1}.{" "}
                        {member.full_name || "Unnamed user"}
                      </p>
                      <Badge
                        variant={
                          member.is_active !== false
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {member.is_active !== false ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-slate-600">
                      <p>Email: {member.email || "-"}</p>
                      <p className="capitalize">Role: {member.role || "-"}</p>
                      <p>Department: {member.department || "-"}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Table className="hidden md:table">
                <TableHeader className="bg-slate-50">
                  <TableRow className="hover:bg-slate-50">
                    <TableHead>No.</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((member, index) => (
                    <TableRow key={member.id || `${member.email}-${index}`}>
                      <TableCell>
                        {(page - 1) * MEMBER_PAGE_SIZE + index + 1}
                      </TableCell>
                      <TableCell>
                        {member.full_name || "Unnamed user"}
                      </TableCell>
                      <TableCell>{member.email || "-"}</TableCell>
                      <TableCell className="capitalize">
                        {member.role || "-"}
                      </TableCell>
                      <TableCell>{member.department || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            member.is_active !== false
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {member.is_active !== false ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      </CardContent>
      <PaginationControls
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        className="rounded-none border-0 border-t border-[var(--border)]"
      />
    </Card>
  );
}

function ProjectsPanel({
  center,
  filters,
  onFiltersChange,
  statusOptions,
  departmentOptions,
  filteredRows,
  paginatedRows,
  loading,
  error,
  page,
  totalPages,
  onPageChange,
}) {
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="space-y-4 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold text-slate-900">
              Linked Projects
            </CardTitle>
            <CardDescription>
              {filteredRows.length} project(s) matched for {center.name}.
            </CardDescription>
          </div>
          <label className="relative w-full lg:max-w-md">
            <span className="sr-only">Search projects</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              className="h-10 rounded-md border-slate-300 bg-white pl-9 shadow-none"
              placeholder="Search title or lead researcher"
              value={filters.search}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  search: event.target.value,
                })
              }
            />
          </label>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[12rem_minmax(0,14rem)]">
          <Select
            value={filters.status}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                status: value,
              })
            }
          >
            <SelectTrigger className="h-10 rounded-md border-slate-300 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.department}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                department: value,
              })
            }
          >
            <SelectTrigger className="h-10 rounded-md border-slate-300 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departmentOptions.map((department) => (
                <SelectItem key={department} value={department}>
                  {department}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-44 rounded-full bg-slate-200" />
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={`project-skeleton-${index}`}
                    className="h-12 w-full rounded-lg bg-slate-200"
                  />
                ))}
              </div>
            </div>
          ) : error ? (
            <p className="p-4 text-sm text-slate-700">{error}</p>
          ) : filteredRows.length === 0 ? (
            <p className="p-4 text-sm text-slate-700">
              No projects matched the current filters.
            </p>
          ) : (
            <>
              <div className="space-y-3 p-3 md:hidden">
                {paginatedRows.map((project, index) => (
                  <div
                    key={
                      project.id || project.name || `${project.title}-${index}`
                    }
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-[#0F172A]">
                      {(page - 1) * PROJECT_PAGE_SIZE + index + 1}.{" "}
                      {project.title || project.name || "-"}
                    </p>
                    <div className="mt-3 space-y-1 text-xs text-slate-600">
                      <p className="capitalize">
                        Status: {project.status || "-"}
                      </p>
                      <p>Department: {project.department_name || "-"}</p>
                      <p>Agenda: {project.agenda_name || "-"}</p>
                      <p>
                        Lead Researcher:{" "}
                        {project.lead_researcher_name ||
                          project.researcher_name ||
                          "-"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Table className="hidden md:table">
                <TableHeader className="bg-slate-50">
                  <TableRow className="hover:bg-slate-50">
                    <TableHead>No.</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Agenda</TableHead>
                    <TableHead>Lead Researcher</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((project, index) => (
                    <TableRow
                      key={
                        project.id ||
                        project.name ||
                        `${project.title}-${index}`
                      }
                    >
                      <TableCell>
                        {(page - 1) * PROJECT_PAGE_SIZE + index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {project.title || project.name || "-"}
                      </TableCell>
                      <TableCell className="capitalize">
                        {project.status || "-"}
                      </TableCell>
                      <TableCell>{project.department_name || "-"}</TableCell>
                      <TableCell>{project.agenda_name || "-"}</TableCell>
                      <TableCell>
                        {project.lead_researcher_name ||
                          project.researcher_name ||
                          "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      </CardContent>
      <PaginationControls
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        className="rounded-none border-0 border-t border-[var(--border)]"
      />
    </Card>
  );
}

function AgendaPanel({ center, agendaNames }) {
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="space-y-1 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 sm:py-5">
        <CardTitle className="text-base font-semibold text-slate-900">
          Linked Agenda
        </CardTitle>
        <CardDescription>
          Review the agenda coverage connected to {center.name}.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {agendaNames.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {agendaNames.map((agendaName) => (
              <div
                key={`${center.id}-${agendaName}`}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
                  Research Agenda
                </p>
                <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                  {agendaName}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-700">
            No agendas linked to this center yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SettingsPanel({
  center,
  editing,
  editErrors,
  editLoading,
  actionLoading,
  isEditFormValid,
  centerChiefUsers,
  onChange,
  onAddAgenda,
  onRemoveAgenda,
  onCancel,
  onSave,
  onDelete,
}) {
  const isReady = editing.id && editing.id === center.id;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="space-y-1 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 sm:py-5">
          <CardTitle className="text-base font-semibold text-slate-900">
            Workspace Settings
          </CardTitle>
          <CardDescription>
            Edit this center inline without leaving the workspace. Changes save
            directly to the registry.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {editLoading || !isReady ? (
            <div className="animate-pulse space-y-4">
              <div className="h-10 rounded-md bg-slate-200" />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-32 rounded-lg bg-slate-200" />
                <div className="h-32 rounded-lg bg-slate-200" />
              </div>
              <div className="h-32 rounded-lg bg-slate-200" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
                    Identity
                  </p>
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Research Center Name *
                      </label>
                      <Input
                        className={cn(
                          "h-10 rounded-md border bg-white",
                          editErrors.name
                            ? "border-[#F97316]"
                            : "border-slate-300",
                        )}
                        value={editing.name}
                        onChange={(event) =>
                          onChange({ name: event.target.value })
                        }
                      />
                      {editErrors.name ? (
                        <p className="text-xs text-slate-800">
                          {editErrors.name}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Code *
                      </label>
                      <Input
                        className={cn(
                          "h-10 rounded-md border bg-white",
                          editErrors.code
                            ? "border-[#F97316]"
                            : "border-slate-300",
                        )}
                        value={editing.code}
                        onChange={(event) =>
                          onChange({
                            code: event.target.value
                              .toUpperCase()
                              .replace(/\s+/g, "_"),
                          })
                        }
                      />
                      {editErrors.code ? (
                        <p className="text-xs text-slate-800">
                          {editErrors.code}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Center Chief *
                      </label>
                      <Select
                        value={editing.centerChiefId}
                        onValueChange={(value) =>
                          onChange({ centerChiefId: value })
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            "h-10 rounded-md border bg-white",
                            editErrors.centerChiefId
                              ? "border-[#F97316]"
                              : "border-slate-300",
                          )}
                        >
                          <SelectValue placeholder="Select Center Chief" />
                        </SelectTrigger>
                        <SelectContent className="border border-slate-300 bg-white">
                          {centerChiefUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {editErrors.centerChiefId ? (
                        <p className="text-xs text-slate-800">
                          {editErrors.centerChiefId}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
                    Public Presence
                  </p>
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Social Media
                      </label>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Select
                          value={editing.socialMediaPlatform}
                          onValueChange={(value) =>
                            onChange({ socialMediaPlatform: value })
                          }
                        >
                          <SelectTrigger className="h-10 rounded-md border border-slate-300 bg-white">
                            <SelectValue placeholder="Select platform" />
                          </SelectTrigger>
                          <SelectContent className="border border-slate-300 bg-white">
                            {SOCIAL_MEDIA_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="sm:col-span-2">
                          <Input
                            className="h-10 rounded-md border border-slate-300 bg-white"
                            value={editing.socialMediaLink}
                            placeholder={getSocialPlaceholder(
                              editing.socialMediaPlatform,
                            )}
                            onChange={(event) =>
                              onChange({ socialMediaLink: event.target.value })
                            }
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">
                        Displayed on the center detail page if provided.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Description
                      </label>
                      <Textarea
                        className="min-h-[180px] rounded-md border border-slate-300 bg-white"
                        value={editing.description}
                        placeholder="Add a positioning statement, mission, or quick summary..."
                        onChange={(event) =>
                          onChange({ description: event.target.value })
                        }
                      />
                      <p className="text-xs text-slate-500">
                        A short summary helps the center feel complete in the
                        admin and public views.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
                  Research Agenda
                </p>
                <div className="mt-4 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      className={cn(
                        "h-10 rounded-md border bg-white",
                        editErrors.researchAgenda
                          ? "border-[#F97316]"
                          : "border-slate-300",
                      )}
                      placeholder="Add research agendum"
                      value={editing.agendaInput}
                      onChange={(event) =>
                        onChange({ agendaInput: event.target.value })
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          onAddAgenda();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-300 text-slate-700 hover:bg-slate-50"
                      onClick={onAddAgenda}
                    >
                      Add Agenda
                    </Button>
                  </div>

                  {editing.researchAgenda.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {editing.researchAgenda.map((agenda) => (
                        <button
                          key={agenda}
                          type="button"
                          className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          onClick={() => onRemoveAgenda(agenda)}
                        >
                          {agenda} ×
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Add at least one agenda to keep the center discoverable
                      across the registry.
                    </p>
                  )}

                  {editErrors.researchAgenda ? (
                    <p className="text-xs text-slate-800">
                      {editErrors.researchAgenda}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Inline changes are ready to save.
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Use Cancel to reload the latest saved values for this
                    center.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="border-slate-300 text-slate-700 hover:bg-slate-50"
                    onClick={onCancel}
                    disabled={actionLoading}
                  >
                    Reset Form
                  </Button>
                  <Button
                    className="bg-[#10B981] text-white hover:bg-[#059669]"
                    onClick={onSave}
                    disabled={actionLoading || !isEditFormValid}
                  >
                    {actionLoading ? "Saving..." : "Save Inline Changes"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-orange-200 shadow-sm">
        <CardHeader className="space-y-1 border-b border-orange-100 bg-orange-50/60 px-4 py-4 sm:px-6 sm:py-5">
          <CardTitle className="text-base font-semibold text-orange-700">
            Danger Zone
          </CardTitle>
          <CardDescription>
            Delete this research center once its linked projects and affiliates
            have been cleared.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-600">
            This action is permanent and follows the existing delete safeguards.
          </div>
          <Button
            variant="outline"
            className="border-orange-200 text-orange-700 hover:bg-orange-50"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            Delete Research Center
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateResearchCenterDialog({
  open,
  onOpenChange,
  centerChiefUsers,
  values,
  errors,
  loading,
  isValid,
  onFieldChange,
  onAddAgenda,
  onRemoveAgenda,
  onSubmit,
}) {
  return open ? (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="mx-auto max-w-3xl border border-slate-300 bg-white text-slate-700 shadow-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-700">
            Create Research Center
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Add a new research center to the registry.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Research Center Name *
            </label>
            <Input
              className={cn(
                "border bg-white",
                errors.name ? "border-[#F97316]" : "border-slate-300",
              )}
              placeholder="e.g., Center for Data Science and AI"
              value={values.name}
              onChange={(event) => onFieldChange({ name: event.target.value })}
            />
            {errors.name ? (
              <p className="text-xs text-slate-800">{errors.name}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Code *
            </label>
            <Input
              className={cn(
                "border bg-white",
                errors.code ? "border-[#F97316]" : "border-slate-300",
              )}
              placeholder="e.g., CDSAI"
              value={values.code}
              onChange={(event) =>
                onFieldChange({
                  code: event.target.value.toUpperCase().replace(/\s+/g, "_"),
                })
              }
            />
            {errors.code ? (
              <p className="text-xs text-slate-800">{errors.code}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Center Chief *
            </label>
            <Select
              value={values.centerChiefId}
              onValueChange={(value) => onFieldChange({ centerChiefId: value })}
            >
              <SelectTrigger
                className={cn(
                  "border bg-white",
                  errors.centerChiefId
                    ? "border-[#F97316]"
                    : "border-slate-300",
                )}
              >
                <SelectValue placeholder="Select Center Chief" />
              </SelectTrigger>
              <SelectContent className="border border-slate-300 bg-white">
                {centerChiefUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.centerChiefId ? (
              <p className="text-xs text-slate-800">{errors.centerChiefId}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Social Media
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <Select
                value={values.socialMediaPlatform}
                onValueChange={(value) =>
                  onFieldChange({ socialMediaPlatform: value })
                }
              >
                <SelectTrigger className="border border-slate-300 bg-white">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent className="border border-slate-300 bg-white">
                  {SOCIAL_MEDIA_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="sm:col-span-2">
                <Input
                  className="border border-slate-300 bg-white"
                  value={values.socialMediaLink}
                  placeholder={getSocialPlaceholder(values.socialMediaPlatform)}
                  onChange={(event) =>
                    onFieldChange({ socialMediaLink: event.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Description
            </label>
            <Textarea
              className="border border-slate-300 bg-white"
              placeholder="Write a short overview, mission, or focus of this research center..."
              value={values.description}
              onChange={(event) =>
                onFieldChange({ description: event.target.value })
              }
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Research Agendum *
            </label>
            <div className="flex gap-2">
              <Input
                className={cn(
                  "border bg-white",
                  errors.researchAgenda
                    ? "border-[#F97316]"
                    : "border-slate-300",
                )}
                placeholder="e.g., Smart Agriculture"
                value={values.agendaInput}
                onChange={(event) =>
                  onFieldChange({ agendaInput: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onAddAgenda();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
                onClick={onAddAgenda}
              >
                Add
              </Button>
            </div>
            {values.researchAgenda.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {values.researchAgenda.map((agenda) => (
                  <button
                    key={agenda}
                    type="button"
                    className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs hover:bg-slate-100"
                    onClick={() => onRemoveAgenda(agenda)}
                  >
                    {agenda} ×
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Add at least one agenda.</p>
            )}
            {errors.researchAgenda ? (
              <p className="text-xs text-slate-800">{errors.researchAgenda}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="bg-[#10B981] text-white hover:bg-[#059669]"
            onClick={onSubmit}
            disabled={loading || !isValid}
          >
            {loading ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;
}

export {
  AgendaPanel,
  CreateResearchCenterDialog,
  DirectoryPanel,
  MembersPanel,
  MetricCard,
  ProjectsPanel,
  SettingsPanel,
  WorkspaceOverview,
};
