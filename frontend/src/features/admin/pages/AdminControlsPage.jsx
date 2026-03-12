import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/shared/components/layout/PageHeader";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  getRolePermissionMap,
  resetRolePermissionMapToDefaults,
  saveRolePermissionMap,
  syncRolePermissionMapFromServer,
} from "@/shared/auth/permissions";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

export default function AdminControlsPage() {
  const [feedback, setFeedback] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [permissionDraft, setPermissionDraft] = useState(() =>
    getRolePermissionMap(),
  );

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

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      if (confirmAction.type === "save_permissions") {
        await saveRolePermissionMap(permissionDraft);
        showSuccess("Roles and permissions updated.");
      } else if (confirmAction.type === "reset_permissions") {
        const next = await resetRolePermissionMapToDefaults();
        setPermissionDraft(next);
        showSuccess("Roles and permissions reset to defaults.");
      }
      setConfirmAction(null);
    } catch (error) {
      showError(error.message || "Action failed.");
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Admin Controls"
        description="Manage centralized role permissions. User account creation now lives in User Management."
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
                    {(permissionDraft[role] || []).length}/{permissionKeys.length}
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
