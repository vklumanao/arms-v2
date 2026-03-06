import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { isValidEmail } from "@/shared/utils/validation";

function toDisplayFirstName(profile, email = "") {
  const fullName = String(profile?.full_name || "").trim();
  if (fullName) {
    if (fullName.includes(",")) {
      const [, givenPart = ""] = fullName.split(",", 2);
      const first = givenPart.trim().split(/\s+/)[0] || "";
      if (first) return first;
    }
    const first = fullName.split(/\s+/)[0] || "";
    if (first) return first;
  }

  const emailUser = String(email || "")
    .trim()
    .split("@")[0]
    ?.split(/[._-]+/)[0];
  if (emailUser) {
    return emailUser.charAt(0).toUpperCase() + emailUser.slice(1);
  }

  return "User";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user, loading: authLoading, signIn } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

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
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-md panel">
      <div className="panel-header">
        <img
          src="/arms-logo-v2.svg"
          alt="ARMS Logo"
          className="mb-3 h-12 w-auto"
        />
        <h1 className="text-2xl font-bold">Login</h1>
        <p className="mt-1 text-sm text-slate-600">
          Access your workspace and continue your proposal workflow.
        </p>
      </div>
      <form className="panel-body space-y-3" onSubmit={onSubmit}>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Email</span>
          <input
            className="control-input"
            placeholder="Enter your institutional email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Password</span>
          <input
            className="control-input"
            placeholder="Enter your password"
            type="password"
            required
            value={form.password}
            onChange={(e) =>
              setForm((p) => ({ ...p, password: e.target.value }))
            }
          />
        </label>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button
          disabled={loading || cooldownSeconds > 0}
          className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Logging in..."
            : cooldownSeconds > 0
              ? `Retry in ${cooldownSeconds}s`
              : "Login"}
        </button>
      </form>

      <div className="flex items-center justify-between px-6 pb-6 text-sm">
        <Link to="/register" className="font-semibold text-[var(--brand)]">
          Create account
        </Link>
        <Link
          to="/forgot-password"
          className="font-semibold text-[var(--brand)]"
        >
          Forgot password?
        </Link>
      </div>
    </section>
  );
}

