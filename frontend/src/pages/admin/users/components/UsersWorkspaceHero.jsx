import { BadgeCheck, Briefcase, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UsersWorkspaceHero({ metrics, onCreateUser }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
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
