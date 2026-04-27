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
    <div className="relative overflow-hidden rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-50 via-white to-blue-50 p-6 shadow-sm">
      <div className="pointer-events-none absolute -right-20 -top-16 h-52 w-52 rounded-full bg-blue-200/45 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-blue-200/50 blur-3xl" />
      <div className="relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1E3A8A]">
              Admin Workspace
            </p>
            <h1 className="text-2xl font-bold text-[#1E3A8A] md:text-3xl">
              Department Workspace
            </h1>
            <p className="max-w-2xl text-sm text-[#1E3A8A]">
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
                  className="border-blue-200 bg-white text-[#1E3A8A] hover:bg-blue-50 active:bg-blue-100"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-white border border-blue-200 shadow-md"
              >
                <DropdownMenuItem
                  className="text-[#1E3A8A] hover:bg-blue-50 focus:bg-blue-50"
                  onSelect={onExportCsv}
                >
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[#1E3A8A] hover:bg-blue-50 focus:bg-blue-50"
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
