import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";

export default function AccessControlPanelHeader({
  loading,
  saving,
  onRefresh,
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Administration
        </p>
        <CardTitle className="mt-1 text-2xl font-bold text-slate-900">
          Access Control Panel
        </CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Manage roles and permission matrix with a scalable RBAC layout.
        </p>
      </div>
      <Button
        variant="outline"
        onClick={onRefresh}
        disabled={loading || saving}
      >
        {loading ? "Refreshing..." : "Refresh"}
      </Button>
    </div>
  );
}
