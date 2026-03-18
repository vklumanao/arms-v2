import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-sm font-bold uppercase tracking-[0.08em] text-slate-600">
              Roles & Permissions
            </CardTitle>
            <p className="text-xs text-slate-500">
              Simple access matrix for Student, Faculty, and Admin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={resetPermissions}>
              Reset Defaults
            </Button>
            <Button onClick={savePermissions}>Save Permissions</Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
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
                      onClick={() => setPermissionsForRole(role, [])}
                    >
                      Clear
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)]">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-left font-semibold text-slate-700">
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
                {permissionKeys.map((permission) => (
                  <TableRow
                    key={`permission-row-${permission}`}
                  >
                    <TableCell className="text-slate-700">
                      <p className="font-medium">
                        {PERMISSION_LABELS[permission] || permission}
                      </p>
                      <p className="text-xs text-slate-500">{permission}</p>
                    </TableCell>
                    {roleKeys.map((role) => (
                      <TableCell
                        key={`permission-cell-${permission}-${role}`}
                        className="text-center"
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
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
