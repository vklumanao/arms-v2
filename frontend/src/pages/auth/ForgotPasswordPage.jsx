import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { isValidEmail } from "@/utils/validation";
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
    <section className="mx-auto max-w-md">
      <Card>
        <CardHeader className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Forgot Password</h1>
          <p className="mt-1 text-sm text-slate-600">
            Enter your email and we will send a reset link.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submit}>
            <Input
              placeholder="Enter your account email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            {message && (
              <p className="text-sm text-[var(--success)]">{message}</p>
            )}
            <Button className="w-full">Send reset link</Button>
          </form>
        </CardContent>
      </Card>

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
