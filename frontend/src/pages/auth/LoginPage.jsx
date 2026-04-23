import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { toDisplayFirstName } from "@/utils/auth";
import { isValidEmail } from "@/utils/validation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user, loading: authLoading, signIn } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showVerifyHint, setShowVerifyHint] = useState(false);

  const rawFrom = location.state?.from?.pathname;
  const from =
    rawFrom && rawFrom !== "/login" && rawFrom !== "/register"
      ? rawFrom
      : "/dashboard";

  useEffect(() => {
    if (!authLoading && user && !loading && !error) {
      navigate(from, { replace: true });
    }
  }, [authLoading, user, loading, error, from, navigate]);

  useEffect(() => {
    const inactiveNotice = sessionStorage.getItem("arms_deactivated_notice");
    if (inactiveNotice === "1") {
      sessionStorage.removeItem("arms_deactivated_notice");
      setError(
        "Your account is deactivated. Please contact the administrator for reactivation.",
      );
    }
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading || cooldownSeconds > 0) return;
    setLoading(true);
    setError("");
    setShowVerifyHint(false);

    const normalizedEmail = form.email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }
    if (!form.password) {
      setError("Password is required.");
      setLoading(false);
      return;
    }
    try {
      const payload = await signIn({
        email: normalizedEmail,
        password: form.password,
      });
      const firstName = toDisplayFirstName(payload?.profile, normalizedEmail);
      toast.success(
        `Welcome back, ${firstName}!`,
        "Login successful. You can continue your work now.",
      );

      navigate(from, { replace: true });
      window.setTimeout(() => {
        if (window.location.pathname === "/login") {
          window.location.assign(from);
        }
      }, 150);
    } catch (err) {
      const message = String(err?.message || "Unexpected login error.");
      if (message.toLowerCase().includes("too many")) {
        const retryAfterSeconds = 60;
        setCooldownSeconds(retryAfterSeconds);
        setError(
          `Too many login attempts. Please wait ${retryAfterSeconds} seconds before trying again.`,
        );
        return;
      }
      if (message.toLowerCase().includes("not verified")) {
        setShowVerifyHint(true);
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative min-h-[calc(100vh-5rem)] overflow-hidden px-4 py-8 sm:px-6 sm:py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1050px_480px_at_6%_0%,rgba(14,165,233,0.2),transparent_58%),radial-gradient(900px_440px_at_94%_16%,rgba(30,58,138,0.18),transparent_54%),radial-gradient(980px_500px_at_50%_100%,rgba(16,185,129,0.14),transparent_60%)]" />

      <div className="relative mx-auto w-full max-w-2xl">
        <Card className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/92 shadow-[0_22px_56px_rgba(15,23,42,0.18)] backdrop-blur">
          <CardHeader className="border-b border-slate-200/70 bg-gradient-to-r from-[#1E3A8A] via-[#0e7490] to-[#0f766e] px-6 pb-6 pt-7 text-white sm:px-8">
            <div className="flex items-center gap-3">
              <img
                src="icon.svg"
                alt="ARMS Logo"
                className="h-11 w-auto rounded-xl bg-white/90 p-1.5"
              />
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/95">
                Workspace Access
              </p>
            </div>
            <h1 className="mt-5 font-['Manrope'] text-2xl font-extrabold tracking-tight sm:text-[2rem]">
              Sign in to ARMS
            </h1>
            <p className="mt-2 max-w-lg text-sm text-cyan-100/95">
              Access your workspace and continue your research workflow.
            </p>
          </CardHeader>

          <CardContent className="space-y-5 px-6 py-6 sm:px-8 sm:py-7">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                Use your registered institutional email.
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                Too many attempts trigger a 60-second cooldown.
              </div>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                <div className="space-y-2">
                  <label
                    htmlFor="login-email"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Email
                  </label>
                  <Input
                    id="login-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, email: e.target.value }))
                    }
                    className="h-11 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#1E3A8A]/35"
                    placeholder="name@institution.edu"
                  />
                </div>

                <div className="mt-4 space-y-2">
                  <label
                    htmlFor="login-password"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={form.password}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, password: e.target.value }))
                      }
                      className="h-11 rounded-xl border-slate-300 bg-white pr-10 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#1E3A8A]/35"
                      placeholder="Enter password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                </div>
              </div>

              {error ? (
                <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {error}
                </div>
              ) : null}

              {showVerifyHint ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                  Need a new verification link?{" "}
                  <Link
                    to="/verify-email"
                    className="font-semibold underline hover:text-amber-900"
                  >
                    Verify email
                  </Link>
                </div>
              ) : null}

              <Button
                disabled={loading || cooldownSeconds > 0}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-[#1E3A8A] via-[#0e7490] to-[#0f766e] font-semibold text-white shadow-[0_14px_28px_rgba(14,116,144,0.24)] transition hover:from-[#1d4ed8] hover:via-[#0369a1] hover:to-[#0f766e] disabled:cursor-not-allowed disabled:opacity-75"
              >
                {loading
                  ? "Signing in..."
                  : cooldownSeconds > 0
                    ? `Retry in ${cooldownSeconds}s`
                    : "Sign in"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t border-slate-200/80 px-6 py-5 text-sm sm:px-8">
            <Link
              to="/register"
              className="font-semibold text-[#1E3A8A] hover:text-[#1d4ed8] hover:underline"
            >
              Create account
            </Link>
            <Link
              to="/forgot-password"
              className="font-semibold text-slate-600 hover:text-slate-900 hover:underline"
            >
              Forgot password
            </Link>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
