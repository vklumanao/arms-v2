import { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft, Compass, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  getRoleAwareRecoveryTarget,
  isAdminLikeProfile,
} from "@/pages/core/recoveryTargets";

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
    <section className="mx-auto flex min-h-[calc(100vh-14rem)] w-full max-w-4xl items-center justify-center px-4 py-10 sm:px-6">
      <Card className="w-full border-slate-200 bg-white shadow-sm">
        <CardContent className="p-8 sm:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#DBEAFE] text-slate-700">
              <ShieldAlert className="h-8 w-8" />
            </div>

            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#3B82F6]">
              Access Restricted
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#111827] sm:text-4xl">
              Unauthorized Access
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              You do not have the required permission for this page. If you
              believe this is incorrect, contact your administrator or return to
              a page you can access.
            </p>
            <p className="mx-auto mt-3 max-w-xl rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-xs text-slate-700 sm:text-sm">
              Requested page:{" "}
              <span className="font-semibold">{requestedPath}</span>
            </p>

            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="outline"
                className="w-full border-[#BFDBFE] text-slate-700 hover:bg-[#EFF6FF] sm:w-auto"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>

              <Button
                asChild
                className="w-full bg-[#1E3A8A] text-white hover:bg-[#1E40AF] sm:w-auto"
              >
                <Link to={fallbackTarget.to}>
                  <Compass className="mr-2 h-4 w-4" />
                  {fallbackTarget.label}
                </Link>
              </Button>

              {showRequestAccess ? (
                <Button
                  asChild
                  variant="outline"
                  className="w-full border-[#BFDBFE] text-slate-700 hover:bg-[#EFF6FF] sm:w-auto"
                >
                  <a href={requestAccessHref}>
                    <Mail className="mr-2 h-4 w-4" />
                    Request Access
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

