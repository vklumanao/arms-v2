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

export default function AffiliatesDirectoryContent({
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
    <Card className="overflow-hidden border-blue-200/80 shadow-sm">
      <CardContent className="p-4">
        {dataLoading ? (
          viewMode === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: directorySkeletonCount }).map((_, index) => (
                <Card key={`affiliate-skeleton-grid-${index}`} className="rounded-2xl border border-blue-200/80 bg-white/80 p-5 shadow-sm">
                  <div className="animate-pulse space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-full space-y-2">
                        <div className="h-3 w-24 rounded-full bg-zinc-200/80" />
                        <div className="h-5 w-3/4 rounded-full bg-blue-100/80" />
                        <div className="h-3 w-1/2 rounded-full bg-blue-100/70" />
                      </div>
                      <div className="h-6 w-16 rounded-full bg-blue-100/80" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-6 w-20 rounded-full bg-blue-100/80" />
                      <div className="h-6 w-24 rounded-full bg-blue-100/80" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-24 rounded-lg bg-blue-100/70" />
                      <div className="h-24 rounded-lg bg-blue-100/70" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-9 w-9 rounded-lg bg-blue-100/80" />
                      <div className="h-9 w-9 rounded-lg bg-blue-100/80" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-blue-200/80 bg-white shadow-sm p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-8 w-full rounded-lg bg-blue-100/70" />
                {Array.from({ length: directorySkeletonCount }).map((_, index) => (
                  <div key={`affiliate-skeleton-list-${index}`} className="h-12 w-full rounded-lg bg-blue-100/70" />
                ))}
              </div>
            </div>
          )
        ) : null}

        {!dataLoading && filteredRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-8 text-center text-sm text-slate-600">
            No affiliate records found.
          </div>
        ) : null}

        {!dataLoading && viewMode === "grid" && filteredRows.length > 0 ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pagination.items.map((row, index) => (
                <Card
                  key={row.id || `${row.email}-${index}`}
                  className="group rounded-2xl border border-blue-200/80 bg-gradient-to-b from-white to-blue-50/50 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#1E3A8A]">
                          #{pagination.start + index + 1} - {String(row.role || "affiliate")}
                        </p>
                        <h3 className="mt-1 truncate text-base font-bold text-[#1E3A8A]">{row.full_name || "-"}</h3>
                        <p className="mt-1 truncate text-sm text-[#1E3A8A]">{row.email || "-"}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="bg-blue-50 text-[#1E3A8A]">
                        Dept: {row.department || "-"}
                      </Badge>
                      <Badge variant="outline" className="border-blue-200/80 text-[#1E3A8A]">
                        Center: {row.ckan_org_id ? centerNameById[row.ckan_org_id] || "-" : "-"}
                      </Badge>
                      <Badge variant="secondary" className="bg-blue-50 text-[#1E3A8A]">
                        GS: {row.is_gs_faculty ? "Yes" : "No"}
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-blue-200/80 bg-blue-100/70 p-3 text-left">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1E3A8A]">Projects</p>
                        <p className="mt-2 text-2xl font-bold text-[#1E3A8A]">{Number(row.research_project_count || 0)}</p>
                        <p className="mt-1 text-xs text-[#1E3A8A]">Publications {Number(row.publication_count || 0)}</p>
                      </div>

                      <div className="rounded-lg border border-blue-200/80 bg-blue-100/70 p-3 text-left">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1E3A8A]">Outputs</p>
                        <p className="mt-2 text-2xl font-bold text-[#1E3A8A]">{Number(row.awards_count || 0)}</p>
                        <p className="mt-1 text-xs text-[#1E3A8A]">
                          IPs {Number(row.ip_count || 0)} - Works {Number(row.creative_work_count || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => goToAffiliateDetail(row)}>
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
                          title={row.source === "ckan_only" ? "Edit disabled (CKAN only)" : "Edit"}
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
          <div className="overflow-x-auto rounded-2xl border border-blue-200/70 bg-white shadow-sm">
            <Table>
              <TableHeader className="bg-blue-50/80">
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
                    <TableCell className="text-slate-600">{pagination.start + index + 1}</TableCell>
                    <TableCell>
                      <p className="font-semibold text-[#1E3A8A]">{row.full_name || "-"}</p>
                      <p className="text-xs text-slate-500">{row.email || "-"}</p>
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {row.ckan_org_id ? centerNameById[row.ckan_org_id] || "-" : "-"}
                    </TableCell>
                    <TableCell className="text-slate-700">{row.department || "-"}</TableCell>
                    <TableCell className="capitalize text-slate-700">{row.role || "-"}</TableCell>
                    <TableCell className="text-slate-700">{row.is_gs_faculty ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-slate-700">{Number(row.research_project_count || 0)}</TableCell>
                    <TableCell className="text-slate-700">{Number(row.awards_count || 0)}</TableCell>
                    <TableCell className="text-slate-700">{Number(row.publication_count || 0)}</TableCell>
                    <TableCell className="text-slate-700">{Number(row.ip_count || 0)}</TableCell>
                    <TableCell className="text-slate-700">{Number(row.creative_work_count || 0)}</TableCell>
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
                            title={row.source === "ckan_only" ? "Edit disabled (CKAN only)" : "Edit"}
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
                    <TableCell colSpan={12} className="px-3 py-3">
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
        ) : null}
      </CardContent>
    </Card>
  );
}
