import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PermissionsMatrixPanel({
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
    <Card className="xl:col-span-12 border-blue-200/70">
      <CardHeader className="space-y-2 border-b border-blue-200/70 bg-blue-50/25 p-4">
        <CardTitle className="text-base text-[#1E3A8A]">
          Permissions Matrix
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200/70 bg-blue-50/30 px-3 py-2">
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

        <div className="overflow-auto rounded-lg border border-blue-200/70 bg-white">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead className="bg-blue-100/70">
              <tr>
                <th className="border-b border-blue-200/70 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#1E3A8A]">
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
                      className="min-w-[120px] border-b border-blue-200/70 px-3 py-2 text-center"
                    >
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#1E3A8A]">
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
                  <tr key={row.moduleName} className="hover:bg-blue-50/80">
                    <td className="border-b border-blue-100 px-3 py-2">
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
                          className="border-b border-blue-100 px-3 py-2 text-center"
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
