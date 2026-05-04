import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Compass, ArrowLeft, Home } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { getRoleAwareRecoveryTarget } from "@/pages/core/recoveryTargets";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const recoveryTarget = useMemo(
    () => getRoleAwareRecoveryTarget(user, profile),
    [profile, user],
  );

  return (
    <section className="mx-auto flex min-h-[calc(100vh-14rem)] w-full max-w-4xl items-center justify-center px-4 py-10 sm:px-6">
      <Card className="w-full border-slate-200 bg-white shadow-sm">
        <CardContent className="p-8 sm:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#DBEAFE] text-slate-700">
              <Compass className="h-8 w-8" />
            </div>

            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#3B82F6]">
              Error 404
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#111827] sm:text-4xl">
              Page Not Found
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              The page you are trying to access does not exist or may have been
              moved. Please use one of the options below to continue.
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
                variant="outline"
                className="w-full border-[#BFDBFE] text-slate-700 hover:bg-[#EFF6FF] sm:w-auto"
              >
                <Link to="/home">
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Link>
              </Button>

              <Button
                asChild
                className="w-full bg-[#1E3A8A] text-white hover:bg-[#1E40AF] sm:w-auto"
              >
                <Link to={recoveryTarget.to}>
                  <Compass className="mr-2 h-4 w-4" />
                  {recoveryTarget.label}
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

