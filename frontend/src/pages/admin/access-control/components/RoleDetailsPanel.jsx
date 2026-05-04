import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function RoleDetailsPanel({
  selectedRole,
  editForm,
  isReadonlyRole,
  saving,
  onEditName,
  onEditDescription,
  onSaveRoleDetails,
  onDeleteRole,
}) {
  return (
    <Card className="xl:col-span-6 border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-200 bg-slate-50/60 p-4">
        <CardTitle className="text-base text-slate-900">Role Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {selectedRole ? (
          <>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Role Name
              </label>
              <Input
                placeholder="Role name"
                value={editForm.name}
                disabled={isReadonlyRole}
                onChange={(event) => onEditName(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Description
              </label>
              <Input
                placeholder="Description"
                value={editForm.description}
                disabled={isReadonlyRole}
                onChange={(event) => onEditDescription(event.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={onSaveRoleDetails}
                disabled={saving || isReadonlyRole}
              >
                Save Details
              </Button>
              <Button
                variant="outline"
                disabled={Boolean(selectedRole.is_critical) || saving}
                onClick={onDeleteRole}
              >
                Delete Role
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-600">
            Select a role to manage details.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
