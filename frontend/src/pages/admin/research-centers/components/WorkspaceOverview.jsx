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
      <div className="relative overflow-hidden rounded-[1.4rem] border border-blue-200/70 bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_38%,#0f766e_100%)] p-4 text-white shadow-[0_28px_68px_rgba(15,23,42,0.24)] sm:rounded-[1.8rem] sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 left-0 h-32 w-40 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-white/20 bg-white/15 text-white hover:bg-white/15">
                {center.code || "No Code"}
              </Badge>
              <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">
                Research Center
              </Badge>
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">
                {center.name}
              </h2>
              <p className="mt-2  text-sm leading-6 text-blue-50/95">
                {center.description ||
                  "No description has been added for this research center yet. Use Settings to add positioning, summary copy, and public-facing links."}
              </p>
            </div>
          </div>
        </div>
      </div>

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
