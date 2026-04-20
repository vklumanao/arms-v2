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
    <section className="mx-auto max-w-md">
      <Card className="border border-zinc-200 shadow-sm">
        <CardHeader className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">Sign in</h1>
          <p className="text-sm text-zinc-500">
            Access your workspace to continue your workflow.
          </p>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-600">Email</label>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                className="h-10"
                placeholder="name@institution.edu"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-zinc-600">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, password: e.target.value }))
                  }
                  className="h-10 pr-10"
                  placeholder="Enter password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>

            {/* Error */}
            {error && <p className="text-sm text-zinc-600">{error}</p>}

            {showVerifyHint && (
              <p className="text-xs text-zinc-500">
                Need a new verification link?{" "}
                <Link
                  to="/verify-email"
                  className="underline hover:text-zinc-700"
                >
                  Verify email
                </Link>
              </p>
            )}

            <Button
              disabled={loading || cooldownSeconds > 0}
              className="w-full h-10"
            >
              {loading
                ? "Signing in..."
                : cooldownSeconds > 0
                  ? `Retry in ${cooldownSeconds}s`
                  : "Sign in"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-between text-sm text-zinc-500">
          <Link to="/register" className="hover:text-zinc-700">
            Create account
          </Link>
          <Link to="/forgot-password" className="hover:text-zinc-700">
            Forgot password
          </Link>
        </CardFooter>
      </Card>
    </section>
  );
}
