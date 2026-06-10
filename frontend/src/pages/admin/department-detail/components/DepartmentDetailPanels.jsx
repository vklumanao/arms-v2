import EmptyState from "@/components/feedback/EmptyState";
import PaginationControls from "@/components/navigation/PaginationControls";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Eye, FolderKanban, Users, Search, Trash2 } from "lucide-react";

const PAGE_SIZE = 10;

export function DepartmentHeroHeader({ department, initials, usage }) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-lg font-bold uppercase text-white shadow-sm">
          {initials}
        </div>
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold text-slate-900">
            {department?.name || "Department"}
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Code:{" "}
            <span className="font-mono font-semibold text-slate-700">
              {department?.code || "-"}
            </span>
            {" - "}
            Chairperson:{" "}
            <span className="font-semibold text-slate-700">
              {department?.chairpersonName || "-"}
            </span>
          </CardDescription>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-2">
              <Users className="h-4 w-4" />
              {usage.profileCount} affiliates
            </Badge>
            <Badge variant="secondary" className="gap-2">
              <FolderKanban className="h-4 w-4" />
              {usage.projectCount} projects
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DepartmentDetailTabs({
  activeTab,
  setTab,
  usage,
  links,
  paginatedAffiliates,
  affiliatesPage,
  setAffiliatesPage,
  affiliatesTotalPages,
  affiliateById,
  centerNameById,
  centerNameByAffiliateId,
  setUnlinkTarget,
  filteredProjects,
  agendaFilter,
  setAgendaFilter,
  projectsSearch,
  setProjectsSearch,
  projectsStatus,
  setProjectsStatus,
  projectStatusOptions,
  projectsYear,
  setProjectsYear,
  projectYearOptions,
  paginatedProjects,
  projectsPage,
  setProjectsPage,
  projectsTotalPages,
  normalizeAgendaLabel,
  goToProject,
}) {
  return (
    <Tabs value={activeTab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="affiliates">Affiliates</TabsTrigger>
        <TabsTrigger value="projects">Projects</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Members
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {usage.profileCount}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Admin {usage.memberBreakdown?.adminCount || 0} - Editor{" "}
                {usage.memberBreakdown?.editorCount || 0} - Member{" "}
                {usage.memberBreakdown?.memberCount || 0}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Projects
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {usage.projectCount}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Linked research projects.
              </p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="affiliates" className="mt-4 space-y-3">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-[var(--border)] px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Linked Affiliates
                </CardTitle>
                <CardDescription>
                  Showing {links.profiles.length} affiliate(s).
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          {links.profiles.length === 0 ? (
            <CardContent className="p-6">
              <EmptyState
                title="No affiliates"
                description="No linked affiliates found for this department."
              />
            </CardContent>
          ) : (
            <>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>No.</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Research Center</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedAffiliates.map((row, idx) => (
                        <TableRow key={row?.id || `${idx}`}>
                          <TableCell>
                            {(affiliatesPage - 1) * PAGE_SIZE + idx + 1}
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            {row?.full_name || row?.name || "-"}
                          </TableCell>
                          <TableCell className="text-slate-700">
                            {row?.email || "-"}
                          </TableCell>
                          <TableCell className="capitalize text-slate-700">
                            {row?.role || "-"}
                          </TableCell>
                          <TableCell className="text-slate-700">
                            {(() => {
                              const affiliate =
                                affiliateById[String(row?.id || "").trim()];
                              const centerId = String(
                                affiliate?.ckan_org_id || "",
                              ).trim();
                              return (
                                row?.research_center ||
                                row?.research_center_name ||
                                (centerId
                                  ? centerNameById[centerId] ||
                                    centerNameByAffiliateId[centerId]
                                  : "") ||
                                "-"
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-[var(--danger)] hover:bg-slate-50"
                              onClick={() => setUnlinkTarget(row)}
                              aria-label={`Unlink ${row?.full_name || "affiliate"}`}
                              title="Unlink"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
              <PaginationControls
                page={affiliatesPage}
                totalPages={affiliatesTotalPages}
                onPageChange={setAffiliatesPage}
                className="rounded-none border-0 border-t border-[var(--border)]"
              />
            </>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="projects" className="mt-4 space-y-3">
        {links.projects.length === 0 ? (
          <EmptyState
            title="No projects"
            description="No linked projects found for this department."
          />
        ) : (
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-[var(--border)] px-6 py-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold text-slate-900">
                    Linked Projects
                  </CardTitle>
                  <CardDescription>
                    Showing {filteredProjects.length} project(s).
                  </CardDescription>
                  {agendaFilter ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="rounded-full border border-border bg-white px-2.5 py-1 font-semibold text-slate-700">
                        Agenda: {agendaFilter}
                      </span>
                      <button
                        type="button"
                        className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                        onClick={() => setAgendaFilter("")}
                      >
                        Clear agenda
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="relative w-full min-w-[14rem] md:w-auto">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="pl-8"
                      placeholder="Search projects"
                      value={projectsSearch}
                      onChange={(event) =>
                        setProjectsSearch(event.target.value)
                      }
                    />
                  </label>
                  <Select
                    value={projectsStatus}
                    onValueChange={setProjectsStatus}
                  >
                    <SelectTrigger className="w-full md:w-[12rem] capitalize">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectStatusOptions.map((status) => (
                        <SelectItem
                          key={status}
                          value={status}
                          className="capitalize"
                        >
                          {status === "all" ? "All statuses" : status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={projectsYear} onValueChange={setProjectsYear}>
                    <SelectTrigger className="w-full md:w-[10rem]">
                      <SelectValue placeholder="All years" />
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
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setProjectsSearch("");
                      setProjectsStatus("all");
                      setProjectsYear("all");
                      setAgendaFilter("");
                    }}
                  >
                    Reset filters
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                {filteredProjects.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      title="No projects matched"
                      description="Try adjusting the search or filters to find matching projects."
                    />
                  </div>
                ) : (
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>No.</TableHead>
                        <TableHead>Project Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Lead Researcher</TableHead>
                        <TableHead>Research Center</TableHead>
                        <TableHead>Agendum</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedProjects.map((row, idx) => (
                        <TableRow key={row?.id || `${idx}`}>
                          <TableCell>
                            {(projectsPage - 1) * PAGE_SIZE + idx + 1}
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            {row?.title || "-"}
                          </TableCell>
                          <TableCell className="capitalize text-slate-700">
                            {row?.status || "-"}
                          </TableCell>
                          <TableCell className="text-slate-700">
                            {row?.year || "-"}
                          </TableCell>
                          <TableCell className="text-slate-700">
                            {row?.lead_researcher || "-"}
                          </TableCell>
                          <TableCell className="text-slate-700">
                            {row?.research_center || "-"}
                          </TableCell>
                          <TableCell className="text-slate-700">
                            {normalizeAgendaLabel(row?.agenda || "-")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => goToProject(row)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
            {projectsTotalPages > 1 ? (
              <PaginationControls
                page={projectsPage}
                totalPages={projectsTotalPages}
                onPageChange={setProjectsPage}
                className="rounded-none border-0 border-t border-[var(--border)]"
              />
            ) : null}
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
