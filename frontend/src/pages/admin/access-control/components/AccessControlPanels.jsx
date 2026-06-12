import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function AccessControlPanelHeader({
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

export function RolesPanel({
  roleSearch,
  onRoleSearchChange,
  filteredRoles,
  selectedRoleId,
  onSelectRole,
  onAddRole,
}) {
  return (
    <Card className="xl:col-span-6 border-slate-200 bg-white shadow-sm">
      <CardHeader className="space-y-2 border-b border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base text-slate-900">Roles</CardTitle>
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
                  ? "border-slate-400 bg-slate-100 ring-1 ring-slate-200"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {role.name}
                  </p>
                </div>
                {role.is_critical ? (
                  <Badge variant="secondary">Critical</Badge>
                ) : null}
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

export function RoleDetailsPanel({
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

export function PermissionsMatrixPanel({
  actionColumns,
  columnKeys,
  rowKeys,
  matrixRows,
  draftPermissionSet,
  isReadonlyRole,
  filteredPermissionKeys,
  toggleKeys,
  allFilteredPermissionsChecked,
  toggleColumn,
  toggleRow,
  toggleCell,
  formatActionLabel,
  hasUnsavedPermissionChanges,
  selectedRole,
  saving,
  onSavePermissions,
  onResetDraft,
}) {
  return (
    <Card className="xl:col-span-12 border-slate-200 bg-white shadow-sm">
      <CardHeader className="space-y-2 border-b border-slate-200 bg-slate-50/60 p-4">
        <CardTitle className="text-base text-slate-900">
          Permissions Matrix
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-600">
            Use row and column checkboxes for fast assignment.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isReadonlyRole || filteredPermissionKeys.length === 0}
              onClick={() => toggleKeys(filteredPermissionKeys, true)}
            >
              Select All Visible
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isReadonlyRole || filteredPermissionKeys.length === 0}
              onClick={() => toggleKeys(filteredPermissionKeys, false)}
            >
              Clear All Visible
            </Button>
            <Badge variant="secondary">
              {allFilteredPermissionsChecked
                ? "All visible selected"
                : "Partial selection"}
            </Badge>
          </div>
        </div>

        <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                  Module
                </th>
                {actionColumns.map((action) => {
                  const keys = columnKeys(action);
                  const checked =
                    keys.length > 0 &&
                    keys.every((key) => draftPermissionSet.has(key));
                  return (
                    <th
                      key={action}
                      className="min-w-[120px] border-b border-slate-200 px-3 py-2 text-center"
                    >
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isReadonlyRole || keys.length === 0}
                          onChange={(event) =>
                            toggleColumn(action, event.target.checked)
                          }
                        />
                        <span>{formatActionLabel(action)}</span>
                      </label>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {matrixRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={actionColumns.length + 1}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No permissions matched your current filters.
                  </td>
                </tr>
              ) : null}
              {matrixRows.map((row) => {
                const rowPermissionKeys = rowKeys(row.moduleName);
                const rowChecked =
                  rowPermissionKeys.length > 0 &&
                  rowPermissionKeys.every((key) => draftPermissionSet.has(key));
                return (
                  <tr key={row.moduleName} className="hover:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-slate-800">
                        <input
                          type="checkbox"
                          checked={rowChecked}
                          disabled={
                            isReadonlyRole || rowPermissionKeys.length === 0
                          }
                          onChange={(event) =>
                            toggleRow(row.moduleName, event.target.checked)
                          }
                        />
                        <span className="font-medium">{row.moduleName}</span>
                      </label>
                    </td>
                    {actionColumns.map((action) => {
                      const cell = row.actionMap.get(action) || [];
                      const keys = cell
                        .map((permission) =>
                          String(permission?.key || "").trim(),
                        )
                        .filter(Boolean);
                      const checked =
                        keys.length > 0 &&
                        keys.every((permissionKey) =>
                          draftPermissionSet.has(permissionKey),
                        );
                      return (
                        <td
                          key={`${row.moduleName}-${action}`}
                          className="border-b border-slate-100 px-3 py-2 text-center"
                        >
                          {keys.length > 0 ? (
                            <label className="inline-flex cursor-pointer items-center justify-center px-2 py-1">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isReadonlyRole}
                                onChange={(event) =>
                                  toggleCell(keys, event.target.checked)
                                }
                              />
                            </label>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={onSavePermissions}
            disabled={
              saving ||
              !selectedRole ||
              !hasUnsavedPermissionChanges ||
              isReadonlyRole
            }
          >
            Save Permissions
          </Button>
          <Button
            variant="outline"
            disabled={saving || !hasUnsavedPermissionChanges}
            onClick={onResetDraft}
          >
            Reset Draft
          </Button>
          {hasUnsavedPermissionChanges ? (
            <Badge variant="secondary">Unsaved changes</Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
