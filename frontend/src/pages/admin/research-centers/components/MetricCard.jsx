import { cn } from "@/utils/cn";

export default function MetricCard({
  icon: Icon,
  label,
  value,
  caption,
  tone = "blue",
}) {
  const toneClasses = {
    blue: "bg-white border-slate-200 text-slate-700",
    emerald:
      "from-emerald-50 via-white to-emerald-100/70 border-emerald-200/80 text-emerald-700",
    amber:
      "from-amber-50 via-white to-amber-100/70 border-amber-200/80 text-amber-700",
  };

  return (
    <div
      className={cn(
        "rounded-[1.4rem] border bg-white p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5",
        toneClasses[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-slate-600">{caption}</p>
        </div>
        <div className="rounded-2xl border border-current/10 bg-white/80 p-2.5 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

