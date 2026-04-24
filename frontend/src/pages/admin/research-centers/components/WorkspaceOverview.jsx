import {
  Eye,
  FolderKanban,
  Layers3,
  Link2,
  Settings2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import MetricCard from "./MetricCard";

export default function WorkspaceOverview({
  center,
  summary,
  agendaNames,
  onOpenDetail,
  onOpenSettings,
}) {
  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[1.8rem] border border-blue-200/70 bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_38%,#0f766e_100%)] p-6 text-white shadow-[0_28px_68px_rgba(15,23,42,0.24)]">
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
              <Badge className="border-emerald-200/30 bg-emerald-400/15 text-emerald-50 hover:bg-emerald-400/15">
                {summary.totalAgendas} agenda
                {summary.totalAgendas === 1 ? "" : "s"}
              </Badge>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                {center.name}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50/95">
                {center.description ||
                  "No description has been added for this research center yet. Use Settings to add positioning, summary copy, and public-facing links."}
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-blue-50/90">
              <span>Center Chief: {center.centerChiefName || "-"}</span>
              <span>Total Links: {summary.totalLinks}</span>
              <span>Members Active: {summary.activeMembers}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={onOpenDetail}
            >
              <Eye className="h-4 w-4" />
              Open Full Page
            </Button>
            <Button
              className="bg-white text-[#1E3A8A] hover:bg-blue-50"
              onClick={onOpenSettings}
            >
              <Settings2 className="h-4 w-4" />
              Edit Inline
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
        <MetricCard
          icon={Link2}
          label="Social Link"
          value={center.socialMediaLink ? "Live" : "Missing"}
          caption={
            center.socialMediaLink || "Public-facing channel not provided"
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <Card className="border-blue-200/80 shadow-sm">
          <CardHeader className="space-y-1 border-b border-blue-100 bg-blue-50/40 px-6 py-5">
            <CardTitle className="text-lg font-bold text-[#1E3A8A]">
              Leadership Snapshot
            </CardTitle>
            <CardDescription>
              Core ownership and identity details for this center.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 md:grid-cols-2">
            <div className="rounded-[1.3rem] border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1E3A8A]">
                Center Chief
              </p>
              <p className="mt-2 text-lg font-bold text-[#1E3A8A]">
                {center.centerChiefName || "-"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Current directory owner and primary reviewer.
              </p>
            </div>
            <div className="rounded-[1.3rem] border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1E3A8A]">
                Center ID
              </p>
              <p className="mt-2 break-all font-mono text-sm font-semibold text-[#1E3A8A]">
                {center.id || "-"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Used for routing and reference linking.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200/80 shadow-sm">
          <CardHeader className="space-y-1 border-b border-blue-100 bg-blue-50/40 px-6 py-5">
            <CardTitle className="text-lg font-bold text-[#1E3A8A]">
              Agenda Highlights
            </CardTitle>
            <CardDescription>
              The leading agenda tags connected to the selected center.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {agendaNames.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {agendaNames.map((agendaName) => (
                  <Badge
                    key={`${center.id}-${agendaName}`}
                    variant="secondary"
                    className="rounded-full bg-blue-50 px-3 py-1 text-[#1E3A8A]"
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
