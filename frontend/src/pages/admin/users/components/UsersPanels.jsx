import { Eye, Loader2, Mail, UserCheck, UserX, BadgeCheck, Briefcase, Users, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import PaginationControls from "@/components/navigation/PaginationControls";

export function UsersWorkspaceHero({ metrics, onCreateUser }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Admin Workspace
            </p>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
              User Management
            </h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Manage account access, role assignment, password reset, and
              account-level activity.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="mono" onClick={onCreateUser}>
              Create User
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9">
          {[
            { label: "Total Users", value: metrics.total, icon: Users },
            { label: "Active", value: metrics.active, icon: UserCheck },
            { label: "Inactive", value: metrics.inactive, icon: BadgeCheck },
            { label: "Faculty", value: metrics.faculty, icon: Briefcase },
            { label: "Students", value: metrics.students, icon: Users },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {label}
                </p>
                <Icon className="h-4 w-4 text-slate-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function UsersDirectoryCard({
  filteredUsers,
  userSearch,
  setUserSearch,
  hasActiveDirectoryFilters,
  pagination,
  setCurrentPage,
  getAssignedRoleKey,
  savingUserById,
  openRoleConfirm,
  selectableRoles,
  pendingResetByUserId,
  openStatusConfirm,
  openInviteConfirm,
  openResetConfirm,
  openUserDetail,
}) {
  return (
    <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold text-slate-900">
              Accounts Directory
            </CardTitle>
            <CardDescription className="text-slate-600">
              Showing {filteredUsers.length} account(s).
            </CardDescription>
          </div>
          <p className="text-sm text-slate-600">{filteredUsers.length} row(s).</p>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <label className="relative block w-full md:max-w-xl">
            <span className="sr-only">Search users</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
            <Input
              className="pl-9"
              placeholder="Search user by name, email, or role"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-full text-xs text-slate-700 hover:text-slate-900"
              onClick={() => setUserSearch("")}
              disabled={!hasActiveDirectoryFilters}
            >
              Reset all
            </Button>
          </div>

          {hasActiveDirectoryFilters ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                Active Filters
              </span>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                onClick={() => setUserSearch("")}
              >
                Search: "{String(userSearch || "").trim()}" x
              </button>
            </div>
          ) : null}
        </div>
      </CardContent>

      <CardContent className="p-4 pt-0">
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white shadow-sm">
          <Table className="min-w-[980px]">
            <TableHeader className="bg-slate-50 text-slate-600">
              <TableRow>
                <TableHead>No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-600">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                pagination.items.map((user, index) => (
                  <TableRow key={user.id}>
                    <TableCell>{pagination.start + index + 1}</TableCell>
                    <TableCell>{user.full_name || "-"}</TableCell>
                    <TableCell>{user.email || "-"}</TableCell>
                    <TableCell>
                      <Select
                        value={getAssignedRoleKey(user)}
                        disabled={Boolean(savingUserById[user.id])}
                        onValueChange={(value) => openRoleConfirm(user, value)}
                      >
                        <SelectTrigger className="min-w-32 capitalize">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {selectableRoles.map((role) => (
                            <SelectItem
                              key={role.id || role.key}
                              value={String(role.key || "").toLowerCase()}
                              className="capitalize"
                            >
                              {role.name || role.key}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const state = !user.is_active
                          ? "deactivated"
                          : user.email_verified !== true
                            ? "pending_verification"
                            : pendingResetByUserId[user.id]
                              ? "pending_reset"
                              : "active";
                        return (
                          <Badge
                            variant={
                              state === "active"
                                ? "secondary"
                                : state === "pending_reset" || state === "pending_verification"
                                  ? "outline"
                                  : "destructive"
                            }
                          >
                            {state === "active"
                              ? "Active"
                              : state === "pending_verification"
                                ? "Pending verification"
                                : state === "pending_reset"
                                  ? "Pending reset"
                                  : "Deactivated"}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-700 hover:bg-slate-100"
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
                          onClick={() =>
                            user.email_verified !== true
                              ? openInviteConfirm(user)
                              : openResetConfirm(user)
                          }
                          aria-label={
                            user.email_verified !== true
                              ? `Resend setup invite to ${user?.full_name || user?.email || "user"}`
                              : `Send password reset to ${user?.full_name || user?.email || "user"}`
                          }
                          title={user.email_verified !== true ? "Resend invite" : "Send reset"}
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
  );
}
