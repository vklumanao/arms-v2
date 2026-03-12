import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/shared/components/layout/PageHeader";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";
import { ReferenceCard } from "@/features/admin/components";
import { logAdminActivity } from "@/features/admin/utils";
import { getRefMeta } from "@/features/admin/utils";
import {
  createProponentAccount,
  deleteReference,
  fetchReferenceData,
  fetchReferenceUsageCounts,
  updateReference,
} from "@/features/admin/services";
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  getRolePermissionMap,
  resetRolePermissionMapToDefaults,
  saveRolePermissionMap,
  syncRolePermissionMapFromServer,
} from "@/shared/auth/permissions";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Pencil,
  Trash2,
  Users,
  X,
} from "lucide-react";

export default function AdminControlsPage() {
  const EMPTY_PROPONENT_FORM = {
    full_name: "",
    email: "",
    role: "faculty",
    ckan_org_id: "",
    ckan_group_id: "",
  };
  const [centers, setCenters] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [proponents, setProponents] = useState([]);
  const [form, setForm] = useState({
    proponent: "",
  });
  const [feedback, setFeedback] = useState(null);
  const [editingRef, setEditingRef] = useState({
    type: null,
    id: null,
    value: "",
  });
  const [savingRefByKey, setSavingRefByKey] = useState({});
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [permissionDraft, setPermissionDraft] = useState(() =>
    getRolePermissionMap(),
  );
  const [proponentModalOpen, setProponentModalOpen] = useState(false);
  const [proponentForm, setProponentForm] = useState(EMPTY_PROPONENT_FORM);
  const [proponentSaving, setProponentSaving] = useState(false);
  const [proponentCreateResult, setProponentCreateResult] = useState(null);

  const showSuccess = (text) => {
    setFeedback({ type: "success", text });
    window.clearTimeout(window.__armsAdminControlsFeedbackTimer);
    window.__armsAdminControlsFeedbackTimer = window.setTimeout(() => {
      setFeedback(null);
    }, 8000);
  };

  const showError = (text) => {
    setFeedback({ type: "error", text });
    window.clearTimeout(window.__armsAdminControlsFeedbackTimer);
    window.__armsAdminControlsFeedbackTimer = window.setTimeout(() => {
      setFeedback(null);
    }, 13000);
  };

  const load = async () => {
    const { centersRes, departmentsRes, proponentsRes } =
      await fetchReferenceData({});
    setCenters(centersRes.data || []);
    setDepartments(departmentsRes.data || []);
    setProponents(proponentsRes.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let active = true;
    syncRolePermissionMapFromServer()
      .then((nextMap) => {
        if (active) setPermissionDraft(nextMap);
      })
      .catch((error) => {
        if (!active) return;
        showError(
          error.message || "Failed to load centralized role permissions.",
        );
      });

    return () => {
      active = false;
    };
  }, []);

  const roleKeys = useMemo(() => Object.keys(ROLE_LABELS), []);
  const permissionKeys = useMemo(() => Object.values(PERMISSIONS), []);

  const openProponentModal = () => {
    setFeedback(null);
    setProponentCreateResult(null);
    setProponentForm({
      ...EMPTY_PROPONENT_FORM,
      full_name: form.proponent.trim(),
    });
    setProponentModalOpen(true);
  };

  const closeProponentModal = () => {
    if (proponentSaving) return;
    setProponentModalOpen(false);
    setProponentCreateResult(null);
    setProponentForm(EMPTY_PROPONENT_FORM);
    setForm((prev) => ({ ...prev, proponent: "" }));
  };

  const submitProponentAccount = async () => {
    setFeedback(null);
    const full_name = String(proponentForm.full_name || "").trim();
    const email = String(proponentForm.email || "")
      .trim()
      .toLowerCase();
    if (!full_name) {
      showError("Proponent full name is required.");
      return;
    }
    if (full_name.length < 3) {
      showError("Proponent full name must be at least 3 characters.");
      return;
    }
    if (!email) {
      showError("Proponent email is required.");
      return;
    }
    setProponentSaving(true);
    const { data, error: insertError } = await createProponentAccount({
      full_name,
      email,
      role: proponentForm.role,
      ckan_org_id: proponentForm.ckan_org_id || null,
      ckan_group_id: proponentForm.ckan_group_id || null,
      department:
        departments.find((row) => row.id === proponentForm.ckan_group_id)
          ?.name || null,
    });
    setProponentSaving(false);
    if (insertError) {
      showError(insertError.message);
      return;
    }
    void logAdminActivity("proponent_account_created", "proponent", data?.id, {
      full_name,
      email,
      role: proponentForm.role,
      ckan_org_id: proponentForm.ckan_org_id || null,
      ckan_group_id: proponentForm.ckan_group_id || null,
    });
    setProponentCreateResult(data || null);
    showSuccess("Proponent account created successfully.");
    setForm((p) => ({ ...p, proponent: "" }));
    await load();
  };

  const getSetRowsByType = (type) => {
    if (type === "proponent") return setProponents;
    return () => {};
  };

  const startEditRef = (type, row) => {
    setEditingRef({ type, id: row.id, value: row.name || "" });
  };

  const cancelEditRef = () => {
    setEditingRef({ type: null, id: null, value: "" });
  };

  const saveEditRef = async (confirmed = false) => {
    setFeedback(null);
    const nextName = editingRef.value.trim();
    if (!editingRef.id || !editingRef.type || !nextName) {
      showError("Name is required.");
      return;
    }
    if (nextName.length < 2) {
      showError("Name must be at least 2 characters.");
      return;
    }
    if (!confirmed) {
      setConfirmAction({
        type: "save_edit_ref",
        title: "Confirm Update",
        message: `Save changes to "${nextName}"?`,
        confirmLabel: "Save Changes",
      });
      return;
    }

    const { label, entity } = getRefMeta(editingRef.type);
    const setRows = getSetRowsByType(editingRef.type);
    const key = `${editingRef.type}:${editingRef.id}`;
    setSavingRefByKey((prev) => ({ ...prev, [key]: true }));

    const { data, error: updateError } = await updateReference({
      type: editingRef.type,
      id: editingRef.id,
      name: nextName,
    });

    if (updateError) {
      showError(
        updateError.message || `Failed to update ${label.toLowerCase()}.`,
      );
      setSavingRefByKey((prev) => ({ ...prev, [key]: false }));
      return;
    }
    if (!data) {
      showError(`No ${label.toLowerCase()} row was updated.`);
      setSavingRefByKey((prev) => ({ ...prev, [key]: false }));
      return;
    }

    setRows((prev) =>
      prev.map((row) => (row.id === data.id ? { ...row, ...data } : row)),
    );
    void logAdminActivity("reference_updated", entity, data.id, {
      name: data.name,
    });
    setSavingRefByKey((prev) => ({ ...prev, [key]: false }));
    showSuccess(`${label} updated successfully.`);
    cancelEditRef();
  };

  const askDeleteRef = (type, row) => {
    if (!row?.id) return;
    const { label } = getRefMeta(type);
    setDeleteDialog({
      type,
      row,
      title: `Delete ${label}?`,
      text: `This will permanently remove "${row.name}" from the ${label.toLowerCase()} list.`,
      loading: true,
      projectCount: 0,
      profileCount: 0,
    });

    const loadLinkedCounts = async () => {
      const { projectCount, profileCount } = await fetchReferenceUsageCounts({
        type,
        id: row.id,
      });

      setDeleteDialog((prev) => {
        if (!prev || prev.type !== type || prev.row?.id !== row.id) return prev;
        return { ...prev, loading: false, projectCount, profileCount };
      });
    };

    loadLinkedCounts();
  };

  const deleteRef = async (type, row) => {
    setFeedback(null);
    if (!row?.id) return;

    const { label, entity } = getRefMeta(type);
    const setRows = getSetRowsByType(type);
    const key = `${type}:${row.id}`;

    setSavingRefByKey((prev) => ({ ...prev, [key]: true }));
    const { error: deleteError } = await deleteReference({
      type,
      id: row.id,
    });

    if (deleteError) {
      const isReferenceConflict =
        deleteError.code === "23503" ||
        deleteError.code === "409" ||
        /foreign key|constraint|reference/i.test(deleteError.message || "");
      if (isReferenceConflict) {
        showError(
          `${label} cannot be deleted because it is still in use by existing records (such as linked projects or users). Reassign those records first, then try again.`,
        );
      } else {
        showError(
          deleteError.message ||
            `Failed to delete ${label.toLowerCase()}. It may still be in use.`,
        );
      }
      setSavingRefByKey((prev) => ({ ...prev, [key]: false }));
      return;
    }

    setRows((prev) => prev.filter((item) => item.id !== row.id));
    void logAdminActivity("reference_deleted", entity, row.id, {
      name: row.name,
    });
    setSavingRefByKey((prev) => ({ ...prev, [key]: false }));
    showSuccess(`${label} deleted successfully.`);
    if (editingRef.type === type && editingRef.id === row.id) {
      cancelEditRef();
    }
    setDeleteDialog(null);
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      if (confirmAction.type === "save_permissions") {
        await saveRolePermissionMap(permissionDraft);
        void logAdminActivity("permissions_updated", "role_permissions", null, {
          permission_map: permissionDraft,
        });
        showSuccess("Roles and permissions updated.");
      } else if (confirmAction.type === "reset_permissions") {
        const next = await resetRolePermissionMapToDefaults();
        setPermissionDraft(next);
        void logAdminActivity(
          "permissions_reset",
          "role_permissions",
          null,
          {},
        );
        showSuccess("Roles and permissions reset to defaults.");
      } else if (confirmAction.type === "save_edit_ref") {
        await saveEditRef(true);
      }
      setConfirmAction(null);
    } catch (error) {
      showError(error.message || "Action failed.");
    } finally {
      setConfirmLoading(false);
    }
  };

  const togglePermissionForRole = (role, permission, checked) => {
    setPermissionDraft((prev) => {
      const current = new Set(prev[role] || []);
      if (checked) {
        current.add(permission);
      } else {
        current.delete(permission);
      }
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

  const savePermissions = () => {
    setConfirmAction({
      type: "save_permissions",
      title: "Confirm Permission Update",
      message:
        "Apply these role-permission changes? This will take effect immediately.",
      confirmLabel: "Apply Changes",
    });
  };

  const resetPermissions = () => {
    setConfirmAction({
      type: "reset_permissions",
      title: "Reset Permissions",
      message:
        "Reset all role permissions to default values? This cannot be undone.",
      confirmLabel: "Reset",
    });
  };

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Admin Controls"
        description="Manage proponent accounts and centralized permissions."
      />
      {feedback ? (
        <div
          className={`rounded-[var(--radius-sm)] border px-3 py-2 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 size={16} className="mt-0.5" />
              ) : (
                <AlertCircle size={16} className="mt-0.5" />
              )}
              <div>
                <p className="font-semibold">
                  {feedback.type === "success"
                    ? "Action completed"
                    : "Action failed"}
                </p>
                <p>{feedback.text}</p>
              </div>
            </div>
            <button
              className="text-current/70 hover:text-current"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4">
        <ReferenceCard
          icon={<Users size={18} />}
          title="Proponents"
          subtitle="Create and manage faculty/student accounts used in submission forms."
          value={form.proponent}
          placeholder="Optional full name prefill for new account"
          onChange={(e) =>
            setForm((p) => ({ ...p, proponent: e.target.value }))
          }
          onAdd={openProponentModal}
          items={proponents}
          renderItem={(proponent) => (
            <li
              key={proponent.id}
              className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {editingRef.type === "proponent" &&
                editingRef.id === proponent.id ? (
                  <input
                    className="control-input h-9"
                    value={editingRef.value}
                    onChange={(e) =>
                      setEditingRef((prev) => ({
                        ...prev,
                        value: e.target.value,
                      }))
                    }
                  />
                ) : (
                  <div className="min-w-0">
                    <p className="truncate font-medium">{proponent.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {proponent.email || "No email"} ·{" "}
                      {proponent.role || "user"}
                    </p>
                  </div>
                )}
              </div>
              <div className="ml-3 flex items-center gap-1">
                {editingRef.type === "proponent" &&
                editingRef.id === proponent.id ? (
                  <>
                    <button
                      className="btn btn-outline px-2"
                      disabled={Boolean(
                        savingRefByKey[`proponent:${proponent.id}`],
                      )}
                      onClick={saveEditRef}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      className="btn btn-outline px-2"
                      onClick={cancelEditRef}
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-outline px-2"
                      disabled={Boolean(
                        savingRefByKey[`proponent:${proponent.id}`],
                      )}
                      onClick={() => startEditRef("proponent", proponent)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn btn-outline px-2 text-red-700 hover:bg-red-50"
                      disabled={Boolean(
                        savingRefByKey[`proponent:${proponent.id}`],
                      )}
                      onClick={() => askDeleteRef("proponent", proponent)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </li>
          )}
        />
      </div>

      <div className="panel">
        <div className="panel-header flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-600">
              Roles & Permissions
            </h2>
            <p className="text-xs text-slate-500">
              Simple access matrix for Student, Faculty, and Admin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-outline" onClick={resetPermissions}>
              Reset Defaults
            </button>
            <button className="btn btn-primary" onClick={savePermissions}>
              Save Permissions
            </button>
          </div>
        </div>

        <div className="panel-body space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {roleKeys.map((role) => (
              <div
                key={`role-summary-${role}`}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>{ROLE_LABELS[role]}</span>
                  <span>
                    {(permissionDraft[role] || []).length}/
                    {permissionKeys.length}
                  </span>
                </div>
                <div className="mt-2 flex gap-1">
                  <button
                    className="btn btn-outline h-7 px-2 text-[11px]"
                    onClick={() => setPermissionsForRole(role, permissionKeys)}
                  >
                    Select all
                  </button>
                  <button
                    className="btn btn-outline h-7 px-2 text-[11px]"
                    onClick={() => setPermissionsForRole(role, [])}
                  >
                    Clear
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)]">
            <table className="data-table">
              <thead className="bg-[var(--surface-muted)]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">
                    Permission
                  </th>
                  {roleKeys.map((role) => (
                    <th
                      key={`role-column-${role}`}
                      className="px-3 py-2 text-center font-semibold text-slate-700"
                    >
                      {ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionKeys.map((permission) => (
                  <tr
                    key={`permission-row-${permission}`}
                    className="border-t border-[var(--border)]"
                  >
                    <td className="px-3 py-2 text-slate-700">
                      <p className="font-medium">
                        {PERMISSION_LABELS[permission] || permission}
                      </p>
                      <p className="text-xs text-slate-500">{permission}</p>
                    </td>
                    {roleKeys.map((role) => (
                      <td
                        key={`permission-cell-${permission}-${role}`}
                        className="px-3 py-2 text-center"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-slate-700"
                          checked={Boolean(
                            (permissionDraft[role] || []).includes(permission),
                          )}
                          onChange={(e) =>
                            togglePermissionForRole(
                              role,
                              permission,
                              e.target.checked,
                            )
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {deleteDialog ? (
        <div
          className="modal-overlay modal-overlay-centered"
          onClick={() => setDeleteDialog(null)}
        >
          <div
            className="modal-dialog modal-dialog-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel">
              <div className="panel-header">
                <h3 className="text-base font-semibold text-slate-900">
                  {deleteDialog.title}
                </h3>
              </div>
              <div className="panel-body space-y-4">
                <p className="text-sm text-slate-600">{deleteDialog.text}</p>
                <div className="app-card-muted app-card-compact text-sm text-slate-700">
                  {deleteDialog.loading ? (
                    <p>Checking linked records...</p>
                  ) : (
                    <div className="space-y-1">
                      <p>
                        Linked projects:{" "}
                        <span className="font-semibold">
                          {deleteDialog.projectCount || 0}
                        </span>
                      </p>
                      {deleteDialog.type === "center" ? (
                        <p>
                          Linked user profiles:{" "}
                          <span className="font-semibold">
                            {deleteDialog.profileCount || 0}
                          </span>
                        </p>
                      ) : null}
                      {(deleteDialog.projectCount || 0) > 0 ||
                      (deleteDialog.profileCount || 0) > 0 ? (
                        <p className="text-xs text-amber-700">
                          This record is currently in use. Reassign linked
                          records first before deleting.
                        </p>
                      ) : (
                        <p className="text-xs text-emerald-700">
                          No linked records found.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    className="btn btn-outline"
                    onClick={() => setDeleteDialog(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={Boolean(
                      deleteDialog?.loading ||
                      deleteDialog?.projectCount > 0 ||
                      deleteDialog?.profileCount > 0 ||
                      (deleteDialog?.type &&
                        deleteDialog?.row?.id &&
                        savingRefByKey[
                          `${deleteDialog.type}:${deleteDialog.row.id}`
                        ]),
                    )}
                    onClick={() =>
                      deleteRef(deleteDialog.type, deleteDialog.row)
                    }
                  >
                    {deleteDialog.loading ? "Checking..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {proponentModalOpen ? (
        <div
          className="modal-overlay modal-overlay-centered"
          onClick={closeProponentModal}
        >
          <div
            className="modal-dialog modal-dialog-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel">
              <div className="panel-header flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Create Proponent Account
                  </h3>
                  <p className="text-sm text-slate-500">
                    This creates a real ARMS user account with temporary
                    credentials.
                  </p>
                </div>
                <button
                  className="btn btn-outline px-2"
                  onClick={closeProponentModal}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="panel-body space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">
                      Full Name
                    </span>
                    <input
                      className="control-input"
                      value={proponentForm.full_name}
                      onChange={(e) =>
                        setProponentForm((prev) => ({
                          ...prev,
                          full_name: e.target.value,
                        }))
                      }
                      placeholder="e.g. DELA CRUZ, JUAN A."
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Email</span>
                    <input
                      className="control-input"
                      type="email"
                      value={proponentForm.email}
                      onChange={(e) =>
                        setProponentForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      placeholder="juan.delacruz@carsu.edu.ph"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Role</span>
                    <select
                      className="control-select"
                      value={proponentForm.role}
                      onChange={(e) =>
                        setProponentForm((prev) => ({
                          ...prev,
                          role: e.target.value,
                        }))
                      }
                    >
                      <option value="faculty">Faculty</option>
                      <option value="student">Student</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">
                      Research Center
                    </span>
                    <select
                      className="control-select"
                      value={proponentForm.ckan_org_id}
                      onChange={(e) =>
                        setProponentForm((prev) => ({
                          ...prev,
                          ckan_org_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">None</option>
                      {centers.map((center) => (
                        <option key={center.id} value={center.id}>
                          {center.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm md:col-span-2">
                    <span className="font-medium text-slate-700">
                      Department
                    </span>
                    <select
                      className="control-select"
                      value={proponentForm.ckan_group_id}
                      onChange={(e) =>
                        setProponentForm((prev) => ({
                          ...prev,
                          ckan_group_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">None</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {proponentCreateResult?.temporary_password ? (
                  <div className="app-card-muted app-card-compact text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">
                      Account created
                    </p>
                    <p className="mt-1">
                      Temporary password:{" "}
                      <span className="font-mono font-semibold">
                        {proponentCreateResult.temporary_password}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Share this once, then ask the user to change it after the
                      first login.
                    </p>
                  </div>
                ) : null}

                <div className="flex justify-end gap-2">
                  <button
                    className="btn btn-outline"
                    onClick={closeProponentModal}
                    disabled={proponentSaving}
                  >
                    Close
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={submitProponentAccount}
                    disabled={proponentSaving}
                  >
                    {proponentSaving ? "Creating..." : "Create Account"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
