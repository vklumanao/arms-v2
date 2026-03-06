export function SectionPanel({ title, children, bodyClassName = "panel-body" }) {
  return (
    <div className="panel">
      {title ? (
        <div className="panel-header">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
            {title}
          </h2>
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

export function TaskMetricCard({ label, value, hint }) {
  return (
    <div className="app-card app-card-compact">
      <p className="text-xs uppercase tracking-[0.06em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export function QualityChip({ ok, positiveLabel, negativeLabel }) {
  return (
    <span
      className={`status-chip ${ok ? "status-completed" : "status-rejected"}`}
    >
      {ok ? positiveLabel : negativeLabel}
    </span>
  );
}

export function DetailBlock({ title, children }) {
  return (
    <div className="app-card app-card-compact">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}
