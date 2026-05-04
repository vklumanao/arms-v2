import { FolderKanban, Layers3, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import MetricCard from "./MetricCard";

export default function WorkspaceOverview({ center, summary, agendaNames }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          icon={Users}
          label="Total Members"
          value={summary.totalMembers}
          caption={`${summary.activeMembers} active right now`}
        />
        <MetricCard
          icon={FolderKanban}
          label="Linked Projects"
          value={summary.linkedProjects}
          caption="Active project pipeline"
          tone="emerald"
        />
        <MetricCard
          icon={Layers3}
          label="Agendas"
          value={summary.totalAgendas}
          caption="Linked research directions"
          tone="amber"
        />
      </div>

      <div className="grid gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="space-y-1 border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
            <CardTitle className="text-lg font-bold text-slate-700">
              Agenda Highlights
            </CardTitle>
            <CardDescription>
              The leading agenda tags connected to the selected center.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {agendaNames.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {agendaNames.map((agendaName) => (
                  <Badge
                    key={`${center.id}-${agendaName}`}
                    variant="secondary"
                    className="rounded-full bg-slate-50 px-3 py-1 text-slate-700"
                  >
                    {agendaName}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                No agendas linked to this center yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
