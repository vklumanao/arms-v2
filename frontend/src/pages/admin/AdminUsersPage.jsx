import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useReferenceData } from "@/hooks/useReferenceData";
import { isValidEmail } from "@/utils/validation";
import PageHeader from "@/components/layout/PageHeader";
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
  fetchAdminUsers,
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
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";

const ROLE_OPTIONS = ["student", "faculty", "admin"];

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
  const [currentPage, setCurrentPage] = useState(1);
  const toast = useToast();

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
  const pagination = useMemo(
    () => paginateItemsWithMeta(filteredUsers, currentPage, PAGE_SIZE),
    [filteredUsers, currentPage],
  );

  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.is_active).length;
    const inactive = total - active;
    const admins = users.filter((u) => u.role === "admin").length;
    const faculty = users.filter((u) => u.role === "faculty").length;
    const students = users.filter((u) => u.role === "student").length;
    return { total, active, inactive, admins, faculty, students };
  }, [users]);

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

    setCreateSaving(true);
    try {
      const created = await createAdminUser({
        first_name,
        middle_initial: middle_initial || null,
        last_name,
        email,
        role: createForm.role,
        ckan_org_id: createForm.ckan_org_id || null,
        ckan_group_id: createForm.ckan_group_id || null,
        department:
          departments.find((row) => row.id === createForm.ckan_group_id)
            ?.name || null,
      });
      setUsers((prev) => [created, ...prev]);
      setCreateResult(created || null);
      setMessage("User account created.");
    } catch (createError) {
      setError(createError.message || "Failed to create user account.");
    } finally {
      setCreateSaving(false);
    }
  };

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="User Management"
        description="Manage account access, role assignment, password reset, and account-level activity."
      />
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <Card className="flex min-h-28 flex-col justify-between">
          <CardContent className="flex min-h-28 flex-col justify-between p-5">
            <p className="kpi-label flex items-center gap-1">
              <Users size={14} /> Total Users
            </p>
            <p className="kpi-value">{metrics.total}</p>
          </CardContent>
        </Card>
        <Card className="flex min-h-28 flex-col justify-between">
          <CardContent className="flex min-h-28 flex-col justify-between p-5">
            <p className="kpi-label flex items-center gap-1">
              <UserCheck size={14} /> Active
            </p>
            <p className="kpi-value">{metrics.active}</p>
          </CardContent>
        </Card>
        <Card className="flex min-h-28 flex-col justify-between">
          <CardContent className="flex min-h-28 flex-col justify-between p-5">
            <p className="kpi-label flex items-center gap-1">
              <BadgeCheck size={14} /> Inactive
            </p>
            <p className="kpi-value">{metrics.inactive}</p>
          </CardContent>
        </Card>
        <Card className="flex min-h-28 flex-col justify-between">
          <CardContent className="flex min-h-28 flex-col justify-between p-5">
            <p className="kpi-label flex items-center gap-1">
              <ShieldCheck size={14} /> Admins
            </p>
            <p className="kpi-value">{metrics.admins}</p>
          </CardContent>
        </Card>
        <Card className="flex min-h-28 flex-col justify-between">
          <CardContent className="flex min-h-28 flex-col justify-between p-5">
            <p className="kpi-label flex items-center gap-1">
              <Briefcase size={14} /> Faculty
            </p>
            <p className="kpi-value">{metrics.faculty}</p>
          </CardContent>
        </Card>
        <Card className="flex min-h-28 flex-col justify-between">
          <CardContent className="flex min-h-28 flex-col justify-between p-5">
            <p className="kpi-label flex items-center gap-1">
              <Users size={14} /> Student
            </p>
            <p className="kpi-value">{metrics.students}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] px-4 py-3 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <CardTitle className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
                Accounts Directory ({filteredUsers.length})
              </CardTitle>
              <label className="relative min-w-[16rem] flex-1 md:max-w-[24rem]">
                <Input
                  className="pl-8"
                  placeholder="Search user by name, email, or role"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={openCreateModal}>Create User</Button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              Showing{" "}
              <span className="font-semibold">{filteredUsers.length}</span>{" "}
              account(s).
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Sign-in</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>No users found.</TableCell>
                  </TableRow>
                ) : (
                  pagination.items.map((user, index) => (
                    <TableRow key={user.id}>
                      <TableCell>{pagination.start + index + 1}</TableCell>
                      <TableCell>{user.full_name || "-"}</TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell>
                        <Select
                          value={user.role || "student"}
                          disabled={Boolean(savingUserById[user.id])}
                          onValueChange={(value) =>
                            openRoleConfirm(user, value)
                          }
                        >
                          <SelectTrigger className="min-w-32 capitalize">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((role) => (
                              <SelectItem
                                key={role}
                                value={role}
                                className="capitalize"
                              >
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const state = pendingResetByUserId[user.id]
                            ? "pending_reset"
                            : user.is_active
                              ? "active"
                              : "deactivated";
                          return (
                            <Badge
                              variant={
                                state === "active"
                                  ? "secondary"
                                  : state === "pending_reset"
                                    ? "outline"
                                    : "destructive"
                              }
                            >
                              {state === "active"
                                ? "Active"
                                : state === "pending_reset"
                                  ? "Pending reset"
                                  : "Deactivated"}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {user.last_sign_in_at
                          ? new Date(user.last_sign_in_at).toLocaleString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={
                              user.is_active
                                ? "h-8 w-8 text-[var(--danger)] hover:bg-red-50"
                                : "h-8 w-8 text-emerald-700 hover:bg-emerald-50"
                            }
                            disabled={Boolean(savingUserById[user.id])}
                            onClick={() => openStatusConfirm(user)}
                            aria-label={
                              savingUserById[user.id]
                                ? "Saving status..."
                                : user.is_active
                                  ? `Deactivate ${user?.full_name || user?.email || "user"}`
                                  : `Activate ${user?.full_name || user?.email || "user"}`
                            }
                            title={
                              savingUserById[user.id]
                                ? "Saving..."
                                : user.is_active
                                  ? "Deactivate"
                                  : "Activate"
                            }
                          >
                            {savingUserById[user.id] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : user.is_active ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openResetConfirm(user)}
                            aria-label={`Send password reset to ${user?.full_name || user?.email || "user"}`}
                            title="Send reset"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openUserDetail(user)}
                            aria-label={`View ${user?.full_name || user?.email || "user"}`}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {pagination.totalPages > 1 ? (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={8} className="px-3 py-3">
                      <PaginationControls
                        page={pagination.page}
                        totalPages={pagination.totalPages}
                        onPageChange={setCurrentPage}
                        className="border-0 rounded-none shadow-none bg-transparent"
                      />
                    </TableCell>
                  </TableRow>
                </TableFooter>
              ) : null}
            </Table>
          </div>
        </CardContent>
      </Card>

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
                Fields marked with <span className="text-red-500">*</span> are
                required.
              </p>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-3 sm:grid-cols-3 md:col-span-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">
                      First Name <span className="text-red-500">*</span>
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
                      Middle Initial <span className="text-red-500">*</span>
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
                      Last Name <span className="text-red-500">*</span>
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
                    Email <span className="text-red-500">*</span>
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
                    Role <span className="text-red-500">*</span>
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
                      <SelectItem value="faculty">Faculty</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
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

              {createResult?.temporary_password ? (
                <Card className="bg-muted/40">
                  <CardContent className="space-y-1 p-4 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">
                      Account created
                    </p>
                    <p className="mt-1">
                      Temporary password:{" "}
                      <span className="font-mono font-semibold">
                        {createResult.temporary_password}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Share this once, then require the user to change it after
                      first login.
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
