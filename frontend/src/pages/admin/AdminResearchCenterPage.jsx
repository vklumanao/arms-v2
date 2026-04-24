import { useState } from "react";
import { Download, Eye, List, Pencil, Sparkles } from "lucide-react";
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
    <section className="page-stack-lg pb-24 md:pb-0">
      <div className="relative overflow-hidden rounded-[1.5rem] border border-blue-200/80 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(255,255,255,0.98),rgba(236,253,245,0.86))] p-4 shadow-[0_28px_80px_rgba(30,58,138,0.12)] sm:rounded-[2rem] sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-16 h-56 w-56 rounded-full bg-blue-200/45 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <Badge className="w-fit border-blue-200 bg-white/80 px-3 py-1 text-[#1E3A8A] hover:bg-white/80">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              {isScopedCenterChief ? "My Research Center" : "Admin Workspace"}
            </Badge>
            <div>
              <h1 className="text-xl font-bold text-[#1E3A8A] sm:text-2xl md:text-3xl">
                Research Center Workspace
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-[#1E3A8A]">
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
                  className="border-blue-200 bg-white text-[#1E3A8A] hover:bg-blue-50 active:bg-blue-100"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="border border-blue-200 bg-white shadow-md"
              >
                <DropdownMenuItem
                  className="text-[#1E3A8A] hover:bg-blue-50 focus:bg-blue-50"
                  onSelect={() => exportRowsAsCsv(filteredRows, "filtered")}
                >
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[#1E3A8A] hover:bg-blue-50 focus:bg-blue-50"
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
            className="min-h-11 w-full justify-start border-blue-200 bg-white text-[#1E3A8A] hover:bg-blue-50"
            onClick={() => setMobileDirectoryOpen(true)}
          >
            <List className="h-4 w-4" />
            {workspaceCenterRow?.name ? `Change Center: ${workspaceCenterRow.name}` : "Select Research Center"}
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
          <Card className="overflow-hidden border-blue-200/80 bg-white/95 shadow-[0_24px_64px_rgba(30,58,138,0.10)]">
            <CardHeader className="space-y-4 border-b border-blue-100 bg-white px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1E3A8A]">
                    Selected Workspace
                  </p>
                  <CardTitle className="text-2xl font-bold text-[#1E3A8A]">
                    {workspaceCenterRow?.name || "Select a Research Center"}
                  </CardTitle>
                  <CardDescription>
                    {workspaceCenterRow
                      ? `Work on ${workspaceCenterRow.name} without leaving the broader research center context.`
                      : "Choose a center from the directory to load its workspace."}
                  </CardDescription>
                </div>

                {workspaceCenterRow ? (
                  <div className="hidden flex-wrap items-center gap-2 md:flex">
                    <Button
                      variant="outline"
                      className="border-blue-200 text-[#1E3A8A] hover:bg-blue-50"
                      onClick={() => goToCenterDetail(workspaceCenterRow)}
                    >
                      <Eye className="h-4 w-4" />
                      Open
                    </Button>
                    {!isScopedCenterChief ? (
                      <Button
                        variant="outline"
                        className="border-blue-200 text-[#1E3A8A] hover:bg-blue-50"
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
                        ? "border-blue-200 bg-blue-100 text-[#1E3A8A]"
                        : "border-blue-200 bg-white text-[#1E3A8A] hover:bg-blue-50",
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
              <div className="h-24 animate-pulse rounded-[1.7rem] bg-blue-100/70" />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-40 animate-pulse rounded-[1.5rem] bg-blue-100/70" />
                <div className="h-40 animate-pulse rounded-[1.5rem] bg-blue-100/70" />
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
            className="w-[92vw] max-w-none overflow-y-auto border-r border-blue-200 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] p-3 sm:max-w-lg"
          >
            <SheetHeader className="px-2 pb-2">
              <SheetTitle className="text-[#1E3A8A]">Select Research Center</SheetTitle>
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

      {workspaceCenterRow ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-blue-200 bg-white/95 p-3 shadow-[0_-8px_28px_rgba(30,58,138,0.12)] backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-4xl gap-2">
            <Button
              variant="outline"
              className="min-h-11 flex-1 border-blue-200 text-[#1E3A8A] hover:bg-blue-50"
              onClick={() => goToCenterDetail(workspaceCenterRow)}
            >
              <Eye className="h-4 w-4" />
              Open
            </Button>
            {!isScopedCenterChief ? (
              <Button
                variant="outline"
                className="min-h-11 flex-1 border-blue-200 text-[#1E3A8A] hover:bg-blue-50"
                onClick={() => startInlineEdit(workspaceCenterRow)}
              >
                <Pencil className="h-4 w-4" />
                Edit Inline
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmActionModal
        open={Boolean(deletingRow)}
        title={
          <span className="text-base font-semibold text-[#1E3A8A]">
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
        className="border border-blue-200 bg-white text-[#1E3A8A] shadow-md"
        cancelButtonClassName="border border-blue-200 bg-white text-[#1E3A8A] hover:bg-blue-50 active:bg-blue-100"
        confirmButtonClassName="bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] active:bg-[#1E3A8A] disabled:bg-slate-300 disabled:text-slate-500"
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
