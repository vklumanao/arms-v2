import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/components/providers/AuthProvider";
import { validatePasswordStrength } from "@/utils/validation";
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
    <section className="mx-auto max-w-md px-4 py-10">
      <Card className="border border-zinc-200 bg-white shadow-sm rounded-2xl">
        <CardHeader className="text-center space-y-3 pb-2">
          <img
            src="icon.svg"
            alt="ARMS Logo"
            className="mx-auto h-10 w-auto opacity-90"
          />
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Reset Password
          </h1>
          <p className="text-sm text-zinc-500">
            Set a new password for your account.
          </p>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <Input
              className="rounded-lg border-zinc-200 focus-visible:ring-zinc-400"
              placeholder="Enter your new password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Input
              className="rounded-lg border-zinc-200 focus-visible:ring-zinc-400"
              placeholder="Confirm your new password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            {error && (
              <p className="text-sm text-zinc-900 font-medium">{error}</p>
            )}

            {message && (
              <p className="text-sm text-zinc-900 font-medium">{message}</p>
            )}

            <Button className="w-full h-11 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium">
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>

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
