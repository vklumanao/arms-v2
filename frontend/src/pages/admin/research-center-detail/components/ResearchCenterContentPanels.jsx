import EmptyState from "@/components/feedback/EmptyState";
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
import { Eye, Trash2 } from "lucide-react";

export default function ResearchCenterContentPanels({
  center,
  activeTab,
  setTab,
  applyAgendaFilter,
  links,
  paginatedAffiliates,
  affiliatesPage,
  affiliatesTotalPages,
  setAffiliatesPage,
  setUnlinkTarget,
  filteredProjects,
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
  paginatedProjects,
  projectsPage,
  projectsTotalPages,
  setProjectsPage,
  statusBadgeClass,
  formatStatusLabel,
  goToProject,
  pageSize,
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Description</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
            {String(center?.description || "").trim() || "No description provided."}
          </p>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">Research Agenda</p>
          {center.agendaNames.length ? (
            <div className="flex flex-wrap gap-3">
              {center.agendaNames.map((agenda) => (
                <button
                  key={agenda}
                  type="button"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#1E293B] transition hover:bg-slate-50"
                  onClick={() => applyAgendaFilter(agenda)}
                  title="Filter linked projects by this agenda"
                >
                  {agenda}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No agenda linked.</p>
          )}
        </div>
      </aside>

      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setTab}>
          <TabsList className="text-sm border border-slate-200 bg-white">
            <TabsTrigger
              value="projects"
              className="text-sm data-[state=active]:bg-emerald-50 data-[state=active]:text-[#1E293B]"
            >
              Projects
            </TabsTrigger>
            <TabsTrigger
              value="affiliates"
              className="text-sm data-[state=active]:bg-emerald-50 data-[state=active]:text-[#1E293B]"
            >
              Affiliates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="affiliates" className="mt-4 space-y-3">
            <Card className="overflow-hidden border border-slate-200 bg-white">
              <CardHeader className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                <CardTitle className="text-base font-bold text-[#1E293B]">Linked Affiliates</CardTitle>
                <CardDescription className="text-sm text-slate-600">
                  Showing {links.profiles.length} affiliate(s).
                </CardDescription>
              </CardHeader>

              {links.profiles.length === 0 ? (
                <CardContent className="p-6">
                  <EmptyState
                    title="No affiliates"
                    description="No linked affiliates found for this research center."
                  />
                </CardContent>
              ) : (
                <>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table className="min-w-[980px]">
                        <TableHeader>
                          <TableRow className="bg-slate-100">
                            <TableHead>No.</TableHead>
                            <TableHead>Full Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {paginatedAffiliates.map((row, idx) => {
                            const rowId = String(row?.id || "").trim();
                            const centerChiefId = String(center?.centerChiefId || "").trim();
                            const isChief = rowId && centerChiefId && rowId === centerChiefId;

                            return (
                              <TableRow key={row?.id || `${idx}`} className="hover:bg-slate-50">
                                <TableCell>{(affiliatesPage - 1) * pageSize + idx + 1}</TableCell>
                                <TableCell className="font-medium text-slate-900">
                                  {row?.full_name || row?.name || "-"}
                                </TableCell>
                                <TableCell className="text-slate-700">{row?.email || "-"}</TableCell>
                                <TableCell className="capitalize text-slate-700">{row?.role || "-"}</TableCell>
                                <TableCell className="text-slate-700">{row?.department || "-"}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-600 hover:bg-slate-50"
                                    disabled={isChief}
                                    onClick={() => setUnlinkTarget(row)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>

                  <PaginationControls
                    page={affiliatesPage}
                    totalPages={affiliatesTotalPages}
                    onPageChange={setAffiliatesPage}
                    className="border-t border-slate-200"
                  />
                </>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="mt-5 space-y-4">
            {links.projects.length === 0 ? (
              <EmptyState
                title="No projects"
                description="No linked projects found for this research center."
              />
            ) : (
              <Card className="overflow-hidden border border-slate-200 bg-white">
                <CardHeader className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                  <CardTitle className="text-base font-bold text-[#1E293B]">Linked Projects</CardTitle>
                  <CardDescription className="text-sm text-slate-600">
                    Showing {filteredProjects.length} project(s).
                  </CardDescription>

                  {agendaFilter && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-800">
                        Agenda: {agendaFilter}
                      </span>
                      <button
                        className="text-xs font-semibold text-slate-500 hover:text-[#1E293B]"
                        onClick={() => setAgendaFilter("")}
                      >
                        Clear agenda
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <Input
                      className="w-[180px] h-7 px-2 text-xs border-slate-300 focus:border-emerald-500 focus:ring-0"
                      placeholder="Search projects"
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                    />

                    <Select value={projectStatus} onValueChange={setProjectStatus}>
                      <SelectTrigger className="w-[160px] h-7 px-2 text-xs border-slate-300 focus:border-emerald-500 focus:ring-0">
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
                      <SelectTrigger className="w-[120px] h-7 px-2 text-xs border-slate-300 focus:border-emerald-500 focus:ring-0">
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
                      className="h-7 px-2.5 text-xs border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-[#1E293B] transition"
                      onClick={() => {
                        setProjectSearch("");
                        setProjectStatus("all");
                        setProjectYear("all");
                        setAgendaFilter("");
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[980px]">
                      <TableHeader>
                        <TableRow className="bg-slate-100">
                          <TableHead>No.</TableHead>
                          <TableHead>Project Title</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Year</TableHead>
                          <TableHead>Lead Researcher</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Agendum</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {paginatedProjects.map((row, idx) => (
                          <TableRow key={row?.id || `${idx}`} className="hover:bg-slate-50">
                            <TableCell>{(projectsPage - 1) * pageSize + idx + 1}</TableCell>
                            <TableCell className="font-medium text-slate-900">{row?.title || "-"}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`capitalize ${statusBadgeClass(row?.status)}`}
                              >
                                {formatStatusLabel(row?.status) || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-700">{row?.year || "-"}</TableCell>
                            <TableCell className="text-slate-700">{row?.lead_researcher || "-"}</TableCell>
                            <TableCell className="text-slate-700">{row?.department_name || "-"}</TableCell>
                            <TableCell className="text-slate-700">{row?.agenda_name || "-"}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-600 hover:bg-slate-50"
                                onClick={() => goToProject(row)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>

                <PaginationControls
                  page={projectsPage}
                  totalPages={projectsTotalPages}
                  onPageChange={setProjectsPage}
                  className="border-t border-slate-200"
                />
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
