import { Download, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AffiliatesWorkspaceHero({
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
