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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                Administration
              </p>
              <CardTitle className="mt-1 text-2xl text-[#1E3A8A]">
                Access Control Panel
              </CardTitle>
              <p className="mt-2 text-sm text-slate-600">
                Manage roles and permission matrix with a scalable RBAC layout.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={reloadBaseData}
              disabled={loading || saving}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-5">
          <div className="mt-4">
            <div className="grid gap-4 xl:grid-cols-12">
              <Card className="xl:col-span-6 border-blue-200/70">
                <CardHeader className="space-y-2 border-b border-blue-200/70 bg-blue-50/25 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base text-[#1E3A8A]">
                      Roles
                    </CardTitle>
                    <Button
                      size="sm"
                      onClick={() => {
                        setCreateForm({ name: "", description: "" });
                        setCreateDraftPermissionSet(new Set());
                        setCreateModalOpen(true);
                      }}
                    >
                      Add Role
                    </Button>
                  </div>
                  <Input
                    placeholder="Search role"
                    value={roleSearch}
                    onChange={(event) => setRoleSearch(event.target.value)}
                  />
                </CardHeader>
                <CardContent className="max-h-[520px] space-y-2 overflow-auto p-3">
                  {filteredRoles.map((role) => {
                    const selected = role.id === selectedRoleId;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setSelectedRoleId(role.id)}
                        className={[
                          "w-full rounded-lg border px-3 py-2 text-left transition",
                          selected
                            ? "border-[#1E3A8A] bg-blue-100/70 ring-1 ring-blue-200"
                            : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/40",
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

              <Card className="xl:col-span-6 border-blue-200/70">
                <CardHeader className="border-b border-blue-200/70 bg-blue-50/25 p-4">
                  <CardTitle className="text-base text-[#1E3A8A]">
                    Role Details
                  </CardTitle>
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
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              name: event.target.value,
                            }))
                          }
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
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              description: event.target.value,
                            }))
                          }
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
                          onClick={() => setConfirmDelete(selectedRole)}
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
                        disabled={
                          isReadonlyRole || filteredPermissionKeys.length === 0
                        }
                        onClick={() => toggleKeys(filteredPermissionKeys, true)}
                      >
                        Select All Visible
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          isReadonlyRole || filteredPermissionKeys.length === 0
                        }
                        onClick={() =>
                          toggleKeys(filteredPermissionKeys, false)
                        }
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
                                    disabled={
                                      isReadonlyRole || keys.length === 0
                                    }
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
                            rowPermissionKeys.every((key) =>
                              draftPermissionSet.has(key),
                            );
                          return (
                            <tr
                              key={row.moduleName}
                              className="hover:bg-blue-50/80"
                            >
                              <td className="border-b border-blue-100 px-3 py-2">
                                <label className="inline-flex cursor-pointer items-center gap-2 text-slate-800">
                                  <input
                                    type="checkbox"
                                    checked={rowChecked}
                                    disabled={
                                      isReadonlyRole ||
                                      rowPermissionKeys.length === 0
                                    }
                                    onChange={(event) =>
                                      toggleRow(
                                        row.moduleName,
                                        event.target.checked,
                                      )
                                    }
                                  />
                                  <span className="font-medium">
                                    {row.moduleName}
                                  </span>
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
                                      <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-blue-200/80 bg-blue-100/70 px-2 py-1">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          disabled={isReadonlyRole}
                                          onChange={(event) =>
                                            toggleCell(
                                              keys,
                                              event.target.checked,
                                            )
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
                      onClick={() =>
                        setDraftPermissionSet(new Set(currentPermissionSet))
                      }
                    >
                      Reset Draft
                    </Button>
                    {hasUnsavedPermissionChanges ? (
                      <Badge variant="secondary">Unsaved changes</Badge>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
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
                              <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-blue-200/80 bg-blue-100/70 px-2 py-1">
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
