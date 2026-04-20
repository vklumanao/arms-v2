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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";

const BASE_ACTION_COLUMNS = ["create", "view", "edit", "delete"];

function areSetsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a.values()) {
    if (!b.has(value)) return false;
  }
  return true;
}

export default function AdminAccessControlPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("roles");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [currentPermissionSet, setCurrentPermissionSet] = useState(new Set());
  const [draftPermissionSet, setDraftPermissionSet] = useState(new Set());
  const [roleSearch, setRoleSearch] = useState("");
  const [moduleSearch, setModuleSearch] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [createDraftPermissionSet, setCreateDraftPermissionSet] = useState(
    new Set(),
  );
  const [createModuleSearch, setCreateModuleSearch] = useState("");
  const [createPermissionSearch, setCreatePermissionSearch] = useState("");
  const [createActionFilter, setCreateActionFilter] = useState("all");
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

  const normalizedActionFilter = String(actionFilter || "all")
    .trim()
    .toLowerCase();
  const filteredPermissions = useMemo(() => {
    const moduleKeyword = String(moduleSearch || "")
      .trim()
      .toLowerCase();
    const permissionKeyword = String(permissionSearch || "")
      .trim()
      .toLowerCase();
    return permissions.filter((permission) => {
      const moduleName = String(permission?.module || "General").trim();
      const action = String(permission?.action || "manage")
        .trim()
        .toLowerCase();
      const label = String(permission?.label || "").toLowerCase();
      const key = String(permission?.key || "").toLowerCase();
      const moduleText = moduleName.toLowerCase();
      if (moduleKeyword && !moduleText.includes(moduleKeyword)) return false;
      if (
        permissionKeyword &&
        !label.includes(permissionKeyword) &&
        !key.includes(permissionKeyword)
      ) {
        return false;
      }
      if (normalizedActionFilter !== "all" && action !== normalizedActionFilter)
        return false;
      return true;
    });
  }, [permissions, moduleSearch, permissionSearch, normalizedActionFilter]);

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
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([moduleName, actionMap]) => ({ moduleName, actionMap }));
  }, [filteredPermissions]);

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
      setCreateModuleSearch("");
      setCreatePermissionSearch("");
      setCreateActionFilter("all");
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

  const createNormalizedActionFilter = String(createActionFilter || "all")
    .trim()
    .toLowerCase();
  const createFilteredPermissions = useMemo(() => {
    const moduleKeyword = String(createModuleSearch || "")
      .trim()
      .toLowerCase();
    const permissionKeyword = String(createPermissionSearch || "")
      .trim()
      .toLowerCase();
    return permissions.filter((permission) => {
      const moduleName = String(permission?.module || "General").trim();
      const action = String(permission?.action || "manage")
        .trim()
        .toLowerCase();
      const label = String(permission?.label || "").toLowerCase();
      const key = String(permission?.key || "").toLowerCase();
      const moduleText = moduleName.toLowerCase();
      if (moduleKeyword && !moduleText.includes(moduleKeyword)) return false;
      if (
        permissionKeyword &&
        !label.includes(permissionKeyword) &&
        !key.includes(permissionKeyword)
      ) {
        return false;
      }
      if (
        createNormalizedActionFilter !== "all" &&
        action !== createNormalizedActionFilter
      ) {
        return false;
      }
      return true;
    });
  }, [
    permissions,
    createModuleSearch,
    createPermissionSearch,
    createNormalizedActionFilter,
  ]);

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
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([moduleName, actionMap]) => ({ moduleName, actionMap }));
  }, [createFilteredPermissions]);

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
      <Card className="border-zinc-200 bg-white shadow-sm">
        <CardHeader className="border-b border-zinc-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Administration
              </p>
              <CardTitle className="mt-1 text-2xl">
                Access Control Panel
              </CardTitle>
              <p className="mt-2 text-sm text-zinc-600">
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
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="border border-zinc-200 bg-zinc-50">
              <TabsTrigger value="roles">Roles</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
            </TabsList>

            <TabsContent value="roles" className="mt-4">
              <div className="grid gap-4 xl:grid-cols-12">
                <Card className="xl:col-span-3">
                  <CardHeader className="space-y-2 border-b border-zinc-100 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">Roles</CardTitle>
                      <Button
                        size="sm"
                        onClick={() => {
                          setCreateForm({ name: "", description: "" });
                          setCreateDraftPermissionSet(new Set());
                          setCreateModuleSearch("");
                          setCreatePermissionSearch("");
                          setCreateActionFilter("all");
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
                              ? "border-zinc-900 bg-zinc-100"
                              : "border-zinc-200 bg-white hover:border-zinc-400",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-zinc-900">
                                {role.name}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {role.key}
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
                      <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-sm text-zinc-600">
                        No roles found.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>

                <Card className="xl:col-span-3">
                  <CardHeader className="border-b border-zinc-100 p-4">
                    <CardTitle className="text-base">Role Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    {selectedRole ? (
                      <>
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
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
                          <p>
                            Users:{" "}
                            {Number(selectedRole.assigned_user_count || 0)}
                          </p>
                          <p>
                            Permissions:{" "}
                            {Number(selectedRole.permission_count || 0)}
                          </p>
                        </div>
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
                        {isReadonlyRole ? (
                          <p className="text-xs text-zinc-500">
                            Admin/Critical role is protected from edits.
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-zinc-600">
                        Select a role to manage details.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="xl:col-span-6">
                  <CardHeader className="space-y-2 border-b border-zinc-100 p-4">
                    <CardTitle className="text-base">
                      Permissions Matrix
                    </CardTitle>
                    <div className="grid gap-2 md:grid-cols-3">
                      <Input
                        placeholder="Filter modules"
                        value={moduleSearch}
                        onChange={(event) =>
                          setModuleSearch(event.target.value)
                        }
                      />
                      <Input
                        placeholder="Search permission"
                        value={permissionSearch}
                        onChange={(event) =>
                          setPermissionSearch(event.target.value)
                        }
                      />
                      <select
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={actionFilter}
                        onChange={(event) =>
                          setActionFilter(event.target.value)
                        }
                      >
                        <option value="all">All Actions</option>
                        {Array.from(
                          new Set(
                            permissions
                              .map((permission) =>
                                String(permission?.action || "manage")
                                  .trim()
                                  .toLowerCase(),
                              )
                              .filter(Boolean),
                          ),
                        )
                          .sort((a, b) => a.localeCompare(b))
                          .map((action) => (
                            <option key={action} value={action}>
                              {action}
                            </option>
                          ))}
                      </select>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    <div className="overflow-auto rounded-lg border border-zinc-200">
                      <table className="w-full min-w-[720px] border-collapse text-sm">
                        <thead className="bg-zinc-50">
                          <tr>
                            <th className="border-b border-zinc-200 px-3 py-2 text-left font-semibold text-zinc-700">
                              Module
                            </th>
                            {actionColumns.map((action) => {
                              const keys = columnKeys(action);
                              const checked =
                                keys.length > 0 &&
                                keys.every((key) =>
                                  draftPermissionSet.has(key),
                                );
                              return (
                                <th
                                  key={action}
                                  className="border-b border-zinc-200 px-3 py-2 text-center font-semibold uppercase tracking-[0.08em] text-zinc-600"
                                >
                                  <label className="inline-flex cursor-pointer items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={
                                        isReadonlyRole || keys.length === 0
                                      }
                                      onChange={(event) =>
                                        toggleColumn(
                                          action,
                                          event.target.checked,
                                        )
                                      }
                                    />
                                    <span>{action}</span>
                                  </label>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
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
                                className="hover:bg-zinc-50/80"
                              >
                                <td className="border-b border-zinc-100 px-3 py-2 text-zinc-800">
                                  <label className="inline-flex cursor-pointer items-center gap-2">
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
                                      className="border-b border-zinc-100 px-3 py-2 text-center"
                                    >
                                      {keys.length > 0 ? (
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
                                      ) : (
                                        <span className="text-zinc-300">-</span>
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
            </TabsContent>

            <TabsContent value="permissions" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Permissions Catalog
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {permissions.map((permission) => (
                    <div
                      key={permission.id || permission.key}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-zinc-900">
                        {permission.label || permission.key}
                      </p>
                      <p className="text-xs text-zinc-600">
                        {permission.module} | {permission.action || "manage"} |{" "}
                        {permission.key}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-600">
                    User-role assignment is intentionally out of scope in this
                    screen.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
        <DialogContent className="max-h-[92vh] w-full max-w-6xl overflow-y-auto border border-zinc-200 bg-white">
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
            <DialogDescription className="text-zinc-600">
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

          <div className="grid gap-2 md:grid-cols-3">
            <Input
              placeholder="Filter modules"
              value={createModuleSearch}
              onChange={(event) => setCreateModuleSearch(event.target.value)}
            />
            <Input
              placeholder="Search permission"
              value={createPermissionSearch}
              onChange={(event) =>
                setCreatePermissionSearch(event.target.value)
              }
            />
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={createActionFilter}
              onChange={(event) => setCreateActionFilter(event.target.value)}
            >
              <option value="all">All Actions</option>
              {Array.from(
                new Set(
                  permissions
                    .map((permission) =>
                      String(permission?.action || "manage")
                        .trim()
                        .toLowerCase(),
                    )
                    .filter(Boolean),
                ),
              )
                .sort((a, b) => a.localeCompare(b))
                .map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
            </select>
          </div>

          <div className="overflow-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="border-b border-zinc-200 px-3 py-2 text-left font-semibold text-zinc-700">
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
                        className="border-b border-zinc-200 px-3 py-2 text-center font-semibold uppercase tracking-[0.08em] text-zinc-600"
                      >
                        <label className="inline-flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={keys.length === 0 || saving}
                            onChange={(event) =>
                              toggleCreateKeys(keys, event.target.checked)
                            }
                          />
                          <span>{action}</span>
                        </label>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {createMatrixRows.map((row) => {
                  const rowPermissionKeys = createRowKeys(row.moduleName);
                  const rowChecked =
                    rowPermissionKeys.length > 0 &&
                    rowPermissionKeys.every((key) =>
                      createDraftPermissionSet.has(key),
                    );
                  return (
                    <tr key={row.moduleName} className="hover:bg-zinc-50/80">
                      <td className="border-b border-zinc-100 px-3 py-2 text-zinc-800">
                        <label className="inline-flex cursor-pointer items-center gap-2">
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
                            className="border-b border-zinc-100 px-3 py-2 text-center"
                          >
                            {keys.length > 0 ? (
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={saving}
                                onChange={(event) =>
                                  toggleCreateKeys(keys, event.target.checked)
                                }
                              />
                            ) : (
                              <span className="text-zinc-300">-</span>
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
