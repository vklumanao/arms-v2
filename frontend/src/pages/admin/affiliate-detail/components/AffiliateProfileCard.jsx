import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FolderKanban, Users } from "lucide-react";

export default function AffiliateProfileCard({
  affiliate,
  initials,
  centerNameById,
  departmentLabel,
}) {
  return (
    <Card className="overflow-hidden border border-black/20 bg-white shadow-sm">
      <CardContent className="p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-xl font-bold uppercase text-white shadow">
              {initials}
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-zinc-900">
                {affiliate?.full_name || "-"}
              </h2>

              <p className="text-sm text-zinc-500">{affiliate?.email || "-"}</p>

              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary" className="gap-2 capitalize">
                  <Users className="h-4 w-4" />
                  {affiliate?.role}
                </Badge>

                <Badge
                  variant={affiliate?.is_active ? "secondary" : "destructive"}
                >
                  {affiliate?.is_active ? "Active" : "Inactive"}
                </Badge>

                <Badge variant="secondary" className="gap-2">
                  <FolderKanban className="h-4 w-4" />
                  {Number(affiliate?.research_project_count || 0)} Projects
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div>
              <p className="text-zinc-500">Research Center</p>
              <p className="font-semibold text-zinc-900">
                {affiliate?.ckan_org_id
                  ? centerNameById[affiliate.ckan_org_id] || "-"
                  : "-"}
              </p>
            </div>

            <div>
              <p className="text-zinc-500">Department</p>
              <p className="font-semibold text-zinc-900">{departmentLabel}</p>
            </div>

            <div>
              <p className="text-zinc-500">Employment Status</p>
              <p className="font-semibold text-zinc-900">
                {affiliate?.employment_status || "-"}
              </p>
            </div>

            <div>
              <p className="text-zinc-500">Designation</p>
              <p className="font-semibold text-zinc-900">
                {affiliate?.designation || "-"}
              </p>
            </div>

            <div>
              <p className="text-zinc-500">GS Faculty</p>
              <p className="font-semibold text-zinc-900">
                {affiliate?.is_gs_faculty ? "Yes" : "No"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
