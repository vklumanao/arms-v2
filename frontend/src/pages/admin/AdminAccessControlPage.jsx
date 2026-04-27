import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAdminRole,
  deleteAdminRole,
  fetchPermissions,
  fetchRolePermissions,
  fetchRoles,
  saveRolePermissions,
  updateAdminRole,
} from "@/services/admin";
import { useToast } from "@/components/providers/ToastProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";
import AccessControlPanelHeader from "./access-control/components/AccessControlPanelHeader";
import RolesPanel from "./access-control/components/RolesPanel";
import RoleDetailsPanel from "./access-control/components/RoleDetailsPanel";
import PermissionsMatrixPanel from "./access-control/components/PermissionsMatrixPanel";

const BASE_ACTION_COLUMNS = ["create", "view", "edit", "delete"];
const MODULE_HIERARCHY = [
  "Dashboard",
  "Research Projects",
  "Research Outputs",
  "Awards and Recognitions",
  "Submissions",
  "Affiliates",
  "User Management",
  "Access Control",
  "Administration",
  "Reports",
  "General",
];
const HIDDEN_MATRIX_MODULES = new Set(["profile", "settings"]);
const HIDDEN_MATRIX_PERMISSION_KEYS = new Set(["affiliate_profile.view"]);

function formatActionLabel(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (!text) return "Action";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function compareModuleNamesByHierarchy(a, b) {
  const nameA = String(a || "").trim();
  const nameB = String(b || "").trim();
  const orderMap = new Map(
    MODULE_HIERARCHY.map((name, index) => [name.toLowerCase(), index]),
  );
  const rankA = orderMap.has(nameA.toLowerCase())
    ? orderMap.get(nameA.toLowerCase())
    : Number.MAX_SAFE_INTEGER;
  const rankB = orderMap.has(nameB.toLowerCase())
    ? orderMap.get(nameB.toLowerCase())
    : Number.MAX_SAFE_INTEGER;
  if (rankA !== rankB) return rankA - rankB;
  return nameA.localeCompare(nameB);
}

function areSetsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a.values()) {
    if (!b.has(value)) return false;
  }
  return true;
}

export default function AdminAccessControlPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [currentPermissionSet, setCurrentPermissionSet] = useState(new Set());
  const [draftPermissionSet, setDraftPermissionSet] = useState(new Set());
  const [roleSearch, setRoleSearch] = useState("");
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [createDraftPermissionSet, setCreateDraftPermissionSet] = useState(
    new Set(),
  );
  const [confirmDelete, setConfirmDelete] = useState(null);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) || null,
    [roles, selectedRoleId],
  );

  const isAdminRole = String(selectedRole?.key || "").toLowerCase() === "admin";
  const isReadonlyRole = Boolean(selectedRole?.is_critical) || isAdminRole;

  const reloadBaseData = useCallback(async () => {
    setLoading(true);
    try {
      const [roleRows, permissionRows] = await Promise.all([
        fetchRoles(),
        fetchPermissions(),
      ]);
      setRoles(roleRows);
      setPermissions(permissionRows);
      setSelectedRoleId((current) => {
        if (current && roleRows.some((role) => role.id === current))
          return current;
        return roleRows[0]?.id || "";
      });
    } catch (error) {
      toast.error("Load failed", error?.message || "Unable to load RBAC data.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    reloadBaseData();
  }, [reloadBaseData]);

  const loadSelectedRolePermissions = useCallback(
    async (roleId) => {
      const id = String(roleId || "").trim();
      if (!id) {
        setCurrentPermissionSet(new Set());
        setDraftPermissionSet(new Set());
        return;
      }
      try {
        const payload = await fetchRolePermissions(id);
        const nextSet = new Set(payload?.permission_keys || []);
        setCurrentPermissionSet(nextSet);
        setDraftPermissionSet(new Set(nextSet));
      } catch (error) {
        toast.error(
          "Role permissions failed",
          error?.message || "Unable to load role permissions.",
        );
      }
    },
    [toast],
  );

  useEffect(() => {
    loadSelectedRolePermissions(selectedRoleId);
  }, [selectedRoleId, loadSelectedRolePermissions]);

  useEffect(() => {
    if (!selectedRole) {
      setEditForm({ name: "", description: "" });
      return;
    }
    setEditForm({
      name: selectedRole.name || "",
      description: selectedRole.description || "",
    });
  }, [selectedRole]);

  const filteredRoles = useMemo(() => {
    const keyword = String(roleSearch || "")
      .trim()
      .toLowerCase();
    if (!keyword) return roles;
    return roles.filter((role) => {
      const name = String(role?.name || "").toLowerCase();
      const key = String(role?.key || "").toLowerCase();
      return name.includes(keyword) || key.includes(keyword);
    });
  }, [roles, roleSearch]);

  const filteredPermissions = useMemo(
    () =>
      permissions.filter((permission) => {
        const permissionKey = String(permission?.key || "")
          .trim()
          .toLowerCase();
        if (HIDDEN_MATRIX_PERMISSION_KEYS.has(permissionKey)) return false;
        const moduleName = String(permission?.module || "General")
          .trim()
          .toLowerCase();
        return !HIDDEN_MATRIX_MODULES.has(moduleName);
      }),
    [permissions],
  );

  const actionColumns = useMemo(() => {
    const dynamic = Array.from(
      new Set(
        filteredPermissions
          .map((permission) =>
            String(permission?.action || "manage")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );
    const extras = dynamic.filter(
      (action) => !BASE_ACTION_COLUMNS.includes(action),
    );
    return [...BASE_ACTION_COLUMNS, ...extras];
  }, [filteredPermissions]);

  const matrixRows = useMemo(() => {
    const grouped = new Map();
    for (const permission of filteredPermissions) {
      const moduleName =
        String(permission?.module || "General").trim() || "General";
      const action =
        String(permission?.action || "manage")
          .trim()
          .toLowerCase() || "manage";
      if (!grouped.has(moduleName)) grouped.set(moduleName, new Map());
      const actionMap = grouped.get(moduleName);
      if (!actionMap.has(action)) actionMap.set(action, []);
      actionMap.get(action).push(permission);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => compareModuleNamesByHierarchy(a[0], b[0]))
      .map(([moduleName, actionMap]) => ({ moduleName, actionMap }));
  }, [filteredPermissions]);

  const filteredPermissionKeys = useMemo(
    () =>
      filteredPermissions
        .map((permission) => String(permission?.key || "").trim())
        .filter(Boolean),
    [filteredPermissions],
  );

  const allFilteredPermissionsChecked = useMemo(
    () =>
      filteredPermissionKeys.length > 0 &&
      filteredPermissionKeys.every((key) => draftPermissionSet.has(key)),
    [draftPermissionSet, filteredPermissionKeys],
  );

  const rowKeys = useCallback(
    (moduleName) => {
      const keys = [];
      const row = matrixRows.find((entry) => entry.moduleName === moduleName);
      if (!row) return keys;
      for (const action of actionColumns) {
        const cell = row.actionMap.get(action) || [];
        for (const permission of cell) {
          const key = String(permission?.key || "").trim();
          if (key) keys.push(key);
        }
      }
      return keys;
    },
    [matrixRows, actionColumns],
  );

  const columnKeys = useCallback(
    (action) => {
      const keys = [];
      for (const row of matrixRows) {
        const cell = row.actionMap.get(action) || [];
        for (const permission of cell) {
          const key = String(permission?.key || "").trim();
          if (key) keys.push(key);
        }
      }
      return keys;
    },
    [matrixRows],
  );

  const toggleKeys = (keys, enabled) => {
    setDraftPermissionSet((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (enabled) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  };

  const toggleCell = (permissionKeys, enabled) => {
    if (isReadonlyRole) return;
    toggleKeys(permissionKeys, enabled);
  };

  const toggleRow = (moduleName, enabled) => {
    if (isReadonlyRole) return;
    toggleKeys(rowKeys(moduleName), enabled);
  };

  const toggleColumn = (action, enabled) => {
    if (isReadonlyRole) return;
    toggleKeys(columnKeys(action), enabled);
  };

  const hasUnsavedPermissionChanges = useMemo(
    () => !areSetsEqual(currentPermissionSet, draftPermissionSet),
    [currentPermissionSet, draftPermissionSet],
  );

  const onCreateRole = async () => {
    const name = String(createForm.name || "").trim();
    if (!name) {
      toast.error("Validation", "Role name is required.");
      return;
    }

    setSaving(true);
    try {
      const created = await createAdminRole({
        name,
        description: String(createForm.description || "").trim() || null,
      });
      if (created?.id && createDraftPermissionSet.size > 0) {
        await saveRolePermissions(
          created.id,
          Array.from(createDraftPermissionSet),
        );
      }

      toast.success("Role created", `${name} is ready for access control.`);
      setCreateForm({ name: "", description: "" });
      setCreateDraftPermissionSet(new Set());
      setCreateModalOpen(false);
      await reloadBaseData();
      if (created?.id) setSelectedRoleId(created.id);
    } catch (error) {
      toast.error("Create failed", error?.message || "Unable to create role.");
    } finally {
      setSaving(false);
    }
  };

  const onSaveRoleDetails = async () => {
    if (!selectedRole?.id) return;
    if (isReadonlyRole) return;
    setSaving(true);
    try {
      await updateAdminRole(selectedRole.id, {
        name: String(editForm.name || "").trim(),
        description: String(editForm.description || "").trim() || null,
      });
      toast.success("Role updated", "Role details saved.");
      await reloadBaseData();
    } catch (error) {
      toast.error("Update failed", error?.message || "Unable to update role.");
    } finally {
      setSaving(false);
    }
  };

  const onSavePermissions = async () => {
    if (!selectedRole?.id) return;
    setSaving(true);
    try {
      await saveRolePermissions(
        selectedRole.id,
        Array.from(draftPermissionSet),
      );
      setCurrentPermissionSet(new Set(draftPermissionSet));
      toast.success(
        "Permissions saved",
        `Updated access for ${selectedRole.name}.`,
      );
      await reloadBaseData();
    } catch (error) {
      toast.error(
        "Save failed",
        error?.message || "Unable to save permissions.",
      );
    } finally {
      setSaving(false);
    }
  };

  const createFilteredPermissions = useMemo(
    () =>
      permissions.filter((permission) => {
        const permissionKey = String(permission?.key || "")
          .trim()
          .toLowerCase();
        if (HIDDEN_MATRIX_PERMISSION_KEYS.has(permissionKey)) return false;
        const moduleName = String(permission?.module || "General")
          .trim()
          .toLowerCase();
        return !HIDDEN_MATRIX_MODULES.has(moduleName);
      }),
    [permissions],
  );

  const createActionColumns = useMemo(() => {
    const dynamic = Array.from(
      new Set(
        createFilteredPermissions
          .map((permission) =>
            String(permission?.action || "manage")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );
    const extras = dynamic.filter(
      (action) => !BASE_ACTION_COLUMNS.includes(action),
    );
    return [...BASE_ACTION_COLUMNS, ...extras];
  }, [createFilteredPermissions]);

  const createMatrixRows = useMemo(() => {
    const grouped = new Map();
    for (const permission of createFilteredPermissions) {
      const moduleName =
        String(permission?.module || "General").trim() || "General";
      const action =
        String(permission?.action || "manage")
          .trim()
          .toLowerCase() || "manage";
      if (!grouped.has(moduleName)) grouped.set(moduleName, new Map());
      const actionMap = grouped.get(moduleName);
      if (!actionMap.has(action)) actionMap.set(action, []);
      actionMap.get(action).push(permission);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => compareModuleNamesByHierarchy(a[0], b[0]))
      .map(([moduleName, actionMap]) => ({ moduleName, actionMap }));
  }, [createFilteredPermissions]);

  const createFilteredPermissionKeys = useMemo(
    () =>
      createFilteredPermissions
        .map((permission) => String(permission?.key || "").trim())
        .filter(Boolean),
    [createFilteredPermissions],
  );

  const allCreateFilteredPermissionsChecked = useMemo(
    () =>
      createFilteredPermissionKeys.length > 0 &&
      createFilteredPermissionKeys.every((key) =>
        createDraftPermissionSet.has(key),
      ),
    [createDraftPermissionSet, createFilteredPermissionKeys],
  );

  const createRowKeys = useCallback(
    (moduleName) => {
      const keys = [];
      const row = createMatrixRows.find(
        (entry) => entry.moduleName === moduleName,
      );
      if (!row) return keys;
      for (const action of createActionColumns) {
        const cell = row.actionMap.get(action) || [];
        for (const permission of cell) {
          const key = String(permission?.key || "").trim();
          if (key) keys.push(key);
        }
      }
      return keys;
    },
    [createMatrixRows, createActionColumns],
  );

  const createColumnKeys = useCallback(
    (action) => {
      const keys = [];
      for (const row of createMatrixRows) {
        const cell = row.actionMap.get(action) || [];
        for (const permission of cell) {
          const key = String(permission?.key || "").trim();
          if (key) keys.push(key);
        }
      }
      return keys;
    },
    [createMatrixRows],
  );

  const toggleCreateKeys = (keys, enabled) => {
    setCreateDraftPermissionSet((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (enabled) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  };

  return (
    <section className="page-stack-lg">
      <Card className="border-blue-200/80 bg-gradient-to-b from-blue-50/35 to-white shadow-sm">
        <CardHeader className="border-b border-blue-200/80 bg-blue-50/35">
          <AccessControlPanelHeader
            loading={loading}
            saving={saving}
            onRefresh={reloadBaseData}
          />
        </CardHeader>
        <CardContent className="p-4 md:p-5">
          <div className="mt-4">
            <div className="grid gap-4 xl:grid-cols-12">
              <RolesPanel
                roleSearch={roleSearch}
                onRoleSearchChange={setRoleSearch}
                filteredRoles={filteredRoles}
                selectedRoleId={selectedRoleId}
                onSelectRole={setSelectedRoleId}
                onAddRole={() => {
                  setCreateForm({ name: "", description: "" });
                  setCreateDraftPermissionSet(new Set());
                  setCreateModalOpen(true);
                }}
              />

              <RoleDetailsPanel
                selectedRole={selectedRole}
                editForm={editForm}
                isReadonlyRole={isReadonlyRole}
                saving={saving}
                onEditName={(value) =>
                  setEditForm((prev) => ({ ...prev, name: value }))
                }
                onEditDescription={(value) =>
                  setEditForm((prev) => ({ ...prev, description: value }))
                }
                onSaveRoleDetails={onSaveRoleDetails}
                onDeleteRole={() => setConfirmDelete(selectedRole)}
              />

              <PermissionsMatrixPanel
                actionColumns={actionColumns}
                columnKeys={columnKeys}
                rowKeys={rowKeys}
                matrixRows={matrixRows}
                draftPermissionSet={draftPermissionSet}
                isReadonlyRole={isReadonlyRole}
                filteredPermissionKeys={filteredPermissionKeys}
                toggleKeys={toggleKeys}
                allFilteredPermissionsChecked={allFilteredPermissionsChecked}
                toggleColumn={toggleColumn}
                toggleRow={toggleRow}
                toggleCell={toggleCell}
                formatActionLabel={formatActionLabel}
                hasUnsavedPermissionChanges={hasUnsavedPermissionChanges}
                selectedRole={selectedRole}
                saving={saving}
                onSavePermissions={onSavePermissions}
                onResetDraft={() =>
                  setDraftPermissionSet(new Set(currentPermissionSet))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmActionModal
        open={Boolean(confirmDelete)}
        title="Delete Role"
        message={
          confirmDelete
            ? `Delete role '${confirmDelete.name}'? Assigned or critical roles cannot be deleted.`
            : ""
        }
        confirmLabel="Delete Role"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete?.id) return;
          try {
            await deleteAdminRole(confirmDelete.id);
            toast.success("Role deleted", `${confirmDelete.name} was removed.`);
            setConfirmDelete(null);
            await reloadBaseData();
          } catch (error) {
            toast.error(
              "Delete failed",
              error?.message || "Unable to delete role.",
            );
          }
        }}
      />

      <Dialog
        open={createModalOpen}
        onOpenChange={(open) => {
          if (!saving) setCreateModalOpen(open);
        }}
      >
        <DialogContent className="max-h-[92vh] w-full max-w-6xl overflow-y-auto border border-blue-200/80 bg-white">
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
            <DialogDescription className="text-slate-600">
              Fill in the role details and set permissions before creating.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Role name"
              value={createForm.name}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
            <Input
              placeholder="Description (optional)"
              value={createForm.description}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200/70 bg-blue-50/30 px-3 py-2">
            <p className="text-xs text-slate-600">
              Prepare the role by selecting module actions below.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving || createFilteredPermissionKeys.length === 0}
                onClick={() =>
                  toggleCreateKeys(createFilteredPermissionKeys, true)
                }
              >
                Select All Visible
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving || createFilteredPermissionKeys.length === 0}
                onClick={() =>
                  toggleCreateKeys(createFilteredPermissionKeys, false)
                }
              >
                Clear All Visible
              </Button>
              <Badge variant="secondary">
                {allCreateFilteredPermissionsChecked
                  ? "All visible selected"
                  : "Partial selection"}
              </Badge>
            </div>
          </div>

          <div className="overflow-auto rounded-lg border border-blue-200/70 bg-white">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead className="bg-blue-100/70">
                <tr>
                  <th className="border-b border-blue-200/70 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#1E3A8A]">
                    Module
                  </th>
                  {createActionColumns.map((action) => {
                    const keys = createColumnKeys(action);
                    const checked =
                      keys.length > 0 &&
                      keys.every((key) => createDraftPermissionSet.has(key));
                    return (
                      <th
                        key={action}
                        className="min-w-[120px] border-b border-blue-200/70 px-3 py-2 text-center"
                      >
                        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#1E3A8A]">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={keys.length === 0 || saving}
                            onChange={(event) =>
                              toggleCreateKeys(keys, event.target.checked)
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
                {createMatrixRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={createActionColumns.length + 1}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      No permissions matched your current filters.
                    </td>
                  </tr>
                ) : null}
                {createMatrixRows.map((row) => {
                  const rowPermissionKeys = createRowKeys(row.moduleName);
                  const rowChecked =
                    rowPermissionKeys.length > 0 &&
                    rowPermissionKeys.every((key) =>
                      createDraftPermissionSet.has(key),
                    );
                  return (
                    <tr key={row.moduleName} className="hover:bg-blue-50/80">
                      <td className="border-b border-blue-100 px-3 py-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-slate-800">
                          <input
                            type="checkbox"
                            checked={rowChecked}
                            disabled={rowPermissionKeys.length === 0 || saving}
                            onChange={(event) =>
                              toggleCreateKeys(
                                rowPermissionKeys,
                                event.target.checked,
                              )
                            }
                          />
                          <span className="font-medium">{row.moduleName}</span>
                        </label>
                      </td>
                      {createActionColumns.map((action) => {
                        const cell = row.actionMap.get(action) || [];
                        const keys = cell
                          .map((permission) =>
                            String(permission?.key || "").trim(),
                          )
                          .filter(Boolean);
                        const checked =
                          keys.length > 0 &&
                          keys.every((permissionKey) =>
                            createDraftPermissionSet.has(permissionKey),
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
                                  disabled={saving}
                                  onChange={(event) =>
                                    toggleCreateKeys(keys, event.target.checked)
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

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={onCreateRole}>
              {saving ? "Creating..." : "Create Role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
