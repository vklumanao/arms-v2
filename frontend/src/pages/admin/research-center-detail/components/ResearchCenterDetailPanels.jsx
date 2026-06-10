import EmptyState from '@/components/feedback/EmptyState';
import PaginationControls from '@/components/navigation/PaginationControls';
import { useToast } from '@/components/providers/ToastProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { createCenterScorecard, fetchCenterScorecard, fetchDefaultScorecardTemplate, updateCenterScorecard } from '@/services/scorecardsService';
import { cn } from '@/utils/cn';
import { formatStatusLabel } from '@/utils/status';
import { Building2, ChevronLeft, Eye, Facebook, FolderKanban, Globe, Instagram, Linkedin, Loader2, Pencil, RefreshCw, Save, Trash2, Twitter, Users, X, Youtube } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const ICON_BY_KEY = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
  website: Globe,
};

function DetailWorkspaceHeader({
  center,
  usage,
  initials,
  isCenterChief,
  loading,
  onBack,
  onEdit,
  onDelete,
  socialLink,
  socialMeta,
}) {
  const SocialIcon = ICON_BY_KEY[socialMeta?.iconKey] || Globe;

  return (
    <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96))] p-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {!isCenterChief ? (
            <Button
              variant="outline"
              className="min-h-10 w-full border-slate-300 bg-white text-slate-900 hover:bg-slate-50 sm:w-auto"
              onClick={onBack}
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Centers
            </Button>
          ) : (
            <span />
          )}

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Button
              variant="outline"
              className="min-h-10 border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
              disabled={loading || !center}
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              className="min-h-10 bg-[#F97316] text-white hover:bg-[#EA580C]"
              disabled={loading || !center}
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white/80 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#10B981] text-lg font-bold text-white">
              {initials}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Research Center
              </p>
              <h1 className="break-words text-lg font-bold leading-tight text-[#1E293B] sm:text-2xl">
                {center?.name || "Research Center"}
              </h1>
              <p className="text-sm text-slate-600">
                <span className="font-mono font-semibold text-slate-800">
                  {center?.code || "-"}
                </span>
                {" - "}
                Chief:{" "}
                <span className="font-semibold">
                  {center?.centerChiefName || "-"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Badge className="gap-1.5 border border-slate-200 bg-white text-[#1E293B]">
              <Users className="h-4 w-4" />
              {usage.profileCount} affiliates
            </Badge>
            <Badge className="gap-1.5 border border-slate-200 bg-white text-[#1E293B]">
              <FolderKanban className="h-4 w-4" />
              {usage.projectCount} projects
            </Badge>
            <Badge className="gap-1.5 border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Building2 className="h-4 w-4" />
              {center?.agendaNames?.length || 0} agendas
            </Badge>

            {socialLink ? (
              <a
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 hover:text-[#1E293B]"
                href={socialLink}
                target="_blank"
                rel="noreferrer"
                title={socialMeta?.label || "Open link"}
                aria-label={socialMeta?.label || "Open link"}
              >
                <SocialIcon className="h-5 w-5" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailWorkspaceRail({
  center,
  agendaFilter,
  onAgendaClick,
}) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Description
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {String(center?.description || "").trim() ||
            "No description provided."}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Research Agendas
        </p>

        {center?.agendaNames?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {center.agendaNames.map((agenda) => {
              const active = agendaFilter === agenda;
              return (
                <button
                  key={agenda}
                  type="button"
                  className={
                    active
                      ? "rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-[#1E293B]"
                      : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#1E293B] hover:bg-slate-50"
                  }
                  onClick={() => onAgendaClick(agenda)}
                >
                  {agenda}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No agenda linked.</p>
        )}
      </div>
    </aside>
  );
}

function DetailWorkspaceTabs({ activeTab, onTabChange }) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="grid h-auto w-full grid-cols-2 gap-2 border border-slate-200 bg-white p-1 sm:w-fit sm:grid-cols-none sm:grid-flow-col sm:gap-1">
        <TabsTrigger
          value="projects"
          className="min-h-10 rounded-md data-[state=active]:bg-emerald-50 data-[state=active]:text-[#1E293B]"
        >
          Projects
        </TabsTrigger>
        <TabsTrigger
          value="affiliates"
          className="min-h-10 rounded-md data-[state=active]:bg-emerald-50 data-[state=active]:text-[#1E293B]"
        >
          Affiliates
        </TabsTrigger>
        <TabsTrigger
          value="scorecards"
          className="min-h-10 rounded-md data-[state=active]:bg-emerald-50 data-[state=active]:text-[#1E293B]"
        >
          Scorecards
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function ReferenceDataGrid({
  title,
  description,
  columns,
  rows,
  rowKey,
  renderCell,
  emptyTitle,
  emptyDescription,
  page,
  totalPages,
  onPageChange,
  loading,
  minWidthClass = "min-w-[980px]",
}) {
  return (
    <Card className="overflow-hidden border border-slate-200 bg-white">
      <CardHeader className="border-b border-slate-200 bg-slate-50 px-6 py-5">
        <CardTitle className="text-base font-bold text-[#1E293B]">
          {title}
        </CardTitle>
        <CardDescription className="text-sm text-slate-600">
          {description}
        </CardDescription>
      </CardHeader>

      {loading ? (
        <CardContent className="p-6 text-sm text-slate-600">Loading...</CardContent>
      ) : rows.length === 0 ? (
        <CardContent className="p-6">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </CardContent>
      ) : (
        <>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className={minWidthClass}>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    {columns.map((column) => (
                      <TableHead
                        key={column.key}
                        className={column.headerClassName || ""}
                      >
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow
                      key={rowKey(row, index)}
                      className="hover:bg-slate-50"
                    >
                      {columns.map((column) => (
                        <TableCell
                          key={column.key}
                          className={column.cellClassName || ""}
                        >
                          {renderCell(column.key, row, index)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            className="border-t border-slate-200"
          />
        </>
      )}
    </Card>
  );
}

const affiliateColumns = [
  { key: "number", label: "No.", headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell" },
  { key: "full_name", label: "Full Name", cellClassName: "font-medium text-slate-900" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "department", label: "Department" },
  { key: "actions", label: "Actions", headerClassName: "text-right", cellClassName: "text-right" },
];

function AffiliatesPanel({
  links,
  center,
  paginatedAffiliates,
  affiliatesPage,
  affiliatesTotalPages,
  pageSize,
  onPageChange,
  onUnlink,
  loading,
}) {
  return (
    <ReferenceDataGrid
      title="Linked Affiliates"
      description={`Showing ${links.profiles.length} affiliate(s).`}
      columns={affiliateColumns}
      rows={paginatedAffiliates}
      rowKey={(row, index) => row?.id || `${index}`}
      page={affiliatesPage}
      totalPages={affiliatesTotalPages}
      onPageChange={onPageChange}
      loading={loading}
      minWidthClass="min-w-[720px]"
      emptyTitle="No affiliates"
      emptyDescription="No linked affiliates found for this research center."
      renderCell={(key, row, index) => {
        const rowId = String(row?.id || "").trim();
        const centerChiefId = String(center?.centerChiefId || "").trim();
        const isChief = rowId && centerChiefId && rowId === centerChiefId;

        if (key === "number") return (affiliatesPage - 1) * pageSize + index + 1;
        if (key === "full_name") return row?.full_name || row?.name || "-";
        if (key === "email") return <span className="text-slate-700">{row?.email || "-"}</span>;
        if (key === "role") return <span className="capitalize text-slate-700">{row?.role || "-"}</span>;
        if (key === "department") return <span className="text-slate-700">{row?.department || "-"}</span>;
        if (key === "actions") {
          return (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-600 hover:bg-slate-50"
              disabled={isChief}
              onClick={() => onUnlink(row)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          );
        }
        return "-";
      }}
    />
  );
}

function DeleteResearchCenterDialog({
  open,
  onOpenChange,
  deleteGuard,
  deleting,
  onDelete,
  onGoToProjects,
  onGoToAffiliates,
}) {
  const blocked = deleteGuard?.blocked;
  const projectCount = Number(deleteGuard?.reasons?.projectCount || 0);
  const affiliateCount = Number(deleteGuard?.reasons?.nonAdminAffiliates || 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !deleting && onOpenChange(next)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[#1E293B]">
            Delete Research Center
          </DialogTitle>
          <DialogDescription>
            {blocked
              ? "Deletion is blocked because this center still has linked records."
              : "This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>

        {blocked ? (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {projectCount > 0 ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{projectCount} linked project(s)</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onGoToProjects}
                >
                  View Projects
                </Button>
              </div>
            ) : null}
            {affiliateCount > 0 ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{affiliateCount} linked affiliate(s)</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onGoToAffiliates}
                >
                  Manage Affiliates
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="w-full bg-orange-600 text-white hover:bg-orange-700 sm:w-auto"
            disabled={deleting || blocked}
            onClick={onDelete}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditResearchCenterModal({
  open,
  onOpenChange,
  editForm,
  updateEditForm,
  editErrors,
  isEditValid,
  chiefUsers,
  addEditAgenda,
  removeEditAgenda,
  saveCenter,
  editSaving,
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !editSaving && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-4xl">
        <div className="flex max-h-[90vh] flex-col">
          <DialogHeader className="border-b border-slate-200 px-5 py-4 sm:px-6 sm:py-5">
            <DialogTitle>Edit Research Center</DialogTitle>
            <DialogDescription>
              Update research center information.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
            <div className="rounded-xl border bg-white p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Basic Information
              </p>

              <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Name</span>
                  <Input
                    value={editForm.name}
                    onChange={(event) =>
                      updateEditForm({ name: event.target.value })
                    }
                  />
                  {editErrors.name ? (
                    <p className="field-error">{editErrors.name}</p>
                  ) : null}
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Code</span>
                  <Input
                    value={editForm.code}
                    onChange={(event) =>
                      updateEditForm({ code: event.target.value })
                    }
                  />
                  {editErrors.code ? (
                    <p className="field-error">{editErrors.code}</p>
                  ) : null}
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Center Chief
                  </span>

                  <Select
                    value={String(editForm.centerChiefId || "")}
                    onValueChange={(value) =>
                      updateEditForm({ centerChiefId: value })
                    }
                  >
                    <SelectTrigger
                      className={editErrors.centerChiefId ? "input-error" : ""}
                    >
                      <SelectValue placeholder="Select center chief" />
                    </SelectTrigger>

                    <SelectContent>
                      {chiefUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {editErrors.centerChiefId ? (
                    <p className="field-error">{editErrors.centerChiefId}</p>
                  ) : null}
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Social Media Link
                  </span>

                  <Input
                    value={editForm.socialMediaLink}
                    onChange={(event) =>
                      updateEditForm({
                        socialMediaLink: event.target.value,
                      })
                    }
                    placeholder="https://facebook.com/your-center"
                  />
                </label>

                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-semibold text-slate-700">
                    Description
                  </span>

                  <Textarea
                    value={editForm.description}
                    onChange={(event) =>
                      updateEditForm({
                        description: event.target.value,
                      })
                    }
                    rows={4}
                    placeholder="Optional short description..."
                  />
                </label>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Research Agendas
              </p>

              <div className="flex flex-wrap gap-2">
                {editForm.researchAgendas.map((agenda) => (
                  <button
                    key={agenda}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-muted"
                    onClick={() => removeEditAgenda(agenda)}
                  >
                    <span className="truncate">{agenda}</span>
                    <X className="h-3.5 w-3.5 text-slate-500" />
                  </button>
                ))}

                {editForm.researchAgendas.length === 0 ? (
                  <p className="text-xs text-slate-500">No agendas yet.</p>
                ) : null}
              </div>

              {editErrors.researchAgendas ? (
                <p className="field-error">{editErrors.researchAgendas}</p>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Add research agendum"
                  value={editForm.agendaInput}
                  onChange={(event) =>
                    updateEditForm({
                      agendaInput: event.target.value,
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    addEditAgenda();
                  }}
                />

                <Button type="button" variant="outline" onClick={addEditAgenda}>
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 sm:px-6">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={editSaving}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={editSaving || !isEditValid}
                onClick={saveCenter}
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const projectColumns = [
  {
    key: "number",
    label: "No.",
    headerClassName: "hidden sm:table-cell",
    cellClassName: "hidden sm:table-cell",
  },
  {
    key: "title",
    label: "Project Title",
    cellClassName: "font-medium text-slate-900",
  },
  { key: "status", label: "Status" },
  { key: "year", label: "Year" },
  { key: "lead", label: "Lead Researcher" },
  { key: "department", label: "Department" },
  { key: "agenda", label: "Agendum" },
  {
    key: "actions",
    label: "Actions",
    headerClassName: "text-right",
    cellClassName: "text-right",
  },
];

function ProjectFilterBar({
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

function ProjectsPanel({
  links,
  filteredProjects,
  paginatedProjects,
  projectsPage,
  projectsTotalPages,
  pageSize,
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
  clearProjectFilters,
  onPageChange,
  statusBadgeClass,
  goToProject,
  loading,
}) {
  const activeFilterCount = [
    Boolean(agendaFilter),
    Boolean(projectSearch.trim()),
    projectStatus !== "all",
    projectYear !== "all",
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      <ProjectFilterBar
        agendaFilter={agendaFilter}
        setAgendaFilter={setAgendaFilter}
        projectSearch={projectSearch}
        setProjectSearch={setProjectSearch}
        projectStatus={projectStatus}
        setProjectStatus={setProjectStatus}
        projectStatusOptions={projectStatusOptions}
        projectYear={projectYear}
        setProjectYear={setProjectYear}
        projectYearOptions={projectYearOptions}
        activeFilterCount={activeFilterCount}
        onReset={clearProjectFilters}
      />

      <ReferenceDataGrid
        title="Linked Projects"
        description={`Showing ${filteredProjects.length} project(s).`}
        columns={projectColumns}
        rows={paginatedProjects}
        rowKey={(row, index) => row?.id || `${index}`}
        page={projectsPage}
        totalPages={projectsTotalPages}
        onPageChange={onPageChange}
        loading={loading}
        minWidthClass="min-w-[860px]"
        emptyTitle="No projects"
        emptyDescription={
          links.projects.length === 0
            ? "No linked projects found for this research center."
            : "No projects match your filters."
        }
        renderCell={(key, row, index) => {
          if (key === "number")
            return (projectsPage - 1) * pageSize + index + 1;
          if (key === "title") return row?.title || "-";
          if (key === "status") {
            return (
              <Badge
                variant="outline"
                className={`capitalize ${statusBadgeClass(row?.status)}`}
              >
                {formatStatusLabel(row?.status) || "-"}
              </Badge>
            );
          }
          if (key === "year")
            return <span className="text-slate-700">{row?.year || "-"}</span>;
          if (key === "lead")
            return (
              <span className="text-slate-700">
                {row?.lead_researcher || "-"}
              </span>
            );
          if (key === "department") {
            return (
              <span className="text-slate-700">
                {row?.department_name || "-"}
              </span>
            );
          }
          if (key === "agenda")
            return (
              <span className="text-slate-700">{row?.agenda_name || "-"}</span>
            );
          if (key === "actions") {
            return (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-600 hover:bg-slate-50"
                onClick={() => goToProject(row)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            );
          }
          return "-";
        }}
      />
    </div>
  );
}

function formatPercent(value) {
  const numeric = Number(value || 0);
  return `${numeric.toFixed(3)}%`;
}

function ScorecardsPanel({ center, isCenterChief }) {
  const toast = useToast();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState(null);
  const [scorecard, setScorecard] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const centerId = String(center?.id || "").trim();

  const loadData = async () => {
    if (!centerId) return;
    setLoading(true);
    setError("");
    setMessage("");

    const [templateRes, scorecardRes] = await Promise.all([
      fetchDefaultScorecardTemplate(),
      fetchCenterScorecard({ centerId, year }),
    ]);

    if (templateRes.error) {
      setError(templateRes.error.message || "Unable to load default template.");
    } else {
      setTemplate(templateRes.data);
    }

    if (scorecardRes.error) {
      if (String(scorecardRes.error?.message || "").includes("not found")) {
        setScorecard(null);
        setRows([]);
      } else {
        setError(
          scorecardRes.error.message || "Unable to load center scorecard.",
        );
      }
    } else {
      setScorecard(scorecardRes.data);
      setRows(Array.isArray(scorecardRes.data?.items) ? scorecardRes.data.items : []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, year]);

  const summary = useMemo(() => {
    const total = rows.length;
    const withTarget = rows.filter((row) => Number(row?.target || 0) > 0).length;
    const achieved = rows.filter((row) => Number(row?.actual_value || 0) >= Number(row?.target || 0) && Number(row?.target || 0) > 0).length;
    return { total, withTarget, achieved };
  }, [rows]);

  const ensureScorecard = async () => {
    if (!centerId) return;
    setSaving(true);
    setError("");
    const created = await createCenterScorecard({ centerId, year });
    if (created.error) {
      setError(created.error.message || "Unable to create scorecard.");
      setSaving(false);
      return;
    }
    setMessage("Scorecard created successfully.");
    await loadData();
    setSaving(false);
  };

  const saveChanges = async () => {
    if (!centerId || !scorecard) return;
    setSaving(true);
    setError("");
    const payload = {
      name: scorecard.name,
      notes: scorecard.notes || "",
      status: scorecard.status || "draft",
      items: rows.map((row) => ({
        sheet_code: row.sheet_code,
        deliverable: row.deliverable,
        target_type: row.target_type,
        target: row.target,
        success_indicator: row.success_indicator,
        weight: row.weight,
        is_enabled: row.is_enabled,
        sort_order: row.sort_order,
        notes: row.notes || "",
      })),
    };
    const updated = await updateCenterScorecard({ centerId, year, payload });
    if (updated.error) {
      setError(updated.error.message || "Unable to save scorecard.");
      setSaving(false);
      return;
    }
    setMessage("Scorecard saved successfully.");
    await loadData();
    setSaving(false);
  };

  const updateRow = (index, patch) => {
    setRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  };

  if (!centerId) {
    return (
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5 text-sm text-slate-600">
          Select a research center to manage scorecards.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Scorecard Builder
                </p>
                <h3 className="text-xl font-bold text-slate-900">
                  {center?.name || "Research Center"}
                </h3>
              </div>
              <p className="text-sm text-slate-600">
                Configure the annual RDISO scorecard for this center.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Year</span>
                <Input
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  className="w-28 border-slate-300 bg-white text-slate-700"
                />
              </label>
              <Button
                variant="outline"
                onClick={loadData}
                className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Reload
              </Button>
              {!scorecard ? (
                <Button variant="mono" onClick={ensureScorecard} disabled={saving}>
                  {saving ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    "Create Annual Scorecard"
                  )}
                </Button>
              ) : (
                <Button variant="mono" onClick={saveChanges} disabled={saving}>
                  {saving ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      Save Draft
                    </span>
                  )}
                </Button>
              )}
            </div>
          </div>
          {template ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                Template: {template.name}
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                Version: {template.version}
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                Indicators: {template.items?.length || 0}
              </Badge>
              {scorecard ? (
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                  Status: {scorecard.status}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <Card className="border border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="p-4 text-sm text-rose-700">{error}</CardContent>
        </Card>
      ) : null}
      {message ? (
        <Card className="border border-emerald-200 bg-emerald-50 shadow-sm">
          <CardContent className="p-4 text-sm text-emerald-700">{message}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Total Indicators
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{summary.total}</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              With Targets
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{summary.withTarget}</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Already Achieved
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{summary.achieved}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 text-slate-600">
                <TableRow>
                  <TableHead className="w-[90px]">Sheet</TableHead>
                  <TableHead>Deliverable</TableHead>
                  <TableHead className="w-[120px]">Target</TableHead>
                  <TableHead className="w-[120px]">Actual</TableHead>
                  <TableHead className="w-[140px]">%</TableHead>
                  <TableHead className="w-[180px]">Success Indicator</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows || []).map((row, index) => {
                  const target = Number(row?.target || 0);
                  const actual = Number(row?.actual_value || 0);
                  const percent = target > 0 ? (actual / target) * 100 : 0;
                  return (
                    <TableRow key={`${row?.sheet_code || index}-${index}`}>
                      <TableCell className="text-slate-700">{row.sheet_code}</TableCell>
                      <TableCell className="text-slate-700">
                        <div className="space-y-1">
                          <Input
                            value={row.deliverable || ""}
                            onChange={(event) =>
                              updateRow(index, { deliverable: event.target.value })
                            }
                            className="border-slate-300 bg-white text-slate-700"
                          />
                          <Input
                            value={row.notes || ""}
                            onChange={(event) =>
                              updateRow(index, { notes: event.target.value })
                            }
                            placeholder="Notes"
                            className="border-slate-300 bg-white text-slate-700"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-700">
                        <Input
                          type="number"
                          value={row.target ?? 0}
                          onChange={(event) =>
                            updateRow(index, { target: event.target.value })
                          }
                          className="border-slate-300 bg-white text-slate-700"
                        />
                      </TableCell>
                      <TableCell className="text-slate-700">
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          {actual.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-700">
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-slate-200",
                            percent >= 100
                              ? "bg-emerald-50 text-emerald-700"
                              : percent >= 50
                                ? "bg-amber-50 text-amber-700"
                                : "bg-rose-50 text-rose-700",
                          )}
                        >
                          {formatPercent(percent)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-700">
                        <Input
                          value={row.success_indicator || ""}
                          onChange={(event) =>
                            updateRow(index, { success_indicator: event.target.value })
                          }
                          className="border-slate-300 bg-white text-slate-700"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export {
  AffiliatesPanel,
  DeleteResearchCenterDialog,
  DetailWorkspaceHeader,
  DetailWorkspaceRail,
  DetailWorkspaceTabs,
  EditResearchCenterModal,
  EditResearchCenterModal as EditResearchCenterDrawer,
  ProjectsPanel,
  ReferenceDataGrid,
  ScorecardsPanel,
};
