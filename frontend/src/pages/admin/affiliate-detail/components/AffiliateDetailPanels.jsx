import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { FolderKanban, Search, Users } from "lucide-react";

export function AffiliateProfileCard({
  affiliate,
  initials,
  centerNameById,
  departmentLabel,
}) {
  return (
    <Card className="overflow-hidden border border-black/20 bg-white shadow-sm">
      <CardContent className="p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-xl font-bold uppercase text-white shadow">
              {initials}
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-zinc-900">
                {affiliate?.full_name || "-"}
              </h2>

              <p className="text-sm text-zinc-500">{affiliate?.email || "-"}</p>

              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary" className="gap-2 capitalize">
                  <Users className="h-4 w-4" />
                  {affiliate?.role}
                </Badge>

                <Badge
                  variant={affiliate?.is_active ? "secondary" : "destructive"}
                >
                  {affiliate?.is_active ? "Active" : "Inactive"}
                </Badge>

                <Badge variant="secondary" className="gap-2">
                  <FolderKanban className="h-4 w-4" />
                  {Number(affiliate?.research_project_count || 0)} Projects
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div>
              <p className="text-zinc-500">Research Center</p>
              <p className="font-semibold text-zinc-900">
                {affiliate?.ckan_org_id
                  ? centerNameById[affiliate.ckan_org_id] || "-"
                  : "-"}
              </p>
            </div>

            <div>
              <p className="text-zinc-500">Department</p>
              <p className="font-semibold text-zinc-900">{departmentLabel}</p>
            </div>

            <div>
              <p className="text-zinc-500">Employment Status</p>
              <p className="font-semibold text-zinc-900">
                {affiliate?.employment_status || "-"}
              </p>
            </div>

            <div>
              <p className="text-zinc-500">Designation</p>
              <p className="font-semibold text-zinc-900">
                {affiliate?.designation || "-"}
              </p>
            </div>

            <div>
              <p className="text-zinc-500">GS Faculty</p>
              <p className="font-semibold text-zinc-900">
                {affiliate?.is_gs_faculty ? "Yes" : "No"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AffiliateProjectsPanel({
  affiliate,
  filteredProjects,
  projectSearch,
  setProjectSearch,
  projectStatus,
  setProjectStatus,
  projectYear,
  setProjectYear,
  projectStatusOptions,
  projectYearOptions,
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Publications", value: Number(affiliate?.publication_count || 0) },
          { label: "Awards", value: Number(affiliate?.awards_count || 0) },
          { label: "IPs", value: Number(affiliate?.ip_count || 0) },
        ].map((card) => (
          <Card key={card.label} className="overflow-hidden border border-black/20 bg-white shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">
                {card.label}
              </p>
              <p className="mt-2 text-3xl font-bold text-black">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden border border-black/20 bg-white shadow-sm">
        <CardHeader className="border-b border-zinc-200 px-6 py-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-black">Related Projects</CardTitle>
              <CardDescription className="text-zinc-600">
                Projects linked to this affiliate.
              </CardDescription>
            </div>
            <p className="text-sm text-zinc-600">{filteredProjects.length} row(s).</p>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <div className="rounded-2xl border border-black/20 bg-white/95 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <label className="relative w-full lg:max-w-md">
                <span className="sr-only">Search projects</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
                <Input
                  className="pl-9"
                  placeholder="Search projects"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                />
              </label>

              <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
                <Select value={projectStatus} onValueChange={setProjectStatus}>
                  <SelectTrigger className="w-full sm:w-[160px] capitalize">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-zinc-300 shadow-md">
                    {projectStatusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status === "all" ? "All statuses" : status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={projectYear} onValueChange={setProjectYear}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-zinc-300 shadow-md">
                    {projectYearOptions.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year === "all" ? "All years" : year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-xs text-black hover:text-black"
                  onClick={() => {
                    setProjectSearch("");
                    setProjectStatus("all");
                    setProjectYear("all");
                  }}
                >
                  Reset all
                </Button>
              </div>
            </div>

            {projectSearch || projectStatus !== "all" || projectYear !== "all" ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-black">
                  Active Filters
                </span>
                {projectSearch ? (
                  <button
                    type="button"
                    className="rounded-full border border-black/20 bg-zinc-100 px-3 py-1 text-xs font-semibold text-black"
                    onClick={() => setProjectSearch("")}
                  >
                    Search: "{projectSearch}" x
                  </button>
                ) : null}
                {projectStatus !== "all" ? (
                  <button
                    type="button"
                    className="rounded-full border border-black/20 bg-zinc-100 px-3 py-1 text-xs font-semibold text-black"
                    onClick={() => setProjectStatus("all")}
                  >
                    Status: {projectStatus} x
                  </button>
                ) : null}
                {projectYear !== "all" ? (
                  <button
                    type="button"
                    className="rounded-full border border-black/20 bg-zinc-100 px-3 py-1 text-xs font-semibold text-black"
                    onClick={() => setProjectYear("all")}
                  >
                    Year: {projectYear} x
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardContent>

        <CardContent className="p-0">
          <div className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader className="bg-zinc-50/80 text-zinc-600">
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Project Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredProjects.map((project, index) => (
                  <TableRow key={project.id || index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{project.title || "-"}</TableCell>
                    <TableCell className="capitalize">{project.status || "-"}</TableCell>
                    <TableCell>{project.year || "-"}</TableCell>
                    <TableCell>{project.organization || "-"}</TableCell>
                    <TableCell>
                      {project.updatedAt ? new Date(project.updatedAt).toLocaleString() : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
