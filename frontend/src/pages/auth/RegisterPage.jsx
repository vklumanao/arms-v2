import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Eye, EyeOff, X } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { fetchCkanGroups, fetchCkanOrganizations } from "@/services/ckanApi";
import { isValidEmail, validatePasswordStrength } from "@/utils/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
      const requestError = String(
        err?.message || "Unexpected registration error.",
      );
      if (requestError.toLowerCase().includes("too many")) {
        const retryAfterSeconds = DEFAULT_SIGNUP_COOLDOWN_SECONDS;
        const cooldownUntil = Date.now() + retryAfterSeconds * 1000;
        window.localStorage.setItem(SIGNUP_COOLDOWN_KEY, String(cooldownUntil));
        setCooldownSeconds(retryAfterSeconds);
        setError(
          `Too many signup attempts. Please wait ${retryAfterSeconds} seconds before trying again.`,
        );
        return;
      }
      setError(requestError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <div className="flex h-full items-center justify-center px-4 py-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-7xl lg:max-h-full lg:overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1.18fr)]">
            <aside className="relative overflow-hidden border-b border-slate-200 bg-[url('/images/bg.jpeg')] bg-cover bg-center px-6 py-6 text-white sm:px-8 sm:py-7 lg:border-b-0 lg:border-r lg:border-white/10 lg:px-8 lg:py-8">
              <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(15,23,42,0.9)_0%,rgba(19,78,74,0.82)_48%,rgba(6,78,59,0.72)_100%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_20%_80%,rgba(52,211,153,0.18),transparent_26%)]" />
              <div className="absolute inset-0 bg-black/15" />

              <div className="relative flex h-full flex-col justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/16 backdrop-blur-sm">
                    <img
                      src="icon.svg"
                      alt="CenterPulse Logo"
                      className="h-24 w-24 object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-50/90">
                      Account Registration
                    </p>
                    <p className="text-xl font-semibold tracking-[0.08em] text-white drop-shadow-[0_2px_10px_rgba(15,23,42,0.35)]">
                      CenterPULSE: Platform for University Logging of Scholarly
                      Engagements
                    </p>
                  </div>
                </div>

                <div className="max-w-lg space-y-3">
                  <p className="text-sm font-medium uppercase tracking-[0.22em] text-emerald-50/90">
                    Create Account
                  </p>
                  <h1 className="text-3xl font-semibold leading-tight text-white drop-shadow-[0_4px_18px_rgba(15,23,42,0.45)] sm:text-[2rem]">
                    Build your profile and join the CenterPULSE workspace.
                  </h1>
                  <p className="max-w-lg text-sm leading-6 text-slate-100 sm:text-[15px]">
                    Set up your account details, choose your academic role, and
                    create a secure password to begin working in one place.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/18 bg-white/12 p-4 backdrop-blur-md">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/14 text-emerald-50">
                      <Check size={18} />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      Complete Profile
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-100">
                      Add your identity details so your account is ready for
                      academic and research workflows.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/18 bg-white/12 p-4 backdrop-blur-md">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/14 text-emerald-50">
                      <ArrowRight size={18} />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      Verify and Continue
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-100">
                      After registration, verify your email so CenterPULSE can
                      activate your account securely.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/12 bg-black/10 p-4 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/80">
                    Workspace-ready
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-100">
                    Research center and department links are optional, so you
                    can finish setup now and refine your profile later.
                  </p>
                </div>
              </div>
            </aside>

            <div className="px-6 py-5 sm:px-8 sm:py-6 lg:h-full lg:overflow-hidden lg:px-8 lg:py-6">
              <div className="lg:flex lg:h-full lg:flex-col">
                <CardHeader className="space-y-3 px-0 pb-4 pt-0 lg:flex-shrink-0">
                  <div className="space-y-1.5">
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900 lg:text-3xl">
                      Create account
                    </h2>
                    <p className="text-sm leading-6 text-slate-600">
                      Complete your profile and set a secure password to start
                      using CenterPULSE.
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 px-0 lg:flex-1 lg:overflow-hidden">
                  {error ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                      <p className="font-semibold text-rose-900">
                        Couldn&apos;t create account
                      </p>
                      <p className="mt-1 leading-6">{error}</p>
                    </div>
                  ) : null}

                  {message ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      <p className="font-semibold text-emerald-900">
                        Account created
                      </p>
                      <p className="mt-1 leading-6">{message}</p>
                    </div>
                  ) : null}

                  <form
                    onSubmit={onSubmit}
                    className="space-y-3 lg:flex lg:h-full lg:flex-col"
                  >
                    <div className="grid gap-3 lg:flex-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:overflow-hidden">
                      <div className="space-y-3">
                        <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Profile
                            </p>
                            <p className="text-sm text-slate-600">
                              Add your name and primary email address.
                            </p>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)]">
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-700">
                                First name
                              </label>
                              <Input
                                className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                                placeholder="First name"
                                required
                                value={form.first_name}
                                onChange={(e) =>
                                  setForm((p) => ({
                                    ...p,
                                    first_name: e.target.value,
                                  }))
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-700">
                                M.I.
                              </label>
                              <Input
                                className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
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
                              <label className="text-sm font-medium text-slate-700">
                                Last name
                              </label>
                              <Input
                                className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                                placeholder="Last name"
                                required
                                value={form.last_name}
                                onChange={(e) =>
                                  setForm((p) => ({
                                    ...p,
                                    last_name: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Security
                            </p>
                            <p className="text-sm text-slate-600">
                              Set a password that meets the registration rules.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">
                              Email address
                            </label>
                            <Input
                              className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                              placeholder="Email address"
                              type="email"
                              required
                              value={form.email}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  email: e.target.value,
                                }))
                              }
                            />
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-700">
                                Password
                              </label>
                              <div className="relative">
                                <Input
                                  className="h-12 rounded-xl border-slate-300 bg-white pr-12 text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                                  placeholder="Password"
                                  type={showPassword ? "text" : "password"}
                                  required
                                  value={form.password}
                                  onChange={(e) =>
                                    setForm((p) => ({
                                      ...p,
                                      password: e.target.value,
                                    }))
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                  onClick={() =>
                                    setShowPassword((prev) => !prev)
                                  }
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
                              <label className="text-sm font-medium text-slate-700">
                                Confirm password
                              </label>
                              <div className="relative">
                                <Input
                                  className="h-12 rounded-xl border-slate-300 bg-white pr-12 text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                                  placeholder="Confirm password"
                                  type={
                                    showConfirmPassword ? "text" : "password"
                                  }
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
                                  className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                  onClick={() =>
                                    setShowConfirmPassword((prev) => !prev)
                                  }
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
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div
                                className={`inline-flex items-center rounded-xl border px-3 py-2 text-xs font-medium ${
                                  passwordChecks.length
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-rose-200 bg-rose-50 text-rose-700"
                                }`}
                              >
                                {passwordChecks.length ? (
                                  <Check className="mr-2 h-3.5 w-3.5" />
                                ) : (
                                  <X className="mr-2 h-3.5 w-3.5" />
                                )}
                                8+ characters
                              </div>
                              <div
                                className={`inline-flex items-center rounded-xl border px-3 py-2 text-xs font-medium ${
                                  passwordChecks.uppercase
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-rose-200 bg-rose-50 text-rose-700"
                                }`}
                              >
                                {passwordChecks.uppercase ? (
                                  <Check className="mr-2 h-3.5 w-3.5" />
                                ) : (
                                  <X className="mr-2 h-3.5 w-3.5" />
                                )}
                                Uppercase letter
                              </div>
                              <div
                                className={`inline-flex items-center rounded-xl border px-3 py-2 text-xs font-medium ${
                                  passwordChecks.lowercase
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-rose-200 bg-rose-50 text-rose-700"
                                }`}
                              >
                                {passwordChecks.lowercase ? (
                                  <Check className="mr-2 h-3.5 w-3.5" />
                                ) : (
                                  <X className="mr-2 h-3.5 w-3.5" />
                                )}
                                Lowercase letter
                              </div>
                              <div
                                className={`inline-flex items-center rounded-xl border px-3 py-2 text-xs font-medium ${
                                  passwordChecks.number
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-rose-200 bg-rose-50 text-rose-700"
                                }`}
                              >
                                {passwordChecks.number ? (
                                  <Check className="mr-2 h-3.5 w-3.5" />
                                ) : (
                                  <X className="mr-2 h-3.5 w-3.5" />
                                )}
                                Number
                              </div>
                            </div>
                          ) : null}

                          {form.confirm_password ? (
                            <div
                              className={`rounded-2xl border px-4 py-2.5 text-sm ${
                                passwordsMatch
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : "border-amber-200 bg-amber-50 text-amber-900"
                              }`}
                            >
                              {passwordsMatch
                                ? "Passwords match."
                                : "Passwords do not match yet."}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Workspace
                          </p>
                          <p className="text-sm text-slate-600">
                            Choose your role and optionally connect your
                            academic unit.
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">
                              Role
                            </label>
                            <Select
                              value={form.role}
                              onValueChange={(value) =>
                                setForm((p) => ({ ...p, role: value }))
                              }
                            >
                              <SelectTrigger className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 shadow-none focus:ring-emerald-500/20">
                                <SelectValue placeholder="Role" />
                              </SelectTrigger>

                              <SelectContent>
                                <SelectItem value="student">Student</SelectItem>
                                <SelectItem value="faculty">Faculty</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">
                              Research center
                            </label>
                            <Select
                              value={form.ckan_org_id || NONE_SELECT_VALUE}
                              onValueChange={(value) =>
                                setForm((p) => ({
                                  ...p,
                                  ckan_org_id:
                                    value === NONE_SELECT_VALUE ? "" : value,
                                }))
                              }
                              disabled={ckanLoading}
                            >
                              <SelectTrigger className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 shadow-none focus:ring-emerald-500/20">
                                <SelectValue
                                  placeholder={
                                    ckanLoading
                                      ? "Loading..."
                                      : "Research center"
                                  }
                                />
                              </SelectTrigger>

                              <SelectContent>
                                <SelectItem value={NONE_SELECT_VALUE}>
                                  None
                                </SelectItem>

                                {ckanOrganizations.map((org) => (
                                  <SelectItem
                                    key={org.id}
                                    value={org.name || org.id}
                                  >
                                    {org.title || org.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {ckanError ? (
                              <p className="text-xs text-rose-700">
                                {ckanError}
                              </p>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">
                              Department
                            </label>
                            <Select
                              value={form.ckan_group_id || NONE_SELECT_VALUE}
                              onValueChange={(value) =>
                                setForm((p) => ({
                                  ...p,
                                  ckan_group_id:
                                    value === NONE_SELECT_VALUE ? "" : value,
                                }))
                              }
                              disabled={ckanGroupsLoading}
                            >
                              <SelectTrigger className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 shadow-none focus:ring-emerald-500/20">
                                <SelectValue
                                  placeholder={
                                    ckanGroupsLoading
                                      ? "Loading..."
                                      : "Department"
                                  }
                                />
                              </SelectTrigger>

                              <SelectContent>
                                <SelectItem value={NONE_SELECT_VALUE}>
                                  None
                                </SelectItem>

                                {ckanGroups.map((group) => (
                                  <SelectItem
                                    key={group.id}
                                    value={group.name || group.id}
                                  >
                                    {group.title ||
                                      group.display_name ||
                                      group.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {ckanGroupsError ? (
                              <p className="text-xs text-rose-700">
                                {ckanGroupsError}
                              </p>
                            ) : null}
                          </div>

                          <div className="rounded-2xl border border-white bg-white/80 px-4 py-2.5 text-sm text-slate-600">
                            Research center and department are optional and can
                            be updated later if needed.
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      disabled={loading || cooldownSeconds > 0}
                      className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-75"
                    >
                      {loading
                        ? "Creating account..."
                        : cooldownSeconds > 0
                          ? `Try again in ${cooldownSeconds}s`
                          : "Create account"}
                      <ArrowRight size={16} />
                    </Button>
                  </form>
                </CardContent>

                <div className="mt-4 border-t border-slate-200 pt-4 text-center text-sm text-slate-600 lg:flex-shrink-0">
                  Already registered?{" "}
                  <Link
                    className="font-semibold text-emerald-700 transition hover:text-emerald-800"
                    to="/login"
                  >
                    Sign in
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
