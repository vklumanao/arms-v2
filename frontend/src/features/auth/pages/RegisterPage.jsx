import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { fetchCkanGroups, fetchCkanOrganizations } from "@/shared/api/ckanApi";
import {
  isValidEmail,
  validatePasswordStrength,
} from "@/shared/utils/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
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
    if (form.full_name.trim().length < 3) {
      setError("Full name must be at least 3 characters.");
      setLoading(false);
      return;
    }
    const passwordError = validatePasswordStrength(form.password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }
    try {
      await register({
        full_name: form.full_name.trim(),
        email: normalizedEmail,
        password: form.password,
        role: form.role,
        department: form.department.trim() || null,
        ckan_org_id: form.ckan_org_id || null,
        ckan_group_id: form.ckan_group_id || null,
      });

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
    <section className="mx-auto max-w-md">
      <Card>
      <CardHeader>
        <h1 className="text-3xl font-bold text-center">Create Account</h1>
        <p className="mt-1 text-sm text-slate-600 text-center">
          Register as student or faculty to manage research projects.
        </p>
      </CardHeader>
      <CardContent>
      <form className="space-y-3" onSubmit={onSubmit}>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Full name</span>
          <Input
            placeholder="Enter your full name"
            required
            value={form.full_name}
            onChange={(e) =>
              setForm((p) => ({ ...p, full_name: e.target.value }))
            }
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Email</span>
          <Input
            placeholder="Enter your email address"
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
              placeholder="Create a password"
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
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Role</span>
          <Select
            value={form.role}
            onValueChange={(value) => setForm((p) => ({ ...p, role: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="faculty">Faculty</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Research Center</span>
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
            <SelectTrigger>
              <SelectValue
                placeholder={
                  ckanLoading
                    ? "Loading Research Centers..."
                    : "Optional: Select Research Center"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_SELECT_VALUE}>
                Optional: Select Research Center
              </SelectItem>
              {ckanOrganizations.map((org) => (
                <SelectItem key={org.id} value={org.name || org.id}>
                  {org.title || org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Department</span>
          <Select
            value={form.ckan_group_id || NONE_SELECT_VALUE}
            onValueChange={(value) =>
              setForm((p) => {
                if (value === NONE_SELECT_VALUE) {
                  return { ...p, ckan_group_id: "", department: "" };
                }
                const selectedGroup = ckanGroups.find(
                  (group) => String(group.name || group.id) === String(value),
                );
                return {
                  ...p,
                  ckan_group_id: value,
                  department: selectedGroup?.title || selectedGroup?.name || "",
                };
              })
            }
            disabled={ckanGroupsLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  ckanGroupsLoading
                    ? "Loading department..."
                    : "Optional: Select department"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_SELECT_VALUE}>
                Optional: Select department
              </SelectItem>
              {ckanGroups.map((group) => (
                <SelectItem key={group.id} value={group.name || group.id}>
                  {group.title || group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        {ckanError && (
          <p className="text-sm text-[var(--danger)]">{ckanError}</p>
        )}
        {ckanGroupsError && (
          <p className="text-sm text-[var(--danger)]">{ckanGroupsError}</p>
        )}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        {message && <p className="text-sm text-[var(--success)]">{message}</p>}

        <Button
          disabled={loading || cooldownSeconds > 0}
          className="w-full"
        >
          {loading
            ? "Creating account..."
            : cooldownSeconds > 0
              ? `Retry in ${cooldownSeconds}s`
              : "Register"}
        </Button>
      </form>
      </CardContent>

      <CardFooter className="text-sm text-slate-600">
        Already have an account?{" "}
        <Link className="text-blue-700" to="/login">
          Login
        </Link>
      </CardFooter>
      </Card>
    </section>
  );
}

