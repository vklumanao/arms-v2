import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { fetchCkanGroups, fetchCkanOrganizations } from "@/shared/api/ckanApi";
import {
  isValidEmail,
  validatePasswordStrength,
} from "@/shared/utils/validation";

const SIGNUP_COOLDOWN_KEY = "arms_signup_cooldown_until";
const DEFAULT_SIGNUP_COOLDOWN_SECONDS = 300;

export default function RegisterPage() {
  const { register } = useAuth();
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
    if (!form.ckan_org_id) {
      setError("Please select a CKAN organization.");
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

      setMessage(
        "Registration successful. You can now log in with your account.",
      );
      window.localStorage.removeItem(SIGNUP_COOLDOWN_KEY);
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
    <section className="mx-auto max-w-md panel">
      <div className="panel-header">
        <img
          src="/arms-logo-v2.svg"
          alt="ARMS Logo"
          className="mb-3 h-12 w-auto"
        />
        <h1 className="text-2xl font-bold">Create Account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Register as student or faculty to manage research projects.
        </p>
      </div>
      <form className="panel-body space-y-3" onSubmit={onSubmit}>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Full name</span>
          <input
            className="control-input"
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
          <input
            className="control-input"
            placeholder="Enter your email address"
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
            placeholder="Create a password"
            type="password"
            required
            value={form.password}
            onChange={(e) =>
              setForm((p) => ({ ...p, password: e.target.value }))
            }
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Role</span>
          <select
            className="control-select"
            value={form.role}
            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
          >
            <option value="student">Student</option>
            <option value="faculty">Faculty</option>
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Research Center</span>
          <select
            className="control-select"
            value={form.ckan_org_id}
            onChange={(e) =>
              setForm((p) => ({ ...p, ckan_org_id: e.target.value }))
            }
            disabled={ckanLoading}
            required
          >
            <option value="">
              {ckanLoading
                ? "Loading Research Centers..."
                : "Select Research Center"}
            </option>
            {ckanOrganizations.map((org) => (
              <option key={org.id} value={org.name || org.id}>
                {org.title || org.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Department</span>
          <select
            className="control-select"
            value={form.ckan_group_id}
            onChange={(e) =>
              setForm((p) => {
                const selectedGroup = ckanGroups.find(
                  (group) =>
                    String(group.name || group.id) === String(e.target.value),
                );
                return {
                  ...p,
                  ckan_group_id: e.target.value,
                  department: selectedGroup?.title || selectedGroup?.name || "",
                };
              })
            }
            disabled={ckanGroupsLoading}
            required
          >
            <option value="">
              {ckanGroupsLoading
                ? "Loading CKAN groups..."
                : "Select department"}
            </option>
            {ckanGroups.map((group) => (
              <option key={group.id} value={group.name || group.id}>
                {group.title || group.name}
              </option>
            ))}
          </select>
        </label>

        {ckanError && (
          <p className="text-sm text-[var(--danger)]">{ckanError}</p>
        )}
        {ckanGroupsError && (
          <p className="text-sm text-[var(--danger)]">{ckanGroupsError}</p>
        )}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        {message && <p className="text-sm text-[var(--success)]">{message}</p>}

        <button
          disabled={loading || cooldownSeconds > 0}
          className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Creating account..."
            : cooldownSeconds > 0
              ? `Retry in ${cooldownSeconds}s`
              : "Register"}
        </button>
      </form>

      <p className="px-6 pb-6 text-sm text-slate-600">
        Already have an account?{" "}
        <Link className="text-blue-700" to="/login">
          Login
        </Link>
      </p>
    </section>
  );
}
