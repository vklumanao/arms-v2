import { useEffect, useMemo, useState } from "react";
import { useReferenceData } from "@/shared/hooks/useReferenceData";
import { isValidEmail } from "@/shared/utils/validation";
import PageHeader from "@/shared/components/layout/PageHeader";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";
import { useToast } from "@/app/providers/ToastProvider";
import {
  fetchAdminUserDetail,
  fetchAdminUsers,
  sendAdminPasswordReset,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "@/features/admin/services";
import {
  BadgeCheck,
  Briefcase,
  Mail,
  Search,
  ShieldCheck,
  UserCheck,
  UserCog,
  Users,
} from "lucide-react";

const ROLE_OPTIONS = ["student", "faculty", "admin"];

export default function AdminUsersPage() {
  const { centers } = useReferenceData();
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [savingUserById, setSavingUserById] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [detailUser, setDetailUser] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [pendingResetByUserId, setPendingResetByUserId] = useState({});
  const toast = useToast();
  const [detailData, setDetailData] = useState({
    submissionsCount: 0,
    currentProjectsCount: 0,
    statusCounts: { proposal: 0, ongoing: 0, completed: 0, rejected: 0 },
    projects: [],
    statusHistory: [],
    roleAudit: [],
    roleAuditActorMap: {},
  });

  useEffect(() => {
    if (error) toast.error("User action failed", error);
  }, [error, toast]);

  useEffect(() => {
    if (message) toast.success("User action completed", message);
  }, [message, toast]);

  const centerNameById = useMemo(() => {
    const map = {};
    (centers || []).forEach((center) => {
      map[center.id] = center.name;
    });
    return map;
  }, [centers]);

  const getCompleteness = (user) => {
    const checks = {
      contact: isValidEmail(user?.email),
      role: Boolean(user?.role),
      department: Boolean(String(user?.department || "").trim()),
      center: Boolean(user?.ckan_org_id),
    };
    const score = Object.values(checks).filter(Boolean).length;
    return { score, checks };
  };

  const loadLatestUserSnapshot = async (userId) => {
    if (!userId) return null;
    const rows = await fetchAdminUsers();
    return rows.find((row) => row.id === userId) || null;
  };

  const loadUsers = async () => {
    setError("");
    setMessage("");
    try {
      const data = await fetchAdminUsers();
      setUsers(data || []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load users.");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((user) => {
      const fullName = String(user.full_name || "").toLowerCase();
      const email = String(user.email || "").toLowerCase();
      const role = String(user.role || "").toLowerCase();
      return (
        fullName.includes(keyword) ||
        email.includes(keyword) ||
        role.includes(keyword)
      );
    });
  }, [users, userSearch]);

  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.is_active).length;
    const inactive = total - active;
    const admins = users.filter((u) => u.role === "admin").length;
    const faculty = users.filter((u) => u.role === "faculty").length;
    const students = users.filter((u) => u.role === "student").length;
    return { total, active, inactive, admins, faculty, students };
  }, [users]);

  const detailCompleteness = useMemo(
    () => (detailUser ? getCompleteness(detailUser) : null),
    [detailUser],
  );

  const updateUserRole = async (userId, nextRole) => {
    setError("");
    setMessage("");
    setSavingUserById((prev) => ({ ...prev, [userId]: true }));

    let updated = null;
    try {
      updated = await updateAdminUserRole(userId, nextRole);
    } catch (updateError) {
      setError(updateError.message || "Failed to update user role.");
      setSavingUserById((prev) => ({ ...prev, [userId]: false }));
      return;
    }
    if (!updated?.id) {
      setError("No row was updated for role change. Check admin permissions.");
      setSavingUserById((prev) => ({ ...prev, [userId]: false }));
      return;
    }
    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId ? { ...user, role: updated.role } : user,
      ),
    );
    setSavingUserById((prev) => ({ ...prev, [userId]: false }));
    setMessage("User role updated.");
  };

  const toggleUserActive = async (userId, nextActive) => {
    setError("");
    setMessage("");
    setSavingUserById((prev) => ({ ...prev, [userId]: true }));

    let updated = null;
    try {
      updated = await updateAdminUserStatus(userId, nextActive);
    } catch (updateError) {
      setError(updateError.message || "Failed to update account status.");
      setSavingUserById((prev) => ({ ...prev, [userId]: false }));
      return;
    }
    if (!updated?.id) {
      setError(
        "No row was updated for account status. Check admin permissions.",
      );
      setSavingUserById((prev) => ({ ...prev, [userId]: false }));
      return;
    }
    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId ? { ...user, is_active: updated.is_active } : user,
      ),
    );
    setSavingUserById((prev) => ({ ...prev, [userId]: false }));
    setMessage("User account status updated.");
  };

  const sendResetLink = async (email) => {
    setError("");
    setMessage("");
    if (!isValidEmail(email)) {
      setError("Selected user has no email.");
      return;
    }

    try {
      await sendAdminPasswordReset(email);
    } catch (resetError) {
      setError(resetError.message || "Failed to send reset password link.");
      return;
    }
    const target = users.find((u) => u.email === email);
    if (target?.id) {
      setPendingResetByUserId((prev) => ({ ...prev, [target.id]: true }));
    }
    setMessage(`Reset password link sent to ${email}.`);
  };

  const openRoleConfirm = (user, nextRole) => {
    if (!user?.id || !nextRole || nextRole === user.role) return;
    setConfirmAction({
      type: "role",
      userId: user.id,
      userLabel: user.full_name || user.email || "this user",
      nextRole,
      title: "Confirm Role Change",
      message: `Change role of ${user.full_name || user.email || "this user"} to ${nextRole}?`,
      confirmLabel: "Confirm Role Change",
    });
  };

  const openStatusConfirm = (user) => {
    if (!user?.id) return;
    const nextActive = !user.is_active;
    setConfirmAction({
      type: "status",
      userId: user.id,
      userLabel: user.full_name || user.email || "this user",
      nextActive,
      title: nextActive
        ? "Confirm Account Activation"
        : "Confirm Account Deactivation",
      message: `${nextActive ? "Activate" : "Deactivate"} account for ${user.full_name || user.email || "this user"}?`,
      confirmLabel: nextActive ? "Confirm Activate" : "Confirm Deactivate",
    });
  };

  const openResetConfirm = (user) => {
    if (!user?.email) {
      setError("Selected user has no email.");
      return;
    }
    setConfirmAction({
      type: "reset",
      email: user.email,
      userLabel: user.full_name || user.email || "this user",
      title: "Confirm Password Reset",
      message: `Send password reset link to ${user.email}?`,
      confirmLabel: "Send Reset Link",
    });
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);

    if (confirmAction.type === "role") {
      await updateUserRole(confirmAction.userId, confirmAction.nextRole);
    } else if (confirmAction.type === "status") {
      await toggleUserActive(confirmAction.userId, confirmAction.nextActive);
    } else if (confirmAction.type === "reset") {
      await sendResetLink(confirmAction.email);
    }

    setConfirmLoading(false);
    setConfirmAction(null);
  };

  const openUserDetail = async (user) => {
    setDetailLoading(true);
    setError("");
    try {
      const payload = await fetchAdminUserDetail(user.id);
      setDetailUser(payload?.user || user);
      setDetailData(
        payload?.detail || {
          submissionsCount: 0,
          currentProjectsCount: 0,
          statusCounts: { proposal: 0, ongoing: 0, completed: 0, rejected: 0 },
          projects: [],
          statusHistory: [],
          roleAudit: [],
          roleAuditActorMap: {},
        },
      );
    } catch (detailError) {
      setDetailUser(user);
      setError(detailError.message || "Unable to load user details.");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!detailUser?.id) return undefined;

    const interval = setInterval(async () => {
      const latest = await loadLatestUserSnapshot(detailUser.id);
      if (latest) {
        setDetailUser((prev) => {
          if (!prev || prev.id !== latest.id) return prev;
          return { ...prev, ...latest };
        });
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [detailUser?.id]);

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="User Management"
        description="Manage account access, role assignment, password reset, and account-level activity."
      />
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <div className="kpi-card flex min-h-28 flex-col justify-between">
          <p className="kpi-label flex items-center gap-1">
            <Users size={14} /> Total Users
          </p>
          <p className="kpi-value">{metrics.total}</p>
        </div>
        <div className="kpi-card flex min-h-28 flex-col justify-between">
          <p className="kpi-label flex items-center gap-1">
            <UserCheck size={14} /> Active
          </p>
          <p className="kpi-value">{metrics.active}</p>
        </div>
        <div className="kpi-card flex min-h-28 flex-col justify-between">
          <p className="kpi-label flex items-center gap-1">
            <BadgeCheck size={14} /> Inactive
          </p>
          <p className="kpi-value">{metrics.inactive}</p>
        </div>
        <div className="kpi-card flex min-h-28 flex-col justify-between">
          <p className="kpi-label flex items-center gap-1">
            <ShieldCheck size={14} /> Admins
          </p>
          <p className="kpi-value">{metrics.admins}</p>
        </div>
        <div className="kpi-card flex min-h-28 flex-col justify-between">
          <p className="kpi-label flex items-center gap-1">
            <Briefcase size={14} /> Faculty
          </p>
          <p className="kpi-value">{metrics.faculty}</p>
        </div>
        <div className="kpi-card flex min-h-28 flex-col justify-between">
          <p className="kpi-label flex items-center gap-1">
            <Users size={14} /> Student
          </p>
          <p className="kpi-value">{metrics.students}</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500 flex items-center gap-2">
            <UserCog size={15} /> Accounts Directory
          </h2>
          <label className="relative w-full lg:max-w-md">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="control-input pl-8"
              placeholder="Search user by name, email, or role"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="panel-body pt-0">
          <div className="max-h-[70vh] overflow-auto rounded-[var(--radius-sm)] border border-[var(--border)]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Last Sign-in</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No users found.</td>
                  </tr>
                ) : (
                  filteredUsers.map((user, index) => (
                    <tr key={user.id}>
                      <td>{index + 1}</td>
                      <td>{user.full_name || "-"}</td>
                      <td>{user.email || "-"}</td>
                      <td>
                        <select
                          className="control-select min-w-32"
                          value={user.role || "student"}
                          disabled={Boolean(savingUserById[user.id])}
                          onChange={(e) =>
                            openRoleConfirm(user, e.target.value)
                          }
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {(() => {
                          const state = pendingResetByUserId[user.id]
                            ? "pending_reset"
                            : user.is_active
                              ? "active"
                              : "deactivated";
                          return (
                            <span
                              className={`status-chip ${
                                state === "active"
                                  ? "status-completed"
                                  : state === "pending_reset"
                                    ? "status-proposal"
                                    : "status-rejected"
                              }`}
                            >
                              {state === "active"
                                ? "Active"
                                : state === "pending_reset"
                                  ? "Pending reset"
                                  : "Deactivated"}
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : "-"}
                      </td>
                      <td>
                        {user.last_sign_in_at
                          ? new Date(user.last_sign_in_at).toLocaleString()
                          : "Never"}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="btn btn-outline"
                            disabled={Boolean(savingUserById[user.id])}
                            onClick={() => openStatusConfirm(user)}
                          >
                            {savingUserById[user.id]
                              ? "Saving..."
                              : user.is_active
                                ? "Deactivate"
                                : "Activate"}
                          </button>
                          <button
                            className="btn btn-outline"
                            onClick={() => openResetConfirm(user)}
                          >
                            <Mail size={14} />
                            Reset
                          </button>
                          <button
                            className="btn btn-primary"
                            onClick={() => openUserDetail(user)}
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {detailUser ? (
        <div className="modal-overlay" onClick={() => setDetailUser(null)}>
          <aside
            className="ml-auto h-full w-full max-w-2xl overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-4 sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {detailUser.full_name || detailUser.email}
                </h3>
                <p className="text-sm text-slate-600">{detailUser.email}</p>
              </div>
              <button
                className="btn btn-outline"
                onClick={() => setDetailUser(null)}
              >
                Close
              </button>
            </div>
            <div className="mb-3 flex justify-end">
              <button
                className="btn btn-outline"
                onClick={async () => {
                  if (!detailUser?.id) return;
                  const latest = await loadLatestUserSnapshot(detailUser.id);
                  if (latest) setDetailUser((prev) => ({ ...prev, ...latest }));
                }}
              >
                Refresh User Info
              </button>
            </div>

            {detailLoading ? (
              <p className="text-sm text-slate-600">Loading user details...</p>
            ) : (
              <div className="space-y-4">
                <div className="app-card app-card-compact">
                  <p className="mb-2 text-sm font-semibold">User Information</p>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                        Full Name
                      </dt>
                      <dd className="font-medium text-slate-800">
                        {detailUser.full_name || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                        Email
                      </dt>
                      <dd className="font-medium text-slate-800">
                        {detailUser.email || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                        Role
                      </dt>
                      <dd className="font-medium text-slate-800">
                        {detailUser.role || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                        Account State
                      </dt>
                      <dd className="font-medium text-slate-800">
                        {pendingResetByUserId[detailUser.id]
                          ? "Pending reset"
                          : detailUser.is_active
                            ? "Active"
                            : "Deactivated"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                        Department
                      </dt>
                      <dd className="font-medium text-slate-800">
                        {detailUser.department || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                        Center
                      </dt>
                      <dd className="font-medium text-slate-800">
                        {detailUser.ckan_org_id
                          ? centerNameById[detailUser.ckan_org_id] || "-"
                          : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                        Joined
                      </dt>
                      <dd className="font-medium text-slate-800">
                        {detailUser.created_at
                          ? new Date(detailUser.created_at).toLocaleString()
                          : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                        Last Sign-in
                      </dt>
                      <dd className="font-medium text-slate-800">
                        {detailUser.last_sign_in_at
                          ? new Date(
                              detailUser.last_sign_in_at,
                            ).toLocaleString()
                          : "Never"}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs uppercase tracking-[0.06em] text-slate-500">
                        Email Confirmed
                      </dt>
                      <dd className="font-medium text-slate-800">
                        {detailUser.email_confirmed_at
                          ? new Date(
                              detailUser.email_confirmed_at,
                            ).toLocaleString()
                          : "Not confirmed"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="app-card app-card-compact">
                  <p className="mb-2 text-sm font-semibold">Account Summary</p>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const state = pendingResetByUserId[detailUser.id]
                        ? "pending_reset"
                        : detailUser.is_active
                          ? "active"
                          : "deactivated";
                      return (
                        <span
                          className={`status-chip ${
                            state === "active"
                              ? "status-completed"
                              : state === "pending_reset"
                                ? "status-proposal"
                                : "status-rejected"
                          }`}
                        >
                          {state === "active"
                            ? "Active"
                            : state === "pending_reset"
                              ? "Pending reset"
                              : "Deactivated"}
                        </span>
                      );
                    })()}
                    <span
                      className={`status-chip ${
                        (detailCompleteness?.score || 0) >= 4
                          ? "status-completed"
                          : (detailCompleteness?.score || 0) >= 2
                            ? "status-proposal"
                            : "status-rejected"
                      }`}
                    >
                      Profile {detailCompleteness?.score || 0}/4
                    </span>
                    {detailCompleteness?.checks.contact ? (
                      <span className="status-chip status-ongoing">
                        Contact
                      </span>
                    ) : null}
                    {detailCompleteness?.checks.role ? (
                      <span className="status-chip status-ongoing">Role</span>
                    ) : null}
                    {detailCompleteness?.checks.department ? (
                      <span className="status-chip status-ongoing">
                        Department
                      </span>
                    ) : null}
                    {detailUser?.ckan_org_id ? (
                      <span className="status-chip status-ongoing">
                        Center:{" "}
                        {centerNameById[detailUser.ckan_org_id] || "Set"}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="app-card app-card-compact">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Submissions
                    </p>
                    <p className="mt-1 text-xl font-bold">
                      {detailData.submissionsCount}
                    </p>
                  </div>
                  <div className="app-card app-card-compact">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Current Projects
                    </p>
                    <p className="mt-1 text-xl font-bold">
                      {detailData.currentProjectsCount}
                    </p>
                  </div>
                </div>

                <div className="app-card app-card-compact">
                  <p className="mb-2 text-sm font-semibold">
                    Project Status Breakdown
                  </p>
                  <div className="grid gap-2 md:grid-cols-4 text-sm">
                    {Object.entries(detailData.statusCounts).map(
                      ([status, count]) => (
                        <div key={status} className="app-card app-card-micro">
                          <p className="capitalize text-slate-600">{status}</p>
                          <p className="font-bold">{count}</p>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="app-card app-card-compact">
                  <p className="mb-2 text-sm font-semibold">Recent Projects</p>
                  {detailData.projects.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      No submissions yet.
                    </p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {detailData.projects.map((project) => (
                        <li
                          key={project.id}
                          className="app-card app-card-micro"
                        >
                          <p className="font-semibold">{project.title}</p>
                          <p className="capitalize text-slate-600">
                            {project.status}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="app-card app-card-compact">
                  <p className="mb-2 text-sm font-semibold">
                    Status History (Projects)
                  </p>
                  {detailData.statusHistory.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      No status history records.
                    </p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {detailData.statusHistory.map((entry) => (
                        <li key={entry.id} className="app-card app-card-micro">
                          <p className="font-semibold">
                            {entry.old_status || "none"} {"->"}{" "}
                            {entry.new_status}
                          </p>
                          <p className="text-slate-600">
                            {new Date(entry.changed_at).toLocaleString()}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="app-card app-card-compact">
                  <p className="mb-2 text-sm font-semibold">
                    Role Change Audit
                  </p>
                  {detailData.roleAudit.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      No role change records found.
                    </p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {detailData.roleAudit.map((entry) => (
                        <li
                          key={entry.id}
                          className="app-card-muted app-card-micro"
                        >
                          <p className="font-semibold">
                            {entry.old_role || "none"} {"->"} {entry.new_role}
                          </p>
                          <p className="text-slate-600">
                            {new Date(entry.changed_at).toLocaleString()}
                          </p>
                          <p className="text-xs text-slate-500">
                            Changed by:{" "}
                            {entry.changed_by
                              ? detailData.roleAuditActorMap[
                                  entry.changed_by
                                ] || entry.changed_by
                              : "System"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : null}

      <ConfirmActionModal
        open={Boolean(confirmAction)}
        title={confirmAction?.title || "Confirm Action"}
        message={confirmAction?.message || ""}
        confirmLabel={confirmAction?.confirmLabel || "Confirm"}
        loading={confirmLoading}
        onCancel={() => setConfirmAction(null)}
        onConfirm={executeConfirmedAction}
      />
    </section>
  );
}

