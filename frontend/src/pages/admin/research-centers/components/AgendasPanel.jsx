import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AgendasPanel({ center, agendaNames }) {
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="space-y-1 border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
        <CardTitle className="text-lg font-bold text-slate-700">
          Linked Agendas
        </CardTitle>
        <CardDescription>
          Review the agenda coverage connected to {center.name}.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {agendaNames.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {agendaNames.map((agendaName) => (
              <div
                key={`${center.id}-${agendaName}`}
                className="rounded-[1.35rem] border border-slate-300 bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
                  Research Agenda
                </p>
                <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                  {agendaName}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.35rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-700">
            No agendas linked to this center yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}


