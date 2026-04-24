import { Search } from "lucide-react";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PaginationControls from "@/components/navigation/PaginationControls";
import { MEMBER_PAGE_SIZE } from "../constants";

export default function MembersPanel({
  center,
  filters,
  onFiltersChange,
  departmentOptions,
  filteredRows,
  paginatedRows,
  loading,
  error,
  page,
  totalPages,
  onPageChange,
}) {
  return (
    <Card className="overflow-hidden border-blue-200/80 shadow-sm">
      <CardHeader className="space-y-4 border-b border-blue-100 bg-blue-50/35 px-6 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-[#1E3A8A]">
              Research Center Members
            </CardTitle>
            <CardDescription>
              {filteredRows.length} member(s) matched for {center.name}.
            </CardDescription>
          </div>
          <label className="relative w-full lg:max-w-md">
            <span className="sr-only">Search members</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1E3A8A]" />
            <Input
              className="border-blue-200 bg-white pl-8"
              placeholder="Search name or email"
              value={filters.search}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  search: event.target.value,
                })
              }
            />
          </label>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[10rem_minmax(0,14rem)_10rem]">
          <Select
            value={filters.role}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                role: value,
              })
            }
          >
            <SelectTrigger className="border-blue-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="faculty">Faculty</SelectItem>
              <SelectItem value="student">Student</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.department}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                department: value,
              })
            }
          >
            <SelectTrigger className="border-blue-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departmentOptions.map((department) => (
                <SelectItem key={department} value={department}>
                  {department}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.status}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                status: value,
              })
            }
          >
            <SelectTrigger className="border-blue-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-40 rounded-full bg-blue-100/80" />
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`member-skeleton-${index}`}
                    className="h-10 w-full rounded-lg bg-blue-100/70"
                  />
                ))}
              </div>
            </div>
          ) : error ? (
            <p className="p-4 text-sm text-[#1E3A8A]">{error}</p>
          ) : filteredRows.length === 0 ? (
            <p className="p-4 text-sm text-[#1E3A8A]">
              No members matched the current filters.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>User ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map((member, index) => (
                  <TableRow key={member.id || `${member.email}-${index}`}>
                    <TableCell>
                      {(page - 1) * MEMBER_PAGE_SIZE + index + 1}
                    </TableCell>
                    <TableCell>{member.full_name || "Unnamed user"}</TableCell>
                    <TableCell>{member.email || "-"}</TableCell>
                    <TableCell className="capitalize">
                      {member.role || "-"}
                    </TableCell>
                    <TableCell>{member.department || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          member.is_active !== false
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {member.is_active !== false ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code>{member.id || "-"}</code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
      <PaginationControls
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        className="rounded-none border-0 border-t border-[var(--border)]"
      />
    </Card>
  );
}
