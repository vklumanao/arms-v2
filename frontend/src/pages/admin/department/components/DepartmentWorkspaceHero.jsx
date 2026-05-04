import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function DepartmentWorkspaceHero({
  exporting,
  filteredCount,
  onExportCsv,
  onExportPdf,
  onOpenCreate,
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
