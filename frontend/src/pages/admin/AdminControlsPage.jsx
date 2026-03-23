import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  getRolePermissionMap,
  resetRolePermissionMapToDefaults,
  saveRolePermissionMap,
  syncRolePermissionMapFromServer,
} from "@/services/permissions";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";

export default function AdminControlsPage() {
  const toast = useToast();
  const { profile } = useAuth();
  const isAdmin =
    String(profile?.role || "")
      .trim()
      .toLowerCase() === "admin";
  const envLabel = String(import.meta.env.MODE || "").trim();

  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [permissionDraft, setPermissionDraft] = useState(() =>
    getRolePermissionMap(),
  );
  const [syncedPermissions, setSyncedPermissions] = useState(() =>
    getRolePermissionMap(),
  );
  const [permissionSearch, setPermissionSearch] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    syncRolePermissionMapFromServer()
      .then((nextMap) => {
        if (!active) return;
        setPermissionDraft(nextMap);
        setSyncedPermissions(nextMap);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(
          "Load failed",
          error.message || "Failed to load centralized role permissions.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [toast]);

  const roleKeys = useMemo(() => Object.keys(ROLE_LABELS), []);
  const permissionKeys = useMemo(() => Object.values(PERMISSIONS), []);

  const normalizeMap = useCallback(
    (map) =>
      roleKeys.reduce((acc, role) => {
        const sorted = Array.from(
          new Set(Array.isArray(map?.[role]) ? map[role] : []),
        ).sort((a, b) => String(a).localeCompare(String(b)));
        acc[role] = sorted;
        return acc;
      }, {}),
    [roleKeys],
  );

  const hasChanges = useMemo(() => {
    const a = JSON.stringify(normalizeMap(permissionDraft));
    const b = JSON.stringify(normalizeMap(syncedPermissions));
    return a !== b;
  }, [normalizeMap, permissionDraft, syncedPermissions]);

  const togglePermissionForRole = (role, permission, checked) => {
    setPermissionDraft((prev) => {
      const current = new Set(prev[role] || []);
      if (checked) current.add(permission);
      else current.delete(permission);
      return {
        ...prev,
        [role]: [...current],
      };
    });
  };

  const setPermissionsForRole = (role, nextPermissions) => {
    setPermissionDraft((prev) => ({
      ...prev,
      [role]: [...nextPermissions],
    }));
  };

  const discardChanges = () => {
    setPermissionDraft(syncedPermissions);
    toast.info("Draft reset", "Unsaved changes were discarded.");
  };

  const resyncFromServer = async () => {
    setLoading(true);
    try {
      const nextMap = await syncRolePermissionMapFromServer();
      setPermissionDraft(nextMap);
      setSyncedPermissions(nextMap);
      toast.success("Synced", "Role permissions refreshed from server.");
    } catch (error) {
      toast.error(
        "Sync failed",
        error.message || "Unable to refresh role permissions.",
      );
    } finally {
      setLoading(false);
    }
  };

  const computeDiffByRole = useCallback(() => {
    const normalizedDraft = normalizeMap(permissionDraft);
    const normalizedSynced = normalizeMap(syncedPermissions);

    return roleKeys
      .map((role) => {
        const draftSet = new Set(normalizedDraft[role] || []);
        const syncedSet = new Set(normalizedSynced[role] || []);
        const added = Array.from(draftSet).filter((p) => !syncedSet.has(p));
        const removed = Array.from(syncedSet).filter((p) => !draftSet.has(p));
        return { role, added, removed };
      })
      .filter((row) => row.added.length || row.removed.length);
  }, [normalizeMap, permissionDraft, roleKeys, syncedPermissions]);

  const savePermissions = () => {
    if (loading || confirmLoading) return;
    if (!hasChanges) {
      toast.info("No changes", "There are no permission changes to save.");
      return;
    }

    const diffRows = computeDiffByRole();
    setConfirmAction({
      type: "save_permissions",
      title: "Confirm Permission Update",
      message: (
        <div className="space-y-2">
          <p>
            Apply these role-permission changes? This takes effect immediately.
          </p>
          <div className="space-y-2 text-xs text-slate-600">
            {diffRows.map(({ role, added, removed }) => (
              <div key={role} className="rounded-md border border-border p-2">
                <p className="font-semibold text-slate-900">
                  {ROLE_LABELS[role] || role}
                </p>
                {added.length ? (
                  <p>
                    Added:{" "}
                    <span className="font-mono text-[11px]">
                      {added.join(", ")}
                    </span>
                  </p>
                ) : null}
                {removed.length ? (
                  <p>
                    Removed:{" "}
                    <span className="font-mono text-[11px]">
                      {removed.join(", ")}
                    </span>
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ),
      confirmLabel: "Apply Changes",
    });
  };

  const resetPermissions = () => {
    if (loading || confirmLoading) return;
    setConfirmAction({
      type: "reset_permissions",
      title: "Reset Permissions",
      message:
        "Reset all role permissions to default values? This cannot be undone.",
      confirmLabel: "Reset",
    });
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      if (confirmAction.type === "save_permissions") {
        await saveRolePermissionMap(permissionDraft);
        setSyncedPermissions(permissionDraft);
        toast.success("Saved", "Roles and permissions updated.");
      } else if (confirmAction.type === "reset_permissions") {
        const next = await resetRolePermissionMapToDefaults();
        setPermissionDraft(next);
        setSyncedPermissions(next);
        toast.success("Reset", "Roles and permissions reset to defaults.");
      }
      setConfirmAction(null);
    } catch (error) {
      toast.error("Action failed", error.message || "Action failed.");
    } finally {
      setConfirmLoading(false);
    }
  };

  const filteredPermissionKeys = useMemo(() => {
    const keyword = String(permissionSearch || "")
      .trim()
      .toLowerCase();
    if (!keyword) return permissionKeys;
    return permissionKeys.filter((permission) => {
      const label = String(PERMISSION_LABELS[permission] || "").toLowerCase();
      const key = String(permission || "").toLowerCase();
      return label.includes(keyword) || key.includes(keyword);
    });
  }, [permissionKeys, permissionSearch]);

  const groupedPermissionRows = useMemo(() => {
    const toGroup = (permission) => {
      const text = String(permission || "");
      return text.includes(".") ? text.split(".", 1)[0] : "other";
    };

    const sorted = [...filteredPermissionKeys].sort((a, b) => {
      const groupA = toGroup(a);
      const groupB = toGroup(b);
      if (groupA !== groupB) return groupA.localeCompare(groupB);
      return String(a).localeCompare(String(b));
    });

    const rows = [];
    let currentGroup = "";
    sorted.forEach((permission) => {
      const group = toGroup(permission);
      if (group !== currentGroup) {
        currentGroup = group;
        rows.push({ kind: "group", key: `group-${group}`, group });
      }
      rows.push({ kind: "permission", key: permission, permission });
    });
    return rows;
  }, [filteredPermissionKeys]);

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Admin Controls"
        description="Manage centralized role permissions. User account creation now lives in User Management."
      />

      {!isAdmin ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">
            You do not have access to this page.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-wrap items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-[0.08em] text-slate-900">
                Roles & Permissions
              </CardTitle>
              <p className="text-xs text-slate-500">
                System-wide access matrix for Student, Faculty, and Admin.
                {envLabel ? (
                  <span className="ml-2 rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[10px] uppercase text-slate-600">
                    {envLabel}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={resyncFromServer}
                disabled={loading || confirmLoading}
              >
                Re-sync
              </Button>
              <Button
                variant="outline"
                onClick={discardChanges}
                disabled={loading || confirmLoading || !hasChanges}
                title={hasChanges ? "Discard unsaved changes" : "No changes"}
              >
                Discard Changes
              </Button>
              <Button
                variant="outline"
                onClick={resetPermissions}
                disabled={loading || confirmLoading}
              >
                Reset Defaults
              </Button>
              <Button
                onClick={savePermissions}
                disabled={loading || confirmLoading || !hasChanges}
                title={hasChanges ? "Save changes" : "No changes"}
              >
                Save Permissions
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-slate-600">Loading permissions...</p>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-3">
              {roleKeys.map((role) => (
                <Card key={`role-summary-${role}`} className="bg-muted/30">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>{ROLE_LABELS[role]}</span>
                      <span>
                        {(permissionDraft[role] || []).length}/
                        {permissionKeys.length}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        disabled={loading || confirmLoading}
                        onClick={() =>
                          setPermissionsForRole(role, permissionKeys)
                        }
                      >
                        Select all
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        disabled={loading || confirmLoading}
                        onClick={() => setPermissionsForRole(role, [])}
                      >
                        Clear
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="relative w-full sm:max-w-md">
                <span className="sr-only">Search permissions</span>
                <Input
                  placeholder="Search permissions..."
                  value={permissionSearch}
                  onChange={(event) => setPermissionSearch(event.target.value)}
                  disabled={loading}
                />
              </label>
              <p className="text-xs text-slate-500">
                Showing {filteredPermissionKeys.length} of{" "}
                {permissionKeys.length} permissions.
              </p>
            </div>

            <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)]">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-muted/30 text-left font-semibold text-slate-700">
                      Permission
                    </TableHead>
                    {roleKeys.map((role) => (
                      <TableHead
                        key={`role-column-${role}`}
                        className="text-center font-semibold text-slate-700"
                      >
                        {ROLE_LABELS[role]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedPermissionRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        className="text-slate-600"
                        colSpan={roleKeys.length + 1}
                      >
                        No permissions matched your search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupedPermissionRows.map((row) => {
                      if (row.kind === "group") {
                        return (
                          <TableRow key={row.key} className="bg-slate-50/70">
                            <TableCell
                              colSpan={roleKeys.length + 1}
                              className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                            >
                              {row.group}
                            </TableCell>
                          </TableRow>
                        );
                      }

                      const permission = row.permission;
                      return (
                        <TableRow key={`permission-row-${permission}`}>
                          <TableCell className="sticky left-0 z-10 bg-white text-slate-700">
                            <p className="font-medium">
                              {PERMISSION_LABELS[permission] || permission}
                            </p>
                            <p className="text-xs text-slate-500 font-mono">
                              {permission}
                            </p>
                          </TableCell>
                          {roleKeys.map((role) => (
                            <TableCell
                              key={`permission-cell-${permission}-${role}`}
                              className="text-center"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-slate-700 disabled:opacity-60"
                                disabled={loading || confirmLoading}
                                aria-label={`${ROLE_LABELS[role] || role}: ${permission}`}
                                checked={Boolean(
                                  (permissionDraft[role] || []).includes(
                                    permission,
                                  ),
                                )}
                                onChange={(e) =>
                                  togglePermissionForRole(
                                    role,
                                    permission,
                                    e.target.checked,
                                  )
                                }
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmActionModal
        open={Boolean(confirmAction)}
        title={confirmAction?.title || "Confirm Action"}
        message={confirmAction?.message || ""}
        confirmLabel={confirmAction?.confirmLabel || "Confirm"}
        loading={confirmLoading}
        onCancel={() => setConfirmAction(null)}
        onConfirm={executeConfirmAction}
      />
    </section>
  );
}
