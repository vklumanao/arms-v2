import { useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { isValidEmail } from "@/shared/utils/validation";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e, confirmed = false, targetEmail = "") => {
    e?.preventDefault?.();
    setMessage("");
    setError("");
    const normalizedEmail = (targetEmail || email).trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!confirmed) {
      setConfirmEmail(normalizedEmail);
      return;
    }
    setSubmitting(true);

    try {
      await requestPasswordReset(normalizedEmail);
    } catch (requestError) {
      setError(requestError?.message || "Unable to send reset link.");
      setSubmitting(false);
      return;
    }

    setMessage(
      "Password reset link sent if account exists. In local mode, check backend logs for the reset URL.",
    );
    setSubmitting(false);
    setConfirmEmail("");
  };

  return (
    <section className="mx-auto max-w-md panel">
      <div className="panel-header">
        <img
          src="/arms-logo-v2.svg"
          alt="ARMS Logo"
          className="mb-3 h-12 w-auto"
        />
        <h1 className="text-2xl font-bold">Forgot Password</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter your email and we will send a reset link.
        </p>
      </div>
      <form className="panel-body space-y-3" onSubmit={submit}>
        <input
          className="control-input"
          placeholder="Enter your account email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        {message && <p className="text-sm text-[var(--success)]">{message}</p>}
        <button className="btn btn-primary w-full">Send reset link</button>
      </form>

      <ConfirmActionModal
        open={Boolean(confirmEmail)}
        title="Confirm Password Reset"
        message={confirmEmail ? `Send reset link to ${confirmEmail}?` : ""}
        confirmLabel="Send Reset Link"
        loading={submitting}
        onCancel={() => setConfirmEmail("")}
        onConfirm={async () => submit(null, true, confirmEmail)}
      />
    </section>
  );
}

