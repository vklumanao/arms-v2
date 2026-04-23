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
          "Registration successful. Please check your email to verify your account. After verification, you'll be signed in automatically.",
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
    <section className="relative min-h-[calc(100vh-5rem)] overflow-hidden px-4 py-8 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(14,165,233,0.16),transparent_40%),radial-gradient(circle_at_88%_8%,rgba(30,58,138,0.16),transparent_48%),radial-gradient(circle_at_50%_96%,rgba(16,185,129,0.14),transparent_42%)]" />

      <div className="relative mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[0.92fr_minmax(0,1.5fr)]">
        <aside className="hidden rounded-[1.8rem] border border-slate-200/65 bg-gradient-to-br from-[#12377f] via-[#1E3A8A] to-[#0f766e] p-8 text-white shadow-[0_24px_56px_rgba(15,23,42,0.28)] lg:flex lg:flex-col">
          <img
            src="icon.svg"
            alt="CenterPulse Logo"
            className="h-12 w-auto rounded-xl bg-white/90 p-1.5"
          />

          <div className="mt-8 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/90">
              Join CenterPulse
            </p>
            <h1 className="font-['Manrope'] text-3xl font-extrabold leading-tight">
              Build your research profile in one step.
            </h1>
            <p className="text-sm text-blue-100/95">
              Create your account to manage projects, outputs, and affiliations
              with your research center.
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/90">
              Why register?
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-100">
              <li>Track research outputs in one workspace.</li>
              <li>Align with centers and departments.</li>
              <li>Access role-based tools securely.</li>
            </ul>
          </div>

          <div className="mt-auto rounded-2xl border border-white/20 bg-slate-950/20 px-4 py-3 text-sm text-cyan-50">
            {ckanLoading || ckanGroupsLoading
              ? "Syncing registration options..."
              : "Registration options are ready."}
          </div>
        </aside>

        <Card className="rounded-[1.8rem] border border-slate-200/80 bg-white/95 shadow-[0_14px_44px_rgba(15,23,42,0.14)] backdrop-blur">
          <CardHeader className="space-y-3 pb-2">
            <div className="flex items-center gap-3 lg:hidden">
              <img
                src="icon.svg"
                alt="CenterPulse Logo"
                className="h-10 w-auto"
              />
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Join CenterPulse
              </p>
            </div>

            <h2 className="font-['Manrope'] text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[2rem]">
              Create your account
            </h2>
            <p className="text-sm text-slate-600">
              Register as student or faculty and start managing your research
              work.
            </p>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Profile details
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                      First name
                    </label>
                    <Input
                      className="h-11 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#1E3A8A]/35"
                      placeholder="Juan"
                      required
                      value={form.first_name}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, first_name: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                      M.I.
                    </label>
                    <Input
                      className="h-11 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#1E3A8A]/35"
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

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                      Last name
                    </label>
                    <Input
                      className="h-11 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#1E3A8A]/35"
                      placeholder="Dela Cruz"
                      required
                      value={form.last_name}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, last_name: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                    Email address
                  </label>
                  <Input
                    className="h-11 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#1E3A8A]/35"
                    placeholder="you@example.com"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, email: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Security setup
                </p>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                      Password
                    </label>

                    <div className="relative">
                      <Input
                        className="h-11 rounded-xl border-slate-300 bg-white pr-10 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#1E3A8A]/35"
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

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                      Confirm password
                    </label>

                    <div className="relative">
                      <Input
                        className="h-11 rounded-xl border-slate-300 bg-white pr-10 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#1E3A8A]/35"
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
                        className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
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

                {passwordValue ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      {passwordChecks.length ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-slate-300" />
                      )}
                      <span>8+ chars</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {passwordChecks.uppercase ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-slate-300" />
                      )}
                      <span>Uppercase</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {passwordChecks.lowercase ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-slate-300" />
                      )}
                      <span>Lowercase</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {passwordChecks.number ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-slate-300" />
                      )}
                      <span>Number</span>
                    </div>
                  </div>
                ) : null}

                {form.confirm_password ? (
                  <p
                    className={`mt-2 text-xs font-medium ${
                      passwordsMatch ? "text-emerald-700" : "text-rose-600"
                    }`}
                  >
                    {passwordsMatch
                      ? "Passwords match."
                      : "Passwords do not match yet."}
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Workspace setup
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                      Role
                    </label>

                    <Select
                      value={form.role}
                      onValueChange={(value) =>
                        setForm((p) => ({ ...p, role: value }))
                      }
                    >
                      <SelectTrigger className="h-11 rounded-xl border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-[#1E3A8A]/35">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="faculty">Faculty</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                      Research center (optional)
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
                      <SelectTrigger className="h-11 rounded-xl border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-[#1E3A8A]/35">
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

                    {ckanError ? (
                      <p className="text-xs text-amber-700">{ckanError}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
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
                    <SelectTrigger className="h-11 rounded-xl border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-[#1E3A8A]/35">
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
                        <SelectItem
                          key={group.id}
                          value={group.name || group.id}
                        >
                          {group.title || group.display_name || group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {ckanGroupsError ? (
                    <p className="text-xs text-amber-700">{ckanGroupsError}</p>
                  ) : null}
                </div>
              </div>

              {error ? (
                <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {error}
                </div>
              ) : null}

              {message ? (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  {message}
                </div>
              ) : null}

              <Button
                disabled={loading || cooldownSeconds > 0}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-[#0f766e] to-[#1E3A8A] text-sm font-semibold text-white shadow-[0_12px_26px_rgba(30,58,138,0.24)] transition hover:from-[#0f766e] hover:to-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-75"
              >
                {loading
                  ? "Creating account..."
                  : cooldownSeconds > 0
                    ? `Retry in ${cooldownSeconds}s`
                    : "Create account"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center border-t border-slate-200/80 pt-5 text-sm text-slate-600">
            Already have an account?
            <Link
              className="ml-1 font-semibold text-[#1E3A8A] hover:text-[#1d4ed8] hover:underline"
              to="/login"
            >
              Sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
