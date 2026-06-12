import { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft, Compass, Mail } from "lucide-react";
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

function isAdminLikeProfile(profile) {
  if (!profile) return false;
  return (
    canAccessRoutePermission(profile, PERMISSIONS.ADMIN_CONTROLS_MANAGE) ||
    canAccessRoutePermission(profile, PERMISSIONS.ADMIN_RBAC_MANAGE)
  );
}

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();

  const fallbackTarget = useMemo(
    () => getRoleAwareRecoveryTarget(user, profile),
    [profile, user],
  );
  const requestedPath = `${location.pathname}${location.search || ""}${
    location.hash || ""
  }`;
  const showRequestAccess = Boolean(
    user && profile && !isAdminLikeProfile(profile),
  );
  const requestAccessHref = `mailto:?subject=${encodeURIComponent(
    "ARMS Access Request",
  )}&body=${encodeURIComponent(
    `Hello Admin,\n\nI need access to this ARMS page:\n${requestedPath}\n\nAccount name: ${
      profile?.full_name || "N/A"
    }\nEmail: ${profile?.email || user?.email || "N/A"}\n\nThank you.`,
  )}`;

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
                  <ShieldAlert className="mr-2 h-3.5 w-3.5" />
                  Access Restricted
                </div>

                <div className="space-y-4">
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.5rem]">
                    You do not have access to this page
                  </h1>
                  <p className="mx-auto max-w-xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                    This route requires permissions that are not available to
                    your current account. Return to an accessible page or
                    contact an administrator if you believe this is incorrect.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5 text-left shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)]">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-700">
                    <Compass className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    Safe Recovery
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Go back or return to the most relevant page based on your
                    current access level.
                  </p>
                </div>

                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5 text-left shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)]">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-700">
                    <Mail className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    Access Request
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    If this page should be part of your work, you can request
                    permission from the platform administrator.
                  </p>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-white/95 p-5 shadow-[0_22px_50px_-38px_rgba(15,23,42,0.4)] sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Requested Page
                </p>
                <p className="mt-2 break-all rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-700">
                  <span className="font-semibold">{requestedPath}</span>
                </p>

                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Quick Actions
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
                    className="border border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                  >
                    <Link to={fallbackTarget.to}>
                      <Compass className="h-4 w-4" />
                      {fallbackTarget.label}
                    </Link>
                  </Button>

                  {showRequestAccess ? (
                    <Button
                      asChild
                      variant="outline"
                      className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    >
                      <a href={requestAccessHref}>
                        <Mail className="h-4 w-4" />
                        Request Access
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
