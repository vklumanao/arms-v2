export default function DetailWorkspaceRail({
  center,
  agendaFilter,
  onAgendaClick,
}) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
      <div className="rounded-xl border border-blue-200/70 bg-white p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Description
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {String(center?.description || "").trim() ||
            "No description provided."}
        </p>
      </div>

      <div className="rounded-xl border border-blue-200/70 bg-white p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Research Agendas
        </p>

        {center?.agendaNames?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {center.agendaNames.map((agenda) => {
              const active = agendaFilter === agenda;
              return (
                <button
                  key={agenda}
                  type="button"
                  className={
                    active
                      ? "rounded-full border border-blue-300 bg-blue-100 px-3 py-1.5 text-xs font-semibold text-[#1E3A8A]"
                      : "rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#1E3A8A] hover:bg-blue-50"
                  }
                  onClick={() => onAgendaClick(agenda)}
                >
                  {agenda}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No agenda linked.</p>
        )}
      </div>
    </aside>
  );
}
