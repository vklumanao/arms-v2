import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { validatePasswordStrength } from "@/shared/utils/validation";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmChange, setConfirmChange] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e, confirmed = false) => {
    e?.preventDefault?.();
    setMessage("");
    setError("");
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!resetToken) {
      setError("Reset token is missing. Please use the full reset link.");
      return;
    }
    if (!confirmed) {
      setConfirmChange(true);
      return;
    }
    setSubmitting(true);

    try {
      await resetPassword({ token: resetToken, password });
    } catch (updateError) {
      setError(updateError?.message || "Unable to update password.");
      setSubmitting(false);
      return;
    }

    setMessage("Password updated. Redirecting to login...");
    setSubmitting(false);
    setConfirmChange(false);
    setTimeout(() => navigate("/login"), 1200);
  };

  return (
    <section className="mx-auto max-w-md panel">
      <div className="panel-header">
        <img
          src="/arms-logo-v2.svg"
          alt="ARMS Logo"
          className="mb-3 h-12 w-auto"
        />
        <h1 className="text-2xl font-bold">Reset Password</h1>
        <p className="mt-1 text-sm text-slate-600">
          Set a new password for your account.
        </p>
      </div>
      <form className="panel-body space-y-3" onSubmit={submit}>
        <input
          className="control-input"
          placeholder="Enter your new password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          className="control-input"
          placeholder="Confirm your new password"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        {message && <p className="text-sm text-[var(--success)]">{message}</p>}
        <button className="btn btn-primary w-full">Update password</button>
      </form>

      <ConfirmActionModal
        open={confirmChange}
        title="Confirm Password Update"
        message="Update your password now?"
        confirmLabel="Update Password"
        loading={submitting}
        onCancel={() => setConfirmChange(false)}
        onConfirm={async () => submit(null, true)}
      />
    </section>
  );
}

