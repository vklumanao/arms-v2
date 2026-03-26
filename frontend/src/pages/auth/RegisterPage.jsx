import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { fetchCkanGroups, fetchCkanOrganizations } from "@/services/ckanApi";
import { isValidEmail, validatePasswordStrength } from "@/utils/validation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SIGNUP_COOLDOWN_KEY = "arms_signup_cooldown_until";
const DEFAULT_SIGNUP_COOLDOWN_SECONDS = 300;

export default function RegisterPage() {
  const NONE_SELECT_VALUE = "__none__";
  const navigate = useNavigate();
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    middle_initial: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
    role: "student",
    department: "",
    ckan_org_id: "",
    ckan_group_id: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ckanLoading, setCkanLoading] = useState(true);
  const [ckanGroupsLoading, setCkanGroupsLoading] = useState(true);
  const [ckanError, setCkanError] = useState("");
  const [ckanGroupsError, setCkanGroupsError] = useState("");
  const [ckanOrganizations, setCkanOrganizations] = useState([]);
  const [ckanGroups, setCkanGroups] = useState([]);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const passwordValue = form.password || "";
  const passwordChecks = {
    length: passwordValue.length >= 8,
    uppercase: /[A-Z]/.test(passwordValue),
    lowercase: /[a-z]/.test(passwordValue),
    number: /\d/.test(passwordValue),
  };
  const passwordsMatch =
    form.confirm_password !== "" && form.confirm_password === form.password;

  useEffect(() => {
    const storedUntil = Number(
      window.localStorage.getItem(SIGNUP_COOLDOWN_KEY) || 0,
    );
    if (storedUntil > Date.now()) {
      setCooldownSeconds(Math.ceil((storedUntil - Date.now()) / 1000));
    }
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;

    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setCkanLoading(true);
      setCkanError("");
      try {
        const payload = await fetchCkanOrganizations();
        if (cancelled) return;
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setCkanOrganizations(rows);
      } catch (err) {
        if (cancelled) return;
        setCkanError(
          String(err?.message || "Unable to load CKAN organizations."),
        );
      } finally {
        if (!cancelled) setCkanLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setCkanGroupsLoading(true);
      setCkanGroupsError("");
      try {
        const payload = await fetchCkanGroups();
        if (cancelled) return;
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setCkanGroups(rows);
      } catch (err) {
        if (cancelled) return;
        setCkanGroupsError(
          String(err?.message || "Unable to load CKAN groups."),
        );
      } finally {
        if (!cancelled) setCkanGroupsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading || cooldownSeconds > 0) return;

    setLoading(true);
    setError("");
    setMessage("");

    const normalizedEmail = form.email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }
    if (!form.first_name.trim()) {
      setError("First name is required.");
      setLoading(false);
      return;
    }
    if (!form.last_name.trim()) {
      setError("Last name is required.");
      setLoading(false);
      return;
    }
    const passwordError = validatePasswordStrength(form.password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }
    if (!form.confirm_password || form.confirm_password !== form.password) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }
    try {
      const result = await register({
        first_name: form.first_name.trim(),
        middle_initial: form.middle_initial.trim() || null,
        last_name: form.last_name.trim(),
        email: normalizedEmail,
        password: form.password,
        role: form.role,
        department: form.department.trim() || null,
        ckan_org_id: form.ckan_org_id || null,
        ckan_group_id: form.ckan_group_id || null,
      });

      if (result?.requires_verification) {
        setMessage(
          "Registration successful. Please check your email to verify your account.",
        );
        window.localStorage.removeItem(SIGNUP_COOLDOWN_KEY);
        return;
      }

      setMessage("Registration successful. Redirecting to dashboard...");
      window.localStorage.removeItem(SIGNUP_COOLDOWN_KEY);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const message = String(err?.message || "Unexpected registration error.");
      if (message.toLowerCase().includes("too many")) {
        const retryAfterSeconds = DEFAULT_SIGNUP_COOLDOWN_SECONDS;
        const cooldownUntil = Date.now() + retryAfterSeconds * 1000;
        window.localStorage.setItem(SIGNUP_COOLDOWN_KEY, String(cooldownUntil));
        setCooldownSeconds(retryAfterSeconds);
        setError(
          `Too many signup attempts. Please wait ${retryAfterSeconds} seconds before trying again.`,
        );
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-4xl px-4 py-10">
      <Card className="shadow-lg border border-slate-200 rounded-2xl">
        <CardHeader className="space-y-2 text-center pb-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Create your account
          </h1>
          <p className="text-sm text-slate-500">
            Join as a student or faculty to manage research projects
          </p>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">
                    First name
                  </label>
                  <Input
                    className="rounded-lg"
                    placeholder="Juan"
                    required
                    value={form.first_name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, first_name: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">
                    M.I.
                  </label>
                  <Input
                    className="rounded-lg"
                    placeholder="M"
                    maxLength={2}
                    value={form.middle_initial}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        middle_initial: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">
                    Last name
                  </label>
                  <Input
                    className="rounded-lg"
                    placeholder="Dela Cruz"
                    required
                    value={form.last_name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, last_name: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">
                  Email address
                </label>
                <Input
                  className="rounded-lg"
                  placeholder="you@example.com"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, email: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500">
                  Password
                </label>

                <div className="relative">
                  <Input
                    className="pr-10 rounded-lg"
                    placeholder="Create a secure password"
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>

                {passwordValue ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      {passwordChecks.length ? (
                        <Check className="text-emerald-500 w-3 h-3" />
                      ) : (
                        <X className="text-slate-300 w-3 h-3" />
                      )}
                      <span>8+ chars</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {passwordChecks.uppercase ? (
                        <Check className="text-emerald-500 w-3 h-3" />
                      ) : (
                        <X className="text-slate-300 w-3 h-3" />
                      )}
                      <span>Uppercase</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {passwordChecks.lowercase ? (
                        <Check className="text-emerald-500 w-3 h-3" />
                      ) : (
                        <X className="text-slate-300 w-3 h-3" />
                      )}
                      <span>Lowercase</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {passwordChecks.number ? (
                        <Check className="text-emerald-500 w-3 h-3" />
                      ) : (
                        <X className="text-slate-300 w-3 h-3" />
                      )}
                      <span>Number</span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">
                  Confirm password
                </label>

                <div className="relative">
                  <Input
                    className="pr-10 rounded-lg"
                    placeholder="Re-enter password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={form.confirm_password}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        confirm_password: e.target.value,
                      }))
                    }
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">
                    Role
                  </label>

                  <Select
                    value={form.role}
                    onValueChange={(value) =>
                      setForm((p) => ({ ...p, role: value }))
                    }
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="faculty">Faculty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">
                    Research Center (optional)
                  </label>

                  <Select
                    value={form.ckan_org_id || NONE_SELECT_VALUE}
                    onValueChange={(value) =>
                      setForm((p) => ({
                        ...p,
                        ckan_org_id: value === NONE_SELECT_VALUE ? "" : value,
                      }))
                    }
                    disabled={ckanLoading}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue
                        placeholder={
                          ckanLoading
                            ? "Loading centers..."
                            : "Select research center"
                        }
                      />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value={NONE_SELECT_VALUE}>None</SelectItem>

                      {ckanOrganizations.map((org) => (
                        <SelectItem key={org.id} value={org.name || org.id}>
                          {org.title || org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">
                  Department (optional)
                </label>

                <Select
                  value={form.ckan_group_id || NONE_SELECT_VALUE}
                  onValueChange={(value) =>
                    setForm((p) => ({
                      ...p,
                      ckan_group_id: value === NONE_SELECT_VALUE ? "" : value,
                    }))
                  }
                  disabled={ckanGroupsLoading}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue
                      placeholder={
                        ckanGroupsLoading
                          ? "Loading departments..."
                          : "Select department"
                      }
                    />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value={NONE_SELECT_VALUE}>None</SelectItem>

                    {ckanGroups.map((group) => (
                      <SelectItem key={group.id} value={group.name || group.id}>
                        {group.title || group.display_name || group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {ckanGroupsError && (
                  <p className="text-xs text-red-500">{ckanGroupsError}</p>
                )}
              </div>

              <div className="space-y-1 text-sm">
                {error && <p className="text-red-500">{error}</p>}
                {message && <p className="text-emerald-600">{message}</p>}
              </div>

              <Button
                disabled={loading || cooldownSeconds > 0}
                className="w-full rounded-lg h-11 text-sm font-medium"
              >
                {loading
                  ? "Creating account..."
                  : cooldownSeconds > 0
                    ? `Retry in ${cooldownSeconds}s`
                    : "Create account"}
              </Button>
            </div>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center text-sm text-slate-500">
          Already have an account?
          <Link
            className="ml-1 font-medium text-blue-600 hover:underline"
            to="/login"
          >
            Sign in
          </Link>
        </CardFooter>
      </Card>
    </section>
  );
}
