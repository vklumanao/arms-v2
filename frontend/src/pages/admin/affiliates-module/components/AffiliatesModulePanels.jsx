import { Eye, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PaginationControls from "@/components/navigation/PaginationControls";
import { Download, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AffiliatesWorkspaceHero({
  canExportAffiliates,
  filteredCount,
  exportingType,
  affiliateMetrics,
  onExportCsv,
  onExportPdf,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Admin Workspace
            </p>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
              Affiliate Workspace
            </h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Manage affiliate records, review membership status, and export
              directory reports from one panel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canExportAffiliates ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!filteredCount || Boolean(exportingType)}
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
                    disabled={!filteredCount || Boolean(exportingType)}
                  >
                    {exportingType === "csv" ? "Exporting..." : "Export CSV"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-slate-700 hover:bg-slate-50 focus:bg-slate-50"
                    onSelect={onExportPdf}
                    disabled={!filteredCount || Boolean(exportingType)}
                  >
                    {exportingType === "pdf" ? "Exporting..." : "Export PDF"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Affiliates
              </p>
              <Users className="h-4 w-4 text-slate-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {affiliateMetrics.total}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Active
              </p>
              <Users className="h-4 w-4 text-slate-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {affiliateMetrics.active}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                GS Faculty
              </p>
              <Users className="h-4 w-4 text-slate-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {affiliateMetrics.gsFaculty}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AffiliatesDirectoryContent({
  dataLoading,
  viewMode,
  directorySkeletonCount,
  filteredRows,
  pagination,
  currentPage,
  setCurrentPage,
  centerNameById,
  canEditAffiliates,
  goToAffiliateDetail,
  openEditModal,
}) {
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardContent className="p-4">
        {dataLoading ? (
          viewMode === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: directorySkeletonCount }).map((_, index) => (
                <Card
                  key={`affiliate-skeleton-grid-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm"
                >
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
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-8 w-full rounded-lg bg-slate-200" />
                {Array.from({ length: directorySkeletonCount }).map(
                  (_, index) => (
                    <div
                      key={`affiliate-skeleton-list-${index}`}
                      className="h-12 w-full rounded-lg bg-slate-200"
                    />
                  ),
                )}
              </div>
            </div>
          )
        ) : null}

        {!dataLoading && filteredRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
            No affiliate records found.
          </div>
        ) : null}

        {!dataLoading && viewMode === "grid" && filteredRows.length > 0 ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pagination.items.map((row, index) => (
                <Card
                  key={row.id || `${row.email}-${index}`}
                  className="group rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
                          #{pagination.start + index + 1} -{" "}
                          {String(row.role || "affiliate")}
                        </p>
                        <h3 className="mt-1 truncate text-base font-bold text-slate-700">
                          {row.full_name || "-"}
                        </h3>
                        <p className="mt-1 truncate text-sm text-slate-700">
                          {row.email || "-"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="bg-slate-50 text-slate-700">
                        Dept: {row.department || "-"}
                      </Badge>
                      <Badge variant="outline" className="border-slate-200 text-slate-700">
                        Center:{" "}
                        {row.ckan_org_id
                          ? centerNameById[row.ckan_org_id] || "-"
                          : "-"}
                      </Badge>
                      <Badge variant="secondary" className="bg-slate-50 text-slate-700">
                        GS: {row.is_gs_faculty ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-200 p-3 text-left">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                          Projects
                        </p>
                        <p className="mt-2 text-2xl font-bold text-slate-700">
                          {Number(row.research_project_count || 0)}
                        </p>
                        <p className="mt-1 text-xs text-slate-700">
                          Publications {Number(row.publication_count || 0)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-200 p-3 text-left">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                          Outputs
                        </p>
                        <p className="mt-2 text-2xl font-bold text-slate-700">
                          {Number(row.awards_count || 0)}
                        </p>
                        <p className="mt-1 text-xs text-slate-700">
                          IPs {Number(row.ip_count || 0)} - Works{" "}
                          {Number(row.creative_work_count || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => goToAffiliateDetail(row)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEditAffiliates ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          disabled={row.source === "ckan_only"}
                          onClick={() => openEditModal(row)}
                          title={
                            row.source === "ckan_only"
                              ? "Edit disabled (CKAN only)"
                              : "Edit"
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {pagination.totalPages > 1 ? (
              <div className="mt-3">
                <PaginationControls
                  page={currentPage}
                  totalPages={pagination.totalPages}
                  onPageChange={setCurrentPage}
                  className="border-0 rounded-none shadow-none bg-transparent"
                />
              </div>
            ) : null}
          </>
        ) : null}

        {!dataLoading && viewMode === "list" && filteredRows.length > 0 ? (
          <>
            <div className="space-y-3 md:hidden">
              {pagination.items.map((row, index) => (
                <Card
                  key={row.id || `${row.email}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <CardContent className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                      #{pagination.start + index + 1} -{" "}
                      {String(row.role || "affiliate")}
                    </p>
                    <h3 className="mt-1 text-base font-bold text-slate-700">
                      {row.full_name || "-"}
                    </h3>
                    <p className="truncate text-sm text-slate-600">
                      {row.email || "-"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="bg-slate-50 text-slate-700">
                        {row.department || "-"}
                      </Badge>
                      <Badge variant="outline" className="border-slate-200 text-slate-700">
                        {row.ckan_org_id
                          ? centerNameById[row.ckan_org_id] || "-"
                          : "-"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                          Pubs
                        </p>
                        <p className="text-sm font-bold text-slate-700">
                          {Number(row.publication_count || 0)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                          Projects
                        </p>
                        <p className="text-sm font-bold text-slate-700">
                          {Number(row.research_project_count || 0)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                          Awards
                        </p>
                        <p className="text-sm font-bold text-slate-700">
                          {Number(row.awards_count || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 border-slate-200 text-slate-700"
                        onClick={() => goToAffiliateDetail(row)}
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                      {canEditAffiliates ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 border-slate-200 text-slate-700"
                          disabled={row.source === "ckan_only"}
                          onClick={() => openEditModal(row)}
                          title={
                            row.source === "ckan_only"
                              ? "Edit disabled (CKAN only)"
                              : "Edit"
                          }
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {pagination.totalPages > 1 ? (
                <PaginationControls
                  page={currentPage}
                  totalPages={pagination.totalPages}
                  onPageChange={setCurrentPage}
                  className="border-0 rounded-none bg-transparent shadow-none"
                />
              ) : null}
            </div>
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Research Center</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>GS Faculty</TableHead>
                    <TableHead>Projects</TableHead>
                    <TableHead>Awards</TableHead>
                    <TableHead>Publications</TableHead>
                    <TableHead>IPs</TableHead>
                    <TableHead>Creative Works</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.items.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-slate-600">
                        {pagination.start + index + 1}
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold text-slate-700">
                          {row.full_name || "-"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.email || "-"}
                        </p>
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {row.ckan_org_id
                          ? centerNameById[row.ckan_org_id] || "-"
                          : "-"}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {row.department || "-"}
                      </TableCell>
                      <TableCell className="capitalize text-slate-700">
                        {row.role || "-"}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {row.is_gs_faculty ? "Yes" : "No"}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {Number(row.research_project_count || 0)}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {Number(row.awards_count || 0)}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {Number(row.publication_count || 0)}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {Number(row.ip_count || 0)}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {Number(row.creative_work_count || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => goToAffiliateDetail(row)}
                            aria-label={`View ${row?.full_name || "affiliate"}`}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEditAffiliates ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={row.source === "ckan_only"}
                              onClick={() => openEditModal(row)}
                              aria-label={`Edit ${row?.full_name || "affiliate"}`}
                              title={
                                row.source === "ckan_only"
                                  ? "Edit disabled (CKAN only)"
                                  : "Edit"
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {pagination.totalPages > 1 ? (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={12} className="p-0">
                        <PaginationControls
                          page={currentPage}
                          totalPages={pagination.totalPages}
                          onPageChange={setCurrentPage}
                          className="border-0 rounded-none shadow-none bg-transparent"
                        />
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                ) : null}
              </Table>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
