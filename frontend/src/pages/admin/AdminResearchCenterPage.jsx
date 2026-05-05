import { useState } from "react";
import { Download, Eye, List, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";
import { cn } from "@/utils/cn";
import DirectoryPanel from "./research-centers/components/DirectoryPanel";
import CreateResearchCenterDialog from "./research-centers/components/CreateResearchCenterDialog";
import useAdminResearchCenterWorkspace from "./research-centers/hooks/useAdminResearchCenterWorkspace";

export default function AdminResearchCenterPage() {
  const {
    isScopedCenterChief,
    dataLoading,
    filters,
    setFilters,
    quickFilter,
    setQuickFilter,
    filteredRows,
    paginatedRows,
    quickFilterChips,
    selectedCenterRow,
    setSelectedCenterId,
    dashboardMetrics,
    currentPage,
    totalPages,
    setCurrentPage,
    exporting,
    exportRowsAsCsv,
    exportRowsAsPdf,
    setCreateErrors,
    setCreateModalOpen,
    workspaceCenterRow,
    workspaceTabs,
    activeWorkspaceTab,
    setActiveWorkspaceTab,
    goToCenterDetail,
    startInlineEdit,
    workspaceContent,
    deletingRow,
    setDeletingRow,
    deleteGuard,
    actionLoading,
    confirmDelete,
    createModalOpen,
    createLoading,
    centerChiefUsers,
    createDialogValues,
    createErrors,
    isCreateFormValid,
    updateCreateValues,
    addResearchAgenda,
    removeResearchAgenda,
    createResearchCenter,
    INITIAL_FILTERS,
  } = useAdminResearchCenterWorkspace();
  const [mobileDirectoryOpen, setMobileDirectoryOpen] = useState(false);

  return (
    <section className="page-stack-lg">
      <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {isScopedCenterChief ? "My Research Center" : "Admin Workspace"}
            </p>
            <div>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl md:text-3xl">
                Research Center Workspace
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                {isScopedCenterChief
                  ? "Review the current state of your assigned research center, including member activity, linked projects, and agenda coverage."
                  : "Manage the directory from a split-view console. Select a center on the left, then review members, projects, agendas, and settings without leaving the page."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={exporting || filteredRows.length === 0}
                  className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="border border-slate-300 bg-white shadow-md"
              >
                <DropdownMenuItem
                  className="text-slate-700 hover:bg-slate-50 focus:bg-slate-50"
                  onSelect={() => exportRowsAsCsv(filteredRows, "filtered")}
                >
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-slate-700 hover:bg-slate-50 focus:bg-slate-50"
                  onSelect={() => exportRowsAsPdf(filteredRows, "filtered")}
                >
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {!isScopedCenterChief ? (
              <Button
                variant="mono"
                className="min-h-11"
                onClick={() => {
                  setCreateErrors({});
                  setCreateModalOpen(true);
                }}
              >
                Create Research Center
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {!isScopedCenterChief ? (
        <div className="xl:hidden">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full justify-start border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            onClick={() => setMobileDirectoryOpen(true)}
          >
            <List className="h-4 w-4" />
            {workspaceCenterRow?.name
              ? `Change Center: ${workspaceCenterRow.name}`
              : "Select Research Center"}
          </Button>
        </div>
      ) : null}

      <div
        className={cn(
          "grid gap-5",
          isScopedCenterChief ? "" : "xl:grid-cols-[360px_minmax(0,1fr)]",
        )}
      >
        {!isScopedCenterChief ? (
          <div className="hidden xl:block">
            <DirectoryPanel
              rows={filteredRows}
              paginatedRows={paginatedRows}
              filters={filters}
              onSearchChange={(search) => setFilters({ search })}
              quickFilter={quickFilter}
              onQuickFilterChange={setQuickFilter}
              onResetFilters={() => {
                setQuickFilter("all");
                setFilters(INITIAL_FILTERS);
              }}
              quickFilterChips={quickFilterChips}
              selectedCenterId={selectedCenterRow?.id}
              onSelectCenter={setSelectedCenterId}
              metrics={dashboardMetrics}
              dataLoading={dataLoading}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        ) : null}

        <div className="space-y-4">
          <Card className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
            <CardHeader className="space-y-4 border-b border-slate-100 bg-white px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Selected Workspace
                  </p>
                  {workspaceCenterRow ? (
                    <div className="flex flex-wrap items-center gap-2 pb-1">
                      <Badge className="border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-100">
                        {workspaceCenterRow.code || "No Code"}
                      </Badge>
                      <Badge className="border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-100">
                        Research Center
                      </Badge>
                    </div>
                  ) : null}
                  <CardTitle className="text-2xl font-bold text-slate-900">
                    {workspaceCenterRow?.name || "Select a Research Center"}
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    {workspaceCenterRow
                      ? workspaceCenterRow.description ||
                        "No description has been added for this research center yet. Use Settings to add positioning, summary copy, and public-facing links."
                      : "Choose a center from the directory to load its workspace."}
                  </CardDescription>
                  {workspaceCenterRow ? (
                    <div className="flex flex-wrap gap-4 pt-2 text-sm text-slate-600">
                      <span>
                        Center Chief:{" "}
                        {workspaceCenterRow.centerChiefName || "-"}
                      </span>
                      <span>Center ID: {workspaceCenterRow.id || "-"}</span>
                      <span>
                        Members Active: {workspaceCenterRow.profileCount || 0}
                      </span>
                    </div>
                  ) : null}
                </div>

                {workspaceCenterRow ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      className="border-slate-300 text-slate-700 hover:bg-slate-50"
                      onClick={() => goToCenterDetail(workspaceCenterRow)}
                    >
                      <Eye className="h-4 w-4" />
                      Open
                    </Button>
                    {!isScopedCenterChief ? (
                      <Button
                        variant="outline"
                        className="border-slate-300 text-slate-700 hover:bg-slate-50"
                        onClick={() => startInlineEdit(workspaceCenterRow)}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit Inline
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {workspaceTabs.map((tab) => (
                  <Button
                    key={tab.key}
                    type="button"
                    size="sm"
                    variant={
                      activeWorkspaceTab === tab.key ? "secondary" : "outline"
                    }
                    className={cn(
                      "min-h-11 shrink-0 rounded-full px-4",
                      activeWorkspaceTab === tab.key
                        ? "border-slate-300 bg-slate-100 text-slate-700"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                    )}
                    onClick={() => setActiveWorkspaceTab(tab.key)}
                    disabled={!workspaceCenterRow}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
            </CardHeader>
          </Card>

          {dataLoading && !workspaceCenterRow && !isScopedCenterChief ? (
            <div className="space-y-3">
              <div className="h-24 animate-pulse rounded-[1.7rem] bg-slate-200" />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-40 animate-pulse rounded-[1.5rem] bg-slate-200" />
                <div className="h-40 animate-pulse rounded-[1.5rem] bg-slate-200" />
              </div>
            </div>
          ) : (
            workspaceContent
          )}
        </div>
      </div>

      {!isScopedCenterChief ? (
        <Sheet open={mobileDirectoryOpen} onOpenChange={setMobileDirectoryOpen}>
          <SheetContent
            side="left"
            className="w-[92vw] max-w-none overflow-y-auto border-r border-slate-300 bg-white p-3 sm:max-w-lg"
          >
            <SheetHeader className="px-2 pb-2">
              <SheetTitle className="text-slate-700">
                Select Research Center
              </SheetTitle>
              <SheetDescription>
                Search and pin a center to open its workspace.
              </SheetDescription>
            </SheetHeader>
            <DirectoryPanel
              rows={filteredRows}
              paginatedRows={paginatedRows}
              filters={filters}
              onSearchChange={(search) => setFilters({ search })}
              quickFilter={quickFilter}
              onQuickFilterChange={setQuickFilter}
              onResetFilters={() => {
                setQuickFilter("all");
                setFilters(INITIAL_FILTERS);
              }}
              quickFilterChips={quickFilterChips}
              selectedCenterId={selectedCenterRow?.id}
              onSelectCenter={(centerId) => {
                setSelectedCenterId(centerId);
                setMobileDirectoryOpen(false);
              }}
              metrics={dashboardMetrics}
              dataLoading={dataLoading}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              useWindowedScroll={false}
            />
          </SheetContent>
        </Sheet>
      ) : null}

      <ConfirmActionModal
        open={Boolean(deletingRow)}
        title={
          <span className="text-base font-semibold text-slate-700">
            Delete Research Center
          </span>
        }
        message={
          <p className="text-sm leading-relaxed text-slate-600">
            {deleteGuard.message}
          </p>
        }
        confirmLabel={deleteGuard.confirmLabel}
        align="center"
        loading={deleteGuard.blocked ? false : actionLoading}
        onCancel={() => setDeletingRow(null)}
        onConfirm={
          deleteGuard.blocked ? () => setDeletingRow(null) : confirmDelete
        }
        className="border border-slate-300 bg-white text-slate-700 shadow-md"
        cancelButtonClassName="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100"
        confirmButtonClassName={
          deleteGuard.blocked
            ? "bg-[#10B981] text-white hover:bg-[#059669] active:bg-[#047857] disabled:bg-slate-300 disabled:text-slate-500"
            : "bg-[#F97316] text-white hover:bg-[#EA580C] active:bg-[#C2410C] disabled:bg-slate-300 disabled:text-slate-500"
        }
      />

      <CreateResearchCenterDialog
        open={createModalOpen}
        onOpenChange={(open) => {
          if (!open && !createLoading) {
            setCreateModalOpen(false);
            setCreateErrors({});
          }
        }}
        centerChiefUsers={centerChiefUsers}
        values={createDialogValues}
        errors={createErrors}
        loading={createLoading}
        isValid={isCreateFormValid}
        onFieldChange={updateCreateValues}
        onAddAgenda={addResearchAgenda}
        onRemoveAgenda={removeResearchAgenda}
        onSubmit={createResearchCenter}
      />
    </section>
  );
}
