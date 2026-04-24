import { BadgeCheck, Briefcase, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UsersWorkspaceHero({ metrics, onCreateUser }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-50 via-white to-blue-50 p-6 shadow-sm">
      <div className="pointer-events-none absolute -right-20 -top-16 h-52 w-52 rounded-full bg-blue-200/45 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-blue-200/50 blur-3xl" />
      <div className="relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1E3A8A]">
              Admin Workspace
            </p>
            <h1 className="text-2xl font-bold text-[#1E3A8A] md:text-3xl">
              User Management
            </h1>
            <p className="max-w-2xl text-sm text-[#1E3A8A]">
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

        <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9">
          {[
            { label: "Total Users", value: metrics.total, icon: Users },
            { label: "Active", value: metrics.active, icon: UserCheck },
            { label: "Inactive", value: metrics.inactive, icon: BadgeCheck },
            { label: "Faculty", value: metrics.faculty, icon: Briefcase },
            { label: "Students", value: metrics.students, icon: Users },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl border border-blue-200/80 bg-white/90 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#1E3A8A]">
                  {label}
                </p>
                <Icon className="h-4 w-4 text-[#1E3A8A]" />
              </div>
              <p className="mt-2 text-2xl font-bold text-[#1E3A8A]">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
