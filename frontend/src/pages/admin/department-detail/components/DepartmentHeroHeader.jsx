import { Badge } from "@/components/ui/badge";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { FolderKanban, Users } from "lucide-react";

export default function DepartmentHeroHeader({ department, initials, usage }) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-gradient-to-r from-white via-white to-blue-50 p-5 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-lg font-bold uppercase text-white shadow-sm">
          {initials}
        </div>
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold text-slate-900">
            {department?.name || "Department"}
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Code:{" "}
            <span className="font-mono font-semibold text-slate-700">
              {department?.code || "-"}
            </span>
            {" - "}
            Chairperson:{" "}
            <span className="font-semibold text-slate-700">
              {department?.chairpersonName || "-"}
            </span>
          </CardDescription>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-2">
              <Users className="h-4 w-4" />
              {usage.profileCount} affiliates
            </Badge>
            <Badge variant="secondary" className="gap-2">
              <FolderKanban className="h-4 w-4" />
              {usage.projectCount} projects
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
