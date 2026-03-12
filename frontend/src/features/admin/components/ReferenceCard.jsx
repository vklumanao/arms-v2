export default function ReferenceCard({
  icon,
  title,
  subtitle,
  value,
  placeholder,
  onChange,
  onAdd,
  items,
  renderItem,
  className = "",
  listClassName = "",
}) {
  return (
    <article className={`panel ${className}`.trim()}>
      <header className="panel-header flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
            Reference Data
          </p>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            {icon}
            {title}
          </h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="status-chip status-ongoing">{items.length} items</span>
      </header>

      <div className="panel-body space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="control-input"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
          />
          <button className="btn btn-primary sm:min-w-28" onClick={onAdd}>
            Add
          </button>
        </div>

        <div
          className={`max-h-64 overflow-auto app-card-muted app-card-micro ${listClassName}`.trim()}
        >
          {items.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-500">
              No records yet. Add your first entry.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm text-slate-700">
              {items.map(renderItem)}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}
