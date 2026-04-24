import { Search } from "lucide-react";
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
import PaginationControls from "@/components/navigation/PaginationControls";
import { PROJECT_PAGE_SIZE } from "../constants";

export default function ProjectsPanel({
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
    <Card className="overflow-hidden border-blue-200/80 shadow-sm">
      <CardHeader className="space-y-4 border-b border-blue-100 bg-blue-50/35 px-6 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-[#1E3A8A]">
              Linked Projects
            </CardTitle>
            <CardDescription>
              {filteredRows.length} project(s) matched for {center.name}.
            </CardDescription>
          </div>
          <label className="relative w-full lg:max-w-md">
            <span className="sr-only">Search projects</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1E3A8A]" />
            <Input
              className="border-blue-200 bg-white pl-8"
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
            <SelectTrigger className="border-blue-200 bg-white">
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
            <SelectTrigger className="border-blue-200 bg-white">
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
                <div className="h-4 w-44 rounded-full bg-blue-100/80" />
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={`project-skeleton-${index}`}
                    className="h-12 w-full rounded-lg bg-blue-100/70"
                  />
                ))}
              </div>
            </div>
          ) : error ? (
            <p className="p-4 text-sm text-[#1E3A8A]">{error}</p>
          ) : filteredRows.length === 0 ? (
            <p className="p-4 text-sm text-[#1E3A8A]">
              No projects matched the current filters.
            </p>
          ) : (
            <Table>
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
                      project.id || project.name || `${project.title}-${index}`
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
