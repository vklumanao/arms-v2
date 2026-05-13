import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
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
    <section className="auth-shell">
      <div className="auth-shell-inner">
        <div className="auth-layout auth-layout-register">
          <aside className="auth-spotlight auth-register-spotlight">
            <div className="auth-spotlight-inner auth-register-spotlight-inner">
              <div className="auth-spotlight-brand auth-register-spotlight-brand">
                <img
                  src="icon.svg"
                  alt="CenterPulse Logo"
                  className="auth-spotlight-logo"
                />
                <div>
                  <p className="auth-spotlight-kicker">Join The Workspace</p>
                  <p className="auth-spotlight-name">CenterPULSE</p>
                </div>
              </div>

              <div className="auth-spotlight-copy auth-register-spotlight-copy">
                <p className="auth-register-spotlight-eyebrow">
                  Registration guide
                </p>
                <h1 className="auth-spotlight-title">
                  Set up your research account with the right details from the
                  start.
                </h1>
                <p className="auth-spotlight-text">
                  Create your profile once, assign your role, and connect the
                  affiliations that shape how your workspace opens.
                </p>
              </div>

              <div className="auth-spotlight-points auth-register-spotlight-points">
                <div className="auth-spotlight-point auth-register-spotlight-point">
                  <div className="auth-register-spotlight-step">01</div>
                  <span className="auth-spotlight-point-icon auth-register-spotlight-point-icon">
                    <Users size={16} />
                  </span>
                  <div>
                    <p className="auth-spotlight-point-title">
                      Choose the role that fits your work
                    </p>
                    <p className="auth-spotlight-point-copy">
                      Students and faculty members see different tools, so role
                      selection sets the right starting view.
                    </p>
                  </div>
                </div>
                <div className="auth-spotlight-point auth-register-spotlight-point">
                  <div className="auth-register-spotlight-step">02</div>
                  <span className="auth-spotlight-point-icon auth-register-spotlight-point-icon">
                    <Building2 size={16} />
                  </span>
                  <div>
                    <p className="auth-spotlight-point-title">
                      Add center or department affiliations
                    </p>
                    <p className="auth-spotlight-point-copy">
                      These details help place your account in the correct
                      research context without slowing down sign-up.
                    </p>
                  </div>
                </div>
                <div className="auth-spotlight-point auth-register-spotlight-point">
                  <div className="auth-register-spotlight-step">03</div>
                  <span className="auth-spotlight-point-icon auth-register-spotlight-point-icon">
                    <ShieldCheck size={16} />
                  </span>
                  <div>
                    <p className="auth-spotlight-point-title">
                      Confirm your email and continue
                    </p>
                    <p className="auth-spotlight-point-copy">
                      Once verification is complete, the system can take you
                      straight into the workspace.
                    </p>
                  </div>
                </div>
              </div>

              <div className="auth-spotlight-stats auth-register-spotlight-status">
                <div className="auth-spotlight-stat auth-register-spotlight-stat">
                  <p className="auth-spotlight-stat-label">
                    Registration status
                  </p>
                  <p className="auth-spotlight-stat-value">
                    {ckanLoading || ckanGroupsLoading
                      ? "Syncing research centers and departments..."
                      : "Registration options are ready."}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <Card className="auth-card">
            <CardHeader className="auth-card-hero">
              <div className="auth-card-hero-brand">
                <span className="auth-eyebrow">Account Registration</span>
              </div>
              <div className="auth-card-hero-copy">
                <h2 className="auth-title">Create your account</h2>
                <p className="auth-subtitle">
                  Register as student or faculty and start managing your
                  research work in one secure workspace.
                </p>
              </div>
            </CardHeader>

            <CardContent className="auth-card-body">
              <form onSubmit={onSubmit} className="auth-form-stack">
                <div className="auth-panel">
                  <p className="auth-section-heading">Profile details</p>

                  <div className="auth-form-grid auth-form-grid-3">
                    <div className="auth-field-group">
                      <label className="auth-label">First name</label>
                      <Input
                        className="auth-input"
                        placeholder="Juan"
                        required
                        value={form.first_name}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, first_name: e.target.value }))
                        }
                      />
                    </div>

                    <div className="auth-field-group">
                      <label className="auth-label">M.I.</label>
                      <Input
                        className="auth-input"
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

                    <div className="auth-field-group">
                      <label className="auth-label">Last name</label>
                      <Input
                        className="auth-input"
                        placeholder="Dela Cruz"
                        required
                        value={form.last_name}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, last_name: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="auth-field-group mt-4">
                    <label className="auth-label">Email address</label>
                    <Input
                      className="auth-input"
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

                <div className="auth-panel">
                  <p className="auth-section-heading">Security setup</p>

                  <div className="auth-form-grid auth-form-grid-2">
                    <div className="auth-field-group">
                      <label className="auth-label">Password</label>

                      <div className="relative">
                        <Input
                          className="auth-input pr-10"
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

                    <div className="auth-field-group">
                      <label className="auth-label">Confirm password</label>

                      <div className="relative">
                        <Input
                          className="auth-input pr-10"
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
                    <div className="auth-password-grid mt-4">
                      <div
                        className={`auth-password-chip ${passwordChecks.length ? "is-valid" : ""}`}
                      >
                        {passwordChecks.length ? (
                          <Check className="mr-1 inline h-3.5 w-3.5" />
                        ) : (
                          <X className="mr-1 inline h-3.5 w-3.5" />
                        )}
                        8+ chars
                      </div>
                      <div
                        className={`auth-password-chip ${passwordChecks.uppercase ? "is-valid" : ""}`}
                      >
                        {passwordChecks.uppercase ? (
                          <Check className="mr-1 inline h-3.5 w-3.5" />
                        ) : (
                          <X className="mr-1 inline h-3.5 w-3.5" />
                        )}
                        Uppercase
                      </div>
                      <div
                        className={`auth-password-chip ${passwordChecks.lowercase ? "is-valid" : ""}`}
                      >
                        {passwordChecks.lowercase ? (
                          <Check className="mr-1 inline h-3.5 w-3.5" />
                        ) : (
                          <X className="mr-1 inline h-3.5 w-3.5" />
                        )}
                        Lowercase
                      </div>
                      <div
                        className={`auth-password-chip ${passwordChecks.number ? "is-valid" : ""}`}
                      >
                        {passwordChecks.number ? (
                          <Check className="mr-1 inline h-3.5 w-3.5" />
                        ) : (
                          <X className="mr-1 inline h-3.5 w-3.5" />
                        )}
                        Number
                      </div>
                    </div>
                  ) : null}

                  {form.confirm_password ? (
                    <p
                      className={`auth-password-hint ${passwordsMatch ? "is-valid" : "is-invalid"}`}
                    >
                      {passwordsMatch
                        ? "Passwords match."
                        : "Passwords do not match yet."}
                    </p>
                  ) : null}
                </div>

                <div className="auth-panel">
                  <p className="auth-section-heading">Workspace setup</p>

                  <div className="auth-form-grid auth-form-grid-2">
                    <div className="auth-field-group">
                      <label className="auth-label">Role</label>

                      <Select
                        value={form.role}
                        onValueChange={(value) =>
                          setForm((p) => ({ ...p, role: value }))
                        }
                      >
                        <SelectTrigger className="auth-select-trigger">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="faculty">Faculty</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="auth-field-group">
                      <label className="auth-label">
                        Research center (optional)
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
                        <SelectTrigger className="auth-select-trigger">
                          <SelectValue
                            placeholder={
                              ckanLoading
                                ? "Loading centers..."
                                : "Select research center"
                            }
                          />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value={NONE_SELECT_VALUE}>
                            None
                          </SelectItem>

                          {ckanOrganizations.map((org) => (
                            <SelectItem key={org.id} value={org.name || org.id}>
                              {org.title || org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {ckanError ? (
                        <p className="field-error">{ckanError}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="auth-field-group mt-4">
                    <label className="auth-label">Department (optional)</label>

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
                      <SelectTrigger className="auth-select-trigger">
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
                      <p className="field-error">{ckanGroupsError}</p>
                    ) : null}
                  </div>
                </div>

                {error ? (
                  <div className="notice notice-error">
                    <div>
                      <p className="notice-title">
                        Registration could not continue
                      </p>
                      <p className="notice-text">{error}</p>
                    </div>
                  </div>
                ) : null}

                {message ? (
                  <div className="notice notice-success">
                    <div>
                      <p className="notice-title">Registration successful</p>
                      <p className="notice-text">{message}</p>
                    </div>
                  </div>
                ) : null}

                <Button
                  disabled={loading || cooldownSeconds > 0}
                  className="auth-primary-button w-full disabled:cursor-not-allowed disabled:opacity-75"
                >
                  {loading
                    ? "Creating account..."
                    : cooldownSeconds > 0
                      ? `Retry in ${cooldownSeconds}s`
                      : "Create account"}
                  <ArrowRight size={16} />
                </Button>
              </form>
            </CardContent>

            <CardFooter className="auth-footer-row">
              <span className="text-slate-600">Already have an account?</span>
              <Link className="auth-inline-link" to="/login">
                Sign in
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </section>
  );
}
