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
    <section className="auth-shell">
      <div className="auth-shell-inner">
        <div className="auth-layout">
          <aside className="auth-spotlight">
            <div className="auth-spotlight-inner">
              <div className="auth-spotlight-brand">
                <img
                  src="icon.svg"
                  alt="CenterPulse Logo"
                  className="auth-spotlight-logo"
                />
                <div>
                  <p className="auth-spotlight-kicker">Research Workspace</p>
                  <p className="auth-spotlight-name">CenterPulse</p>
                </div>
              </div>

              <div className="auth-spotlight-copy">
                <h1 className="auth-spotlight-title">
                  Sign in and pick up where your work paused.
                </h1>
                <p className="auth-spotlight-text">
                  Access research submissions, center updates, and role-based
                  actions from one secure workspace designed for daily use.
                </p>
              </div>

              <div className="auth-spotlight-points">
                <div className="auth-spotlight-point">
                  <span className="auth-spotlight-point-icon">
                    <Mail size={16} />
                  </span>
                  <div>
                    <p className="auth-spotlight-point-title">
                      Use your registered academic email
                    </p>
                    <p className="auth-spotlight-point-copy">
                      Sign in with the same address tied to your CenterPulse
                      account.
                    </p>
                  </div>
                </div>
                <div className="auth-spotlight-point">
                  <span className="auth-spotlight-point-icon">
                    <ShieldCheck size={16} />
                  </span>
                  <div>
                    <p className="auth-spotlight-point-title">
                      Protected access with cooldown control
                    </p>
                    <p className="auth-spotlight-point-copy">
                      Repeated failed attempts are throttled to keep accounts
                      safer.
                    </p>
                  </div>
                </div>
              </div>

              <div className="auth-spotlight-stats">
                <div className="auth-spotlight-stat">
                  <p className="auth-spotlight-stat-label">Today&apos;s flow</p>
                  <p className="auth-spotlight-stat-value">
                    Sign in, continue your research workflow, and return
                    directly to your dashboard.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <Card className="auth-card auth-card-wide">
            <CardHeader className="auth-card-hero">
              <div className="auth-card-hero-brand">
                <img
                  src="icon.svg"
                  alt="CenterPulse Logo"
                  className="auth-card-hero-logo"
                />
                <span className="auth-eyebrow">Workspace Access</span>
              </div>
              <div className="auth-card-hero-copy">
                <h2 className="auth-title">Welcome back</h2>
                <p className="auth-subtitle">
                  Sign in to continue managing submissions, outputs, and center
                  activity.
                </p>
              </div>
            </CardHeader>

            <CardContent className="auth-card-body space-y-5">
              <div className="auth-tips-grid auth-tips-grid-2">
                <div className="auth-tip">
                  Use your registered institutional email.
                </div>
                <div className="auth-tip">
                  Too many attempts trigger a 60-second cooldown.
                </div>
              </div>

              <form className="auth-form-stack" onSubmit={onSubmit}>
                <div className="auth-panel">
                  <div className="auth-field-group">
                    <label htmlFor="login-email" className="auth-label">
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
                      className="auth-input"
                      placeholder="name@institution.edu"
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
                        value={form.password}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, password: e.target.value }))
                        }
                        className="auth-input pr-10"
                        placeholder="Enter password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
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
                      <p className="notice-title">Unable to sign in</p>
                      <p className="notice-text">{error}</p>
                    </div>
                  </div>
                ) : null}

                {showVerifyHint ? (
                  <div
                    className="notice"
                    style={{
                      borderColor: "#fcd34d",
                      background: "#fffbeb",
                      color: "#92400e",
                    }}
                  >
                    <div>
                      <p className="notice-title">Email not verified yet</p>
                      <p className="notice-text">
                        Need a new verification link?{" "}
                        <Link
                          to="/verify-email"
                          className="font-semibold underline"
                        >
                          Verify email
                        </Link>
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="auth-actions-row">
                  <Link to="/forgot-password" className="auth-link-muted">
                    Forgot password
                  </Link>
                  <span>Secure sign-in for research center accounts</span>
                </div>

                <Button
                  disabled={loading || cooldownSeconds > 0}
                  className="auth-primary-button w-full disabled:cursor-not-allowed disabled:opacity-75"
                >
                  {loading
                    ? "Signing in..."
                    : cooldownSeconds > 0
                      ? `Retry in ${cooldownSeconds}s`
                      : "Sign in to dashboard"}
                  <ArrowRight size={16} />
                </Button>
              </form>
            </CardContent>

            <CardFooter className="auth-footer-row">
              <span className="text-slate-600">
                Need a new workspace account?
              </span>
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
