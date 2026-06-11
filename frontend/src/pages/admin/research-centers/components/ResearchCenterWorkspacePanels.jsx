import { DIRECTORY_SKELETON_COUNT, MEMBER_PAGE_SIZE, PROJECT_PAGE_SIZE, SOCIAL_MEDIA_OPTIONS } from '../constants';
import { getSocialPlaceholder } from '../helpers';
import PaginationControls from '@/components/navigation/PaginationControls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/utils/cn';
import { Building2, FolderKanban, Layers3, Search, Trash2, Users } from 'lucide-react';

function MetricCard({
  icon: Icon,
  label,
  value,
  caption,
  tone = "blue",
}) {
  const toneClasses = {
    blue: "bg-white border-slate-200 text-slate-700",
    emerald:
      "from-emerald-50 via-white to-emerald-100/70 border-emerald-200/80 text-emerald-700",
    amber:
      "from-amber-50 via-white to-amber-100/70 border-amber-200/80 text-amber-700",
  };

  return (
    <div
      className={cn(
        "rounded-[1.4rem] border bg-white p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5",
        toneClasses[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-slate-600">{caption}</p>
        </div>
        <div className="rounded-2xl border border-current/10 bg-white/80 p-2.5 shadow-sm">
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
          label="Agendas"
          value={summary.totalAgendas}
          caption="Linked research directions"
          tone="amber"
        />
      </div>

      <div className="grid gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="space-y-1 border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
            <CardTitle className="text-lg font-bold text-slate-700">
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
      <CardHeader className="space-y-4 border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-slate-700">
              Research Center Members
            </CardTitle>
            <CardDescription>
              {filteredRows.length} member(s) matched for {center.name}.
            </CardDescription>
          </div>
          <label className="relative w-full lg:max-w-md">
            <span className="sr-only">Search members</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
            <Input
              className="border-slate-300 bg-white pl-8"
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
            <SelectTrigger className="border-slate-300 bg-white">
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
            <SelectTrigger className="border-slate-300 bg-white">
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
            <SelectTrigger className="border-slate-300 bg-white">
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
                    className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
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
                <TableHeader>
                  <TableRow>
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
            <CardTitle className="text-lg font-bold text-slate-900">
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
              className="border-slate-300 bg-white pl-8"
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
            <SelectTrigger className="border-slate-300 bg-white">
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
            <SelectTrigger className="border-slate-300 bg-white">
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
                    className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
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
                <TableHeader>
                  <TableRow>
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

function AgendasPanel({ center, agendaNames }) {
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="space-y-1 border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
        <CardTitle className="text-lg font-bold text-slate-700">
          Linked Agendas
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
                className="rounded-[1.35rem] border border-slate-300 bg-white p-4 shadow-sm"
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
          <div className="rounded-[1.35rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-700">
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
        <CardHeader className="space-y-1 border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
          <CardTitle className="text-lg font-bold text-slate-700">
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
              <div className="h-10 rounded-2xl bg-slate-200" />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-32 rounded-[1.3rem] bg-slate-200" />
                <div className="h-32 rounded-[1.3rem] bg-slate-200" />
              </div>
              <div className="h-32 rounded-[1.3rem] bg-slate-200" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-sm">
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
                          "h-11 rounded-2xl border bg-white",
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
                          "h-11 rounded-2xl border bg-white",
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
                            "h-11 rounded-2xl border bg-white",
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

                <div className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-sm">
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
                          <SelectTrigger className="h-11 rounded-2xl border border-slate-300 bg-white">
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
                            className="h-11 rounded-2xl border border-slate-300 bg-white"
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
                        className="min-h-[180px] rounded-[1.1rem] border border-slate-300 bg-white"
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

              <div className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
                  Research Agendas
                </p>
                <div className="mt-4 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      className={cn(
                        "h-11 rounded-2xl border bg-white",
                        editErrors.researchAgendas
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

                  {editing.researchAgendas.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {editing.researchAgendas.map((agenda) => (
                        <button
                          key={agenda}
                          type="button"
                          className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
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

                  {editErrors.researchAgendas ? (
                    <p className="text-xs text-slate-800">
                      {editErrors.researchAgendas}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-[1.35rem] border border-slate-100 bg-slate-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
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
          <CardTitle className="text-lg font-bold text-orange-700">
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
                  errors.researchAgendas
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
            {values.researchAgendas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {values.researchAgendas.map((agenda) => (
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
            {errors.researchAgendas ? (
              <p className="text-xs text-slate-800">{errors.researchAgendas}</p>
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
  AgendasPanel,
  CreateResearchCenterDialog,
  DirectoryPanel,
  MembersPanel,
  MetricCard,
  ProjectsPanel,
  SettingsPanel,
  WorkspaceOverview,
};
