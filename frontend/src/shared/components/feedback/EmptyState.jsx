export default function EmptyState({ title, description }) {
  return (
    <div className="panel">
      <div className="panel-body">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

