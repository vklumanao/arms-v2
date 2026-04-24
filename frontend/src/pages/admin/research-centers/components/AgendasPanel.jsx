import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AgendasPanel({ center, agendaNames }) {
  return (
    <Card className="overflow-hidden border-blue-200/80 shadow-sm">
      <CardHeader className="space-y-1 border-b border-blue-100 bg-blue-50/35 px-6 py-5">
        <CardTitle className="text-lg font-bold text-[#1E3A8A]">
          Linked Agendas
        </CardTitle>
        <CardDescription>
          Review the agenda coverage connected to {center.name}.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {agendaNames.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {agendaNames.map((agendaName) => (
              <div
                key={`${center.id}-${agendaName}`}
                className="rounded-[1.35rem] border border-blue-200 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(239,246,255,0.82),rgba(219,234,254,0.65))] p-4 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1E3A8A]">
                  Research Agenda
                </p>
                <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                  {agendaName}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.35rem] border border-dashed border-blue-200 bg-blue-50/70 p-8 text-center text-sm text-[#1E3A8A]">
            No agendas linked to this center yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
