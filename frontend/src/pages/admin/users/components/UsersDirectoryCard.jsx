import { Eye, Loader2, Mail, UserCheck, UserX } from "lucide-react";
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

export default function UsersDirectoryCard({
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
    <Card className="overflow-hidden border border-blue-200/80 bg-white shadow-sm">
      <CardHeader className="border-b border-blue-200/70 px-6 py-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold text-[#1E3A8A]">Accounts Directory</CardTitle>
            <CardDescription className="text-slate-600">
              Showing {filteredUsers.length} account(s).
            </CardDescription>
          </div>
          <p className="text-sm text-slate-600">{filteredUsers.length} row(s).</p>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="rounded-2xl border border-blue-200/80 bg-white/95 p-4 shadow-sm backdrop-blur">
          <label className="relative block w-full md:max-w-xl">
            <span className="sr-only">Search users</span>
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
              className="rounded-full text-xs text-[#1E3A8A] hover:text-[#1E3A8A]"
              onClick={() => setUserSearch("")}
              disabled={!hasActiveDirectoryFilters}
            >
              Reset all
            </Button>
          </div>

          {hasActiveDirectoryFilters ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#1E3A8A]">
                Active Filters
              </span>
              <button
                type="button"
                className="rounded-full border border-blue-200/80 bg-blue-50 px-3 py-1 text-xs font-semibold text-[#1E3A8A]"
                onClick={() => setUserSearch("")}
              >
                Search: "{String(userSearch || "").trim()}" x
              </button>
            </div>
          ) : null}
        </div>
      </CardContent>

      <CardContent className="p-4 pt-0">
        <div className="overflow-x-auto rounded-2xl border border-blue-200/70 bg-white shadow-sm">
          <Table className="min-w-[980px]">
            <TableHeader className="bg-blue-50/80 text-slate-600">
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
                          className="h-8 w-8 text-slate-700 hover:bg-blue-50/60"
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
