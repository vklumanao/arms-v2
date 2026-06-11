import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useReferenceData } from "@/hooks/useReferenceData";
import { isValidEmail } from "@/utils/validation";
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";
import PaginationControls from "@/components/navigation/PaginationControls";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/providers/ToastProvider";
import {
  createAdminUser,
  fetchAdminUserRoleOptions,
  fetchAdminUsers,
  resendAdminUserInvite,
  sendAdminPasswordReset,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "@/services/admin";
import { paginateItemsWithMeta } from "@/utils/admin";
import {
  BadgeCheck,
  Briefcase,
  Eye,
  Loader2,
  Mail,
  Search,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import {
  UsersWorkspaceHero,
  UsersDirectoryCard,
} from "./users/components/UsersPanels";

export default function AdminUsersPage() {
  const PAGE_SIZE = 10;
  const navigate = useNavigate();
  const { centers, departments } = useReferenceData();
  const EMPTY_CREATE_FORM = {
    first_name: "",
    middle_initial: "",
    last_name: "",
    email: "",
    role: "faculty",
    ckan_org_id: "",
    ckan_group_id: "",
  };
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [savingUserById, setSavingUserById] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [pendingResetByUserId, setPendingResetByUserId] = useState({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createSaving, setCreateSaving] = useState(false);
  const [createResult, setCreateResult] = useState(null);
  const [roleOptions, setRoleOptions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const toast = useToast();
  const hasActiveDirectoryFilters = useMemo(
    () => String(userSearch || "").trim().length > 0,
    [userSearch],
  );

  useEffect(() => {
    if (error) toast.error("User action failed", error);
  }, [error, toast]);

  useEffect(() => {
    if (message) toast.success("User action completed", message);
  }, [message, toast]);

  const loadUsers = async () => {
    setError("");
    setMessage("");
    try {
      const [usersData, roleData] = await Promise.all([
        fetchAdminUsers(),
        fetchAdminUserRoleOptions(),
      ]);
      setUsers(usersData || []);
      setRoleOptions(roleData || []);
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
  const pagination = useMemo(
    () => paginateItemsWithMeta(filteredUsers, currentPage, PAGE_SIZE),
    [filteredUsers, currentPage],
  );

  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.is_active).length;
    const inactive = total - active;
    const faculty = users.filter((u) => u.role === "faculty").length;
    const students = users.filter((u) => u.role === "student").length;
    return { total, active, inactive, faculty, students };
  }, [users]);

  const selectableRoles = useMemo(() => {
    if (Array.isArray(roleOptions) && roleOptions.length > 0)
      return roleOptions;
    return [
      { id: "fallback-student", key: "student", name: "Student" },
      { id: "fallback-faculty", key: "faculty", name: "Faculty" },
      { id: "fallback-admin", key: "admin", name: "Admin" },
    ];
  }, [roleOptions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [userSearch]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, pagination.totalPages));
  }, [pagination.totalPages]);

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
        user.id === userId
          ? {
              ...user,
              role: updated.role,
              roles: Array.isArray(updated.roles) ? updated.roles : user.roles,
            }
          : user,
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

  const resendInvite = async (user) => {
    const userId = String(user?.id || "").trim();
    if (!userId) {
      setError("Selected user is invalid.");
      return;
    }
    if (user?.is_active === false) {
      setError("Cannot send invite to a deactivated account.");
      return;
    }

    setError("");
    setMessage("");
    try {
      await resendAdminUserInvite(userId);
      setMessage(`Setup invite sent to ${user?.email || "user email"}.`);
    } catch (inviteError) {
      setError(inviteError.message || "Failed to resend setup invite.");
    }
  };

  const getAssignedRoleKey = (user) => {
    const assigned = Array.isArray(user?.roles) ? user.roles : [];
    const firstKey = String(assigned?.[0]?.key || "")
      .trim()
      .toLowerCase();
    if (firstKey) return firstKey;
    return String(user?.role || "student")
      .trim()
      .toLowerCase();
  };

  const openRoleConfirm = (user, nextRole) => {
    if (!user?.id || !nextRole || nextRole === getAssignedRoleKey(user)) return;
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

  const openInviteConfirm = (user) => {
    if (!user?.id || !user?.email) {
      setError("Selected user has no email.");
      return;
    }
    setConfirmAction({
      type: "invite",
      user,
      userLabel: user.full_name || user.email || "this user",
      title: "Confirm Invite Resend",
      message: `Resend account setup invite to ${user.email}?`,
      confirmLabel: "Resend Invite",
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
    } else if (confirmAction.type === "invite") {
      await resendInvite(confirmAction.user);
    }

    setConfirmLoading(false);
    setConfirmAction(null);
  };

  const openUserDetail = async (user) => {
    const id = String(user?.id || "").trim();
    if (!id) return;
    navigate(`/admin/affiliates/${encodeURIComponent(id)}`);
  };

  const openCreateModal = () => {
    setError("");
    setMessage("");
    setCreateResult(null);
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (createSaving) return;
    setCreateModalOpen(false);
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateResult(null);
  };

  const submitCreateUser = async () => {
    const first_name = String(createForm.first_name || "").trim();
    const middle_initial = String(createForm.middle_initial || "").trim();
    const last_name = String(createForm.last_name || "").trim();
    const email = String(createForm.email || "")
      .trim()
      .toLowerCase();

    setError("");
    setMessage("");

    if (!first_name) {
      setError("First name is required.");
      return;
    }
    if (!last_name) {
      setError("Last name is required.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("A valid email is required.");
      return;
    }

    const selectedRoleKey = String(createForm.role || "faculty")
      .trim()
      .toLowerCase();
    const createRole =
      selectedRoleKey === "student" || selectedRoleKey === "faculty"
        ? selectedRoleKey
        : "faculty";

    setCreateSaving(true);
    try {
      const created = await createAdminUser({
        first_name,
        middle_initial: middle_initial || null,
        last_name,
        email,
        role: createRole,
        ckan_org_id: createForm.ckan_org_id || null,
        ckan_group_id: createForm.ckan_group_id || null,
        department:
          departments.find((row) => row.id === createForm.ckan_group_id)
            ?.name || null,
      });
      let nextUser = created || null;
      let assignmentWarning = "";

      if (created?.id && selectedRoleKey !== createRole) {
        try {
          const assigned = await updateAdminUserRole(
            created.id,
            selectedRoleKey,
          );
          nextUser = {
            ...(created || {}),
            role: assigned?.role || created?.role || "student",
            roles: Array.isArray(assigned?.roles) ? assigned.roles : [],
          };
        } catch (assignError) {
          assignmentWarning = String(
            assignError?.message ||
              "User created, but selected role assignment failed.",
          );
        }
      }

      setUsers((prev) => [nextUser, ...prev]);
      setCreateResult(nextUser || null);
      if (assignmentWarning) {
        setError(assignmentWarning);
        setMessage(
          "User account created and setup invite sent. Role assignment needs review.",
        );
      } else {
        setMessage("User account created and setup invite sent.");
      }
    } catch (createError) {
      setError(createError.message || "Failed to create user account.");
    } finally {
      setCreateSaving(false);
    }
  };

  return (
    <section className="page-stack-lg">
      <UsersWorkspaceHero metrics={metrics} onCreateUser={openCreateModal} />

      <UsersDirectoryCard
        filteredUsers={filteredUsers}
        userSearch={userSearch}
        setUserSearch={setUserSearch}
        hasActiveDirectoryFilters={hasActiveDirectoryFilters}
        pagination={pagination}
        setCurrentPage={setCurrentPage}
        getAssignedRoleKey={getAssignedRoleKey}
        savingUserById={savingUserById}
        openRoleConfirm={openRoleConfirm}
        selectableRoles={selectableRoles}
        pendingResetByUserId={pendingResetByUserId}
        openStatusConfirm={openStatusConfirm}
        openInviteConfirm={openInviteConfirm}
        openResetConfirm={openResetConfirm}
        openUserDetail={openUserDetail}
      />
      {createModalOpen ? (
        <Dialog
          open={createModalOpen}
          onOpenChange={(open) => !open && closeCreateModal()}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create User Account</DialogTitle>
              <DialogDescription>
                Add a faculty or student account with optional center and
                department assignment.
              </DialogDescription>
              <p className="text-xs text-slate-500 mb-3">
                Fields marked with <span className="text-slate-500">*</span> are
                required.
              </p>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-3 sm:grid-cols-3 md:col-span-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">
                      First Name <span className="text-slate-500">*</span>
                    </span>
                    <Input
                      value={createForm.first_name}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          first_name: e.target.value,
                        }))
                      }
                      placeholder="Juan"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">
                      Middle Initial <span className="text-slate-500">*</span>
                    </span>
                    <Input
                      value={createForm.middle_initial}
                      maxLength={2}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          middle_initial: e.target.value,
                        }))
                      }
                      placeholder="M"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">
                      Last Name <span className="text-slate-500">*</span>
                    </span>
                    <Input
                      value={createForm.last_name}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          last_name: e.target.value,
                        }))
                      }
                      placeholder="Dela Cruz"
                    />
                  </label>
                </div>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Email <span className="text-slate-500">*</span>
                  </span>
                  <Input
                    type="email"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="juan.delacruz@carsu.edu.ph"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Role <span className="text-slate-500">*</span>
                  </span>
                  <Select
                    value={createForm.role}
                    onValueChange={(value) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        role: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableRoles.map((role) => (
                        <SelectItem
                          key={role.id || role.key}
                          value={String(role.key || "").toLowerCase()}
                        >
                          {role.name || role.key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Research Center
                  </span>
                  <Select
                    value={createForm.ckan_org_id}
                    onValueChange={(value) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        ckan_org_id: value === "__none__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {(centers || []).map((center) => (
                        <SelectItem key={center.id} value={center.id}>
                          {center.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-medium text-slate-700">Department</span>
                  <Select
                    value={createForm.ckan_group_id}
                    onValueChange={(value) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        ckan_group_id: value === "__none__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {(departments || []).map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>

              {createResult ? (
                <Card className="bg-muted/40">
                  <CardContent className="space-y-1 p-4 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">
                      Account created
                    </p>
                    <p className="mt-1">
                      A setup invite was sent to{" "}
                      <span className="font-semibold">
                        {createResult.email || "the user's email"}
                      </span>
                      .
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      The user must set a password from the email link to verify
                      and activate account access.
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={closeCreateModal}
                  disabled={createSaving}
                >
                  Close
                </Button>
                <Button onClick={submitCreateUser} disabled={createSaving}>
                  {createSaving ? "Creating..." : "Create User"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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

