import { Eye, FolderKanban, Pencil, Trash2, Users } from "lucide-react";
import { cn } from "@/utils/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PaginationControls from "@/components/navigation/PaginationControls";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DepartmentWorkspaceHero({
  exporting,
  filteredCount,
  onExportCsv,
  onExportPdf,
  onOpenCreate,
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Admin Workspace
            </p>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
              Department Workspace
            </h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Manage department records, monitor affiliations, and track project
              coverage from one control panel.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={exporting || filteredCount === 0}
                  className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="border border-slate-200 bg-white shadow-md"
              >
                <DropdownMenuItem
                  className="text-slate-700 hover:bg-slate-50 focus:bg-slate-50"
                  onSelect={onExportCsv}
                >
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-slate-700 hover:bg-slate-50 focus:bg-slate-50"
                  onSelect={onExportPdf}
                >
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="mono" onClick={onOpenCreate}>
              Create Department
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DepartmentDirectoryContent({
  dataLoading,
  viewMode,
  directorySkeletonCount,
  filteredRows,
  paginatedRows,
  currentPage,
  pageSize,
  totalPages,
  setCurrentPage,
  goToDepartmentDetail,
  startEdit,
  setDeletingRow,
  toggleSort,
  getSortIndicator,
}) {
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardContent className="p-4">
        {dataLoading ? (
          viewMode === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: directorySkeletonCount }).map((_, index) => (
                <Card key={`department-skeleton-grid-${index}`} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="animate-pulse space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-full space-y-2">
                        <div className="h-3 w-24 rounded-full bg-zinc-200/80" />
                        <div className="h-5 w-3/4 rounded-full bg-slate-200" />
                        <div className="h-3 w-1/2 rounded-full bg-slate-200" />
                      </div>
                      <div className="h-6 w-16 rounded-full bg-slate-200" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-6 w-20 rounded-full bg-slate-200" />
                      <div className="h-6 w-24 rounded-full bg-slate-200" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-24 rounded-lg bg-slate-200" />
                      <div className="h-24 rounded-lg bg-slate-200" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-9 w-9 rounded-lg bg-slate-200" />
                      <div className="h-9 w-9 rounded-lg bg-slate-200" />
                      <div className="h-9 w-9 rounded-lg bg-slate-200" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="animate-pulse space-y-3">
                <div className="h-8 w-full rounded-lg bg-slate-200" />
                {Array.from({ length: directorySkeletonCount }).map((_, index) => (
                  <div key={`department-skeleton-list-${index}`} className="h-12 w-full rounded-lg bg-slate-200" />
                ))}
              </div>
            </div>
          )
        ) : null}

        {!dataLoading && filteredRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
            No department records found.
          </div>
        ) : null}

        {!dataLoading && viewMode === "grid" ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {paginatedRows.map((row, index) => (
                <Card key={`${row.tag}-${row.id}`} className="group rounded-md border border-slate-200 bg-white">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                          #{(currentPage - 1) * pageSize + index + 1} - {row.type}
                        </p>
                        <h3 className="mt-1 truncate text-base font-bold text-slate-900">{row.name}</h3>
                        <p className="mt-1 truncate text-sm text-slate-600">
                          Chairperson: <span className="font-semibold text-slate-800">{row.chairpersonName || "-"}</span>
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 font-mono">
                        {row.code}
                      </Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                        Links: {row.totalLinks || 0}
                      </Badge>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                        Affiliates: {row.profileCount || 0}
                      </Badge>
                      <Badge variant="outline" className="border-slate-300 text-slate-700">
                        Projects: {row.projectCount || 0}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        className={cn(
                          "rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition-colors",
                          "hover:bg-slate-100",
                        )}
                        onClick={() => goToDepartmentDetail(row, "affiliates")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">Affiliates</p>
                          <Users className="h-4 w-4 text-slate-600" />
                        </div>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{row.profileCount}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Admin {row.memberBreakdown?.adminCount || 0} - Editor {row.memberBreakdown?.editorCount || 0} - Member {row.memberBreakdown?.memberCount || 0}
                        </p>
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition-colors",
                          "hover:bg-slate-100",
                        )}
                        onClick={() => goToDepartmentDetail(row, "projects")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">Projects</p>
                          <FolderKanban className="h-4 w-4 text-slate-600" />
                        </div>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{row.projectCount}</p>
                        <p className="mt-1 text-xs text-slate-500">Linked research projects.</p>
                      </button>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => goToDepartmentDetail(row)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => startEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-9 w-9 text-slate-700 hover:bg-slate-100" onClick={() => setDeletingRow(row)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {totalPages > 1 ? (
              <div className="mt-3">
                <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} className="border-0 rounded-none shadow-none bg-transparent" />
              </div>
            ) : null}
          </>
        ) : !dataLoading ? (
          <div className="rounded-md border border-slate-200 bg-white shadow-sm">
            <Table className="min-w-[980px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort("code")}>
                      Code {getSortIndicator("code")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort("name")}>
                      Department {getSortIndicator("name")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort("chairpersonName")}>
                      Chairperson {getSortIndicator("chairpersonName")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort("profileCount")}>
                      Affiliates {getSortIndicator("profileCount")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort("projectCount")}>
                      Projects {getSortIndicator("projectCount")}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map((row, index) => (
                  <TableRow key={`${row.tag}-${row.id}`}>
                    <TableCell>{(currentPage - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.chairpersonName || "-"}</TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="sm" onClick={() => goToDepartmentDetail(row, "affiliates")}>{row.profileCount}</Button>
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="sm" onClick={() => goToDepartmentDetail(row, "projects")}>{row.projectCount}</Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => goToDepartmentDetail(row)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => startEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingRow(row)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {totalPages > 1 ? (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={7} className="px-3 py-3">
                      <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} className="border-0 rounded-none shadow-none bg-transparent" />
                    </TableCell>
                  </TableRow>
                </TableFooter>
              ) : null}
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
