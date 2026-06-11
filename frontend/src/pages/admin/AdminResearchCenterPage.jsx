import { useState } from "react";
import {
  Building2,
  Download,
  Eye,
  FolderKanban,
  List,
  RotateCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  DirectoryPanel,
  CreateResearchCenterDialog,
} from "./research-centers/components/ResearchCenterWorkspacePanels";
import useAdminResearchCenterWorkspace from "./research-centers/hooks/useAdminResearchCenterWorkspace.jsx";

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
    goToCenterDetail,
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
    syncResearchCenters,
    INITIAL_FILTERS,
  } = useAdminResearchCenterWorkspace();
  const [mobileDirectoryOpen, setMobileDirectoryOpen] = useState(false);
  const selectedProjectCount =
    workspaceCenterRow?.projectCount ??
    workspaceCenterRow?.projectsCount ??
    workspaceCenterRow?.linkedProjectsCount ??
    0;
  const selectedAffiliateCount =
    workspaceCenterRow?.profileCount ??
    workspaceCenterRow?.affiliatesCount ??
    workspaceCenterRow?.memberCount ??
    0;
  const selectedAgendaCount = workspaceCenterRow?.agendaCount ?? 0;

  return (
    <section className="page-stack-lg">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 sm:py-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {isScopedCenterChief ? "My Research Center" : "Admin Workspace"}
            </p>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Research Centers
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                {isScopedCenterChief
                  ? "Review your assigned research center, including its members, projects, agendas, and supporting records."
                  : "Manage center records, members, agendas, and related workspace details from a single view."}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={exporting || filteredRows.length === 0}
                  className="min-h-10 w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 sm:w-auto"
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
                className="min-h-10 w-full sm:w-auto"
                onClick={() => {
                  setCreateErrors({});
                  setCreateModalOpen(true);
                }}
              >
                Create Research Center
              </Button>
            ) : null}

            {!isScopedCenterChief ? (
              <Button
                variant="outline"
                className="min-h-10 w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50 sm:w-auto"
                onClick={() => void syncResearchCenters()}
                disabled={actionLoading}
              >
                <RotateCw
                  className={actionLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                />
                Sync from CKAN
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
            className="min-h-10 w-full justify-start border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
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
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">
                  Directory
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Browse and switch between research centers.
                </p>
              </div>
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
                embedded
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-5 px-4 py-4 sm:px-5 sm:py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Selected Center
                  </p>
                  {workspaceCenterRow ? (
                    <p className="pb-1 text-sm text-slate-500">
                      {workspaceCenterRow.code || "No Code"}
                    </p>
                  ) : null}
                  <CardTitle className="text-xl font-semibold text-slate-900 sm:text-2xl">
                    {workspaceCenterRow?.name || "Select a Research Center"}
                  </CardTitle>
                  <CardDescription className="max-w-3xl text-sm leading-6 text-slate-600">
                    {workspaceCenterRow
                      ? workspaceCenterRow.description ||
                        "No description has been added for this research center yet."
                      : "Choose a center from the directory to load its workspace."}
                  </CardDescription>
                  {workspaceCenterRow ? (
                    <p className="pt-1 text-sm text-slate-600">
                      Center Chief:{" "}
                      <span className="font-medium text-slate-900">
                        {workspaceCenterRow.centerChiefName || "-"}
                      </span>
                    </p>
                  ) : null}
                </div>

                {workspaceCenterRow ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      className="min-h-10 border-slate-300 text-slate-700 hover:bg-slate-50"
                      onClick={() => goToCenterDetail(workspaceCenterRow)}
                    >
                      <Eye className="h-4 w-4" />
                      Open Full Profile
                    </Button>
                  </div>
                ) : null}
              </div>

              {!workspaceCenterRow ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center">
                  <Building2 className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-3 text-base font-medium text-slate-900">
                    Select a research center
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose a center from the directory to view its details,
                    members, projects, and agendas.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center gap-2 text-slate-500">
                      <FolderKanban className="h-4 w-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                        Projects
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {selectedProjectCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Users className="h-4 w-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                        Affiliates
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {selectedAffiliateCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(240,253,244,0.88))] px-4 py-4">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Building2 className="h-4 w-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                        Agendas
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {selectedAgendaCount}
                    </p>
                  </div>
                </div>
              )}
            </CardHeader>
          </Card>
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
              embedded
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
