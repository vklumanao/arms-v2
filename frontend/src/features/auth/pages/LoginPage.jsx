import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { toDisplayFirstName } from "@/features/auth/utils";
import { isValidEmail } from "@/shared/utils/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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
    <section className="mx-auto max-w-md">
      <Card>
      <CardHeader>
        <h1 className="text-3xl font-bold text-center">Login</h1>
        <p className="mt-1 text-sm text-slate-600 text-center">
          Access your workspace and continue your proposal workflow.
        </p>
      </CardHeader>
      <CardContent>
      <form className="space-y-3" onSubmit={onSubmit}>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Email</span>
          <Input
            placeholder="Enter your institutional email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Password</span>
          <div className="relative">
            <Input
              className="pr-10"
              placeholder="Enter your password"
              type={showPassword ? "text" : "password"}
              required
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 text-slate-600 hover:text-slate-900"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          </div>
        </label>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <Button
          disabled={loading || cooldownSeconds > 0}
          className="w-full"
        >
          {loading
            ? "Logging in..."
            : cooldownSeconds > 0
              ? `Retry in ${cooldownSeconds}s`
              : "Login"}
        </Button>
      </form>
      </CardContent>

      <CardFooter className="flex items-center justify-between text-sm">
        <Link to="/register" className="font-semibold text-[var(--brand)]">
          Create account
        </Link>
        <Link
          to="/forgot-password"
          className="font-semibold text-[var(--brand)]"
        >
          Forgot password?
        </Link>
      </CardFooter>
      </Card>
    </section>
  );
}

