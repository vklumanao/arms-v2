export default function DashboardPanel({
  title,
  children,
  className = "",
  bodyClassName = "panel-body",
}) {
  return (
    <section className={`panel ${className}`.trim()}>
      <div className="panel-header">
        <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
          {title}
        </h2>
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
