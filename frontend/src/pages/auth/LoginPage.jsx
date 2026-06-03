import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Mail, ShieldCheck } from "lucide-react";
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
    <section>
      <div className="auth-shell-inner">
        <div className="auth-layout">
          <aside className="auth-spotlight auth-login-spotlight">
            <div className="auth-spotlight-inner auth-login-spotlight-inner">
              <div className="auth-spotlight-brand auth-login-spotlight-brand">
                <img
                  src="icon.svg"
                  alt="CenterPulse Logo"
                  className="auth-spotlight-logo"
                />
                <div>
                  <p className="auth-spotlight-kicker">Workspace</p>
                  <p className="auth-spotlight-name">CenterPULSE</p>
                </div>
              </div>

              <div className="auth-spotlight-copy auth-login-spotlight-copy">
                <p className="auth-login-spotlight-eyebrow">Login</p>
                <h1 className="auth-spotlight-title">Sign in to continue.</h1>
                <p className="auth-spotlight-text">
                  Use your account to keep going in CenterPULSE.
                </p>
              </div>

              <div className="auth-spotlight-points auth-login-spotlight-points">
                <div className="auth-spotlight-point auth-login-spotlight-point">
                  <span className="auth-spotlight-point-icon auth-login-spotlight-point-icon">
                    <Mail size={16} />
                  </span>
                  <div>
                    <p className="auth-spotlight-point-title">Use your email</p>
                    <p className="auth-spotlight-point-copy">
                      Use the address you signed up with.
                    </p>
                  </div>
                </div>
                <div className="auth-spotlight-point auth-login-spotlight-point">
                  <span className="auth-spotlight-point-icon auth-login-spotlight-point-icon">
                    <ShieldCheck size={16} />
                  </span>
                  <div>
                    <p className="auth-spotlight-point-title">
                      Too many tries slow down
                    </p>
                    <p className="auth-spotlight-point-copy">
                      That helps keep accounts protected.
                    </p>
                  </div>
                </div>
              </div>

              <div className="auth-spotlight-stats auth-login-spotlight-status">
                <div className="auth-spotlight-stat auth-login-spotlight-stat">
                  <p className="auth-spotlight-stat-label">Note</p>
                  <p className="auth-spotlight-stat-value">
                    Sign in and continue.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <Card className="auth-card auth-card-wide auth-login-card">
            <CardHeader className="auth-card-hero auth-login-card-hero">
              <div className="auth-card-hero-copy auth-login-card-copy">
                <span className="auth-eyebrow">Login</span>
                <h2 className="auth-title">Sign in</h2>
                <p className="auth-subtitle">Use your email and password.</p>
              </div>
            </CardHeader>

            <CardContent className="auth-card-body auth-login-card-body space-y-5">
              <form className="auth-form-stack" onSubmit={onSubmit}>
                <div className="auth-panel auth-login-panel">
                  <div className="auth-field-group">
                    <label htmlFor="login-email" className="auth-label">
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
                      className="auth-input"
                      placeholder="Email address"
                    />
                  </div>

                  <div className="auth-field-group mt-4">
                    <label htmlFor="login-password" className="auth-label">
                      Password
                    </label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        value={form.password}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, password: e.target.value }))
                        }
                        className="auth-input pr-10"
                        placeholder="Password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
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
                </div>

                {error ? (
                  <div className="notice notice-error">
                    <div>
                      <p className="notice-title">Couldn&apos;t sign in</p>
                      <p className="notice-text">{error}</p>
                    </div>
                  </div>
                ) : null}

                {showVerifyHint ? (
                  <div className="notice notice-error">
                    <div>
                      <p className="notice-title">Email not verified</p>
                      <p className="notice-text">
                        Need a new link?{" "}
                        <Link to="/verify-email" className="font-semibold">
                          Verify email
                        </Link>
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="auth-actions-row auth-login-actions-row">
                  <p className="auth-login-helper">
                    Use the email on your account.
                  </p>
                  <Link to="/forgot-password" className="auth-link-muted">
                    Forgot password
                  </Link>
                </div>

                <Button
                  disabled={loading || cooldownSeconds > 0}
                  className="auth-primary-button auth-login-submit w-full disabled:cursor-not-allowed disabled:opacity-75"
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

            <CardFooter className="auth-footer-row auth-login-footer">
              <span className="auth-login-footer-copy">Need to register?</span>
              <Link to="/register" className="auth-inline-link">
                Create account
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </section>
  );
}
