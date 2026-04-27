import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function RolesPanel({
  roleSearch,
  onRoleSearchChange,
  filteredRoles,
  selectedRoleId,
  onSelectRole,
  onAddRole,
}) {
  return (
    <Card className="xl:col-span-6 border-blue-200/70">
      <CardHeader className="space-y-2 border-b border-blue-200/70 bg-blue-50/25 p-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base text-[#1E3A8A]">Roles</CardTitle>
          <Button size="sm" onClick={onAddRole}>
            Add Role
          </Button>
        </div>
        <Input
          placeholder="Search role"
          value={roleSearch}
          onChange={(event) => onRoleSearchChange(event.target.value)}
        />
      </CardHeader>
      <CardContent className="max-h-[520px] space-y-2 overflow-auto p-3">
        {filteredRoles.map((role) => {
          const selected = role.id === selectedRoleId;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onSelectRole(role.id)}
              className={[
                "w-full rounded-lg border px-3 py-2 text-left transition",
                selected
                  ? "border-[#1E3A8A] bg-blue-100/70 ring-1 ring-blue-200"
                  : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/40",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{role.name}</p>
                </div>
                {role.is_critical ? <Badge variant="secondary">Critical</Badge> : null}
              </div>
            </button>
          );
        })}
        {filteredRoles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-600">
            No roles found.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
