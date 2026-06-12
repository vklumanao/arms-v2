import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { toDisplayFirstName } from "@/utils/auth";
import { isValidEmail } from "@/utils/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
    <section className="items-center justify-center">
      <div className="flex h-full items-center justify-center px-4 py-4 sm:px-6 lg:px-8">
        <Card>
          <div className="grid lg:grid-cols-[1.12fr_minmax(0,0.88fr)] lg:gap-x-2">
            <aside className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(145deg,#0f172a_0%,#134e4a_48%,#ecfdf5_160%)] px-6 py-6 text-white sm:px-8 sm:py-7 lg:border-b-0 lg:border-r lg:border-white/10 lg:px-10 lg:py-8 rounded-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_20%_80%,rgba(52,211,153,0.22),transparent_26%)]" />

              <div className="relative flex h-full flex-col items-start justify-center gap-1">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center bg-white/14">
                    <img
                      src="icon.svg"
                      alt="CenterPulse Logo"
                      className="h-24 w-24 object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-100/80">
                      Workspace
                    </p>
                    <p className="text-xl font-semibold tracking-[0.08em] text-white">
                      CenterPULSE: Platform for University Logging of Scholarly Engagements
                    </p>
                  </div>
                </div>

                <div className="mt-6 max-w-lg space-y-3 lg:mt-8">
                  <p className="text-sm font-medium uppercase tracking-[0.22em] text-emerald-100/80">
                    Research Management
                  </p>
                  <h1 className="text-3xl font-semibold leading-tight text-white sm:text-[2rem]">
                    Keep your research operations aligned in one secure
                    workspace.
                  </h1>
                  <p className="max-w-lg text-sm leading-6 text-slate-200 sm:text-[15px]">
                    Access project coordination, center records, and academic
                    administration tools from a single sign-in experience built
                    for CenterPULSE.
                  </p>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:mt-6">
                  <div className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 text-emerald-100">
                      <Mail size={18} />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      Institutional Access
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">
                      Sign in with the email address linked to your account.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 text-emerald-100">
                      <ShieldCheck size={18} />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      Protected Sign-In
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">
                      Login protection helps keep accounts and records secure.
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-1">
                  <div className="rounded-2xl border border-white/12 bg-black/10 p-4 backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/80">
                      Ready to continue
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-100">
                      Sign in to open your dashboard and resume your work across
                      research centers, projects, and affiliated records.
                    </p>
                  </div>
                </div>
              </div>
            </aside>

            <div className="flex items-center px-6 py-6 sm:px-8 sm:py-7 lg:px-10 lg:py-8">
              <div className="mx-auto w-full max-w-md">
                <CardHeader className="space-y-4 px-0 pb-5 pt-0">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                      Sign in
                    </h2>
                    <p className="text-sm leading-6 text-slate-600">
                      Enter your email and password to access your CenterPULSE
                      workspace.
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 px-0">
                  {error ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                      <p className="font-semibold text-rose-900">
                        Couldn&apos;t sign in
                      </p>
                      <p className="mt-1 leading-6">{error}</p>
                    </div>
                  ) : null}

                  {showVerifyHint ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <p className="font-semibold text-amber-950">
                        Email not verified
                      </p>
                      <p className="mt-1 leading-6">
                        Need a new link?{" "}
                        <Link
                          to="/verify-email"
                          className="font-semibold text-amber-900 underline underline-offset-2"
                        >
                          Verify email
                        </Link>
                      </p>
                    </div>
                  ) : null}

                  <form className="space-y-4" onSubmit={onSubmit}>
                    <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                      <div className="space-y-2">
                        <label
                          htmlFor="login-email"
                          className="text-sm font-medium text-slate-700"
                        >
                          Email
                        </label>
                        <Input
                          id="login-email"
                          type="email"
                          required
                          autoComplete="email"
                          autoCapitalize="none"
                          spellCheck={false}
                          value={form.email}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, email: e.target.value }))
                          }
                          className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                          placeholder="Email address"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <label
                            htmlFor="login-password"
                            className="text-sm font-medium text-slate-700"
                          >
                            Password
                          </label>
                          <Link
                            to="/forgot-password"
                            className="text-sm font-medium text-emerald-700 transition hover:text-emerald-800"
                          >
                            Forgot password?
                          </Link>
                        </div>

                        <div className="relative">
                          <Input
                            id="login-password"
                            type={showPassword ? "text" : "password"}
                            required
                            autoComplete="current-password"
                            value={form.password}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                password: e.target.value,
                              }))
                            }
                            className="h-12 rounded-xl border-slate-300 bg-white pr-12 text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                            placeholder="Password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                            onClick={() => setShowPassword((prev) => !prev)}
                          >
                            {showPassword ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white bg-white/80 px-4 py-3 text-sm text-slate-600">
                        Use the email address registered to your account.
                      </div>
                    </div>

                    <Button
                      disabled={loading || cooldownSeconds > 0}
                      className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-75"
                    >
                      {loading
                        ? "Signing in..."
                        : cooldownSeconds > 0
                          ? `Try again in ${cooldownSeconds}s`
                          : "Sign in"}
                      <ArrowRight size={16} />
                    </Button>
                  </form>
                </CardContent>

                <div className="mt-5 border-t border-slate-200 pt-5 text-center text-sm text-slate-600">
                  Need to register?{" "}
                  <Link
                    to="/register"
                    className="font-semibold text-emerald-700 transition hover:text-emerald-800"
                  >
                    Create account
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
