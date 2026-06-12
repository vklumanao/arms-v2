import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Compass,
  FileSearch,
  Home,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { canAccessRoutePermission, PERMISSIONS } from "@/services/permissions";

function getRoleAwareRecoveryTarget(user, profile) {
  if (!user) {
    return { to: "/login", label: "Go to Login" };
  }

  if (!profile) {
    return { to: "/home", label: "Go Home" };
  }

  const isCenterChief =
    profile?.is_center_chief === true && Boolean(profile?.managed_center_id);
  const managedCenterId = String(profile?.managed_center_id || "").trim();

  if (isCenterChief && managedCenterId) {
    return {
      to: `/admin/research-center/${encodeURIComponent(managedCenterId)}`,
      label: "Go to My Research Center",
    };
  }

  if (
    canAccessRoutePermission(profile, PERMISSIONS.ADMIN_CONTROLS_MANAGE) ||
    canAccessRoutePermission(profile, PERMISSIONS.ADMIN_RBAC_MANAGE)
  ) {
    return { to: "/admin/research-center", label: "Go to Admin Workspace" };
  }

  if (canAccessRoutePermission(profile, PERMISSIONS.PROJECTS_VIEW)) {
    return { to: "/projects", label: "Go to Research Projects" };
  }

  if (canAccessRoutePermission(profile, PERMISSIONS.AFFILIATE_PROFILE_VIEW)) {
    return { to: "/profile", label: "Go to My Profile" };
  }

  return { to: "/home", label: "Go Home" };
}

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const recoveryTarget = useMemo(
    () => getRoleAwareRecoveryTarget(user, profile),
    [profile, user],
  );
  const isAuthenticated = Boolean(user);

  return (
    <section className="flex min-h-[calc(100vh-14rem)] w-full items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-center">
        <Card className="relative w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_24%),linear-gradient(145deg,rgba(15,23,42,0.02)_0%,rgba(19,78,74,0.06)_48%,rgba(236,253,245,0.45)_100%)]" />
          <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),transparent_72%)]" />

          <CardContent className="relative p-8 sm:p-10 lg:p-12">
            <div className="mx-auto max-w-2xl space-y-10 text-center">
              <div className="space-y-6">
                <div className="mx-auto inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                  <Compass className="mr-2 h-3.5 w-3.5" />
                  Error 404
                </div>

                <div className="space-y-4">
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.5rem]">
                    This page could not be found
                  </h1>
                  <p className="mx-auto max-w-xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                    The page may have been moved, removed, or is not available
                    in the current CenterPULSE route structure. Use one of the
                    actions below to continue safely.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5 text-left shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)]">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-700">
                    <Compass className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    Route Guidance
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Return to a valid page using the recommended recovery
                    actions for your current session.
                  </p>
                </div>

                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5 text-left shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)]">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-700">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    Access Aware
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {isAuthenticated
                      ? "We can redirect you to the most relevant internal page based on your role."
                      : "You can return to public pages or sign in before accessing protected areas."}
                  </p>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-white/95 p-5 shadow-[0_22px_50px_-38px_rgba(15,23,42,0.4)] sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Quick Actions
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {isAuthenticated
                    ? "Return to your workspace or continue to the page that best matches your current permissions."
                    : "Head back to a public page or sign in to access protected areas of the platform."}
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    onClick={() => navigate(-1)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Go Back
                  </Button>

                  <Button
                    asChild
                    variant="outline"
                    className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  >
                    <Link to="/home">
                      <Home className="h-4 w-4" />
                      Go Home
                    </Link>
                  </Button>

                  <Button
                    asChild
                    className="border border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                  >
                    <Link to={recoveryTarget.to}>
                      <Compass className="h-4 w-4" />
                      {recoveryTarget.label}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
