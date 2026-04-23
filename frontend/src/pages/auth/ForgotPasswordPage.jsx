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
    <section className="relative min-h-[calc(100vh-5rem)] overflow-hidden px-4 py-8 sm:px-6 sm:py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1000px_460px_at_8%_0%,rgba(14,165,233,0.2),transparent_58%),radial-gradient(880px_420px_at_92%_18%,rgba(30,58,138,0.16),transparent_55%),radial-gradient(920px_460px_at_50%_100%,rgba(16,185,129,0.14),transparent_60%)]" />

      <div className="relative mx-auto w-full max-w-2xl">
        <Card className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/92 shadow-[0_22px_56px_rgba(15,23,42,0.18)] backdrop-blur">
          <CardHeader className="border-b border-slate-200/70 bg-gradient-to-r from-[#1E3A8A] via-[#0e7490] to-[#0f766e] px-6 pb-6 pt-7 text-white sm:px-8">
            <div className="flex items-center gap-3">
              <img
                src="icon.svg"
                alt="CenterPulse Logo"
                className="h-11 w-auto rounded-xl bg-white/90 p-1.5"
              />
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/95">
                Account Recovery
              </p>
            </div>
            <h1 className="mt-5 font-['Manrope'] text-2xl font-extrabold tracking-tight sm:text-[2rem]">
              Forgot your password?
            </h1>
            <p className="mt-2 max-w-lg text-sm text-cyan-100/95">
              Enter your account email and we will send a secure password reset
              link.
            </p>
          </CardHeader>

          <CardContent className="space-y-5 px-6 py-6 sm:px-8 sm:py-7">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                Use the email linked to your CenterPulse account.
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                Check spam or junk if mail does not appear.
              </div>
            </div>

            <form className="space-y-4" onSubmit={submit}>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                <label
                  htmlFor="forgot-email"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Account email
                </label>
                <Input
                  id="forgot-email"
                  className="h-11 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#1E3A8A]/35"
                  placeholder="you@example.com"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
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
                type="submit"
                disabled={submitting}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-[#1E3A8A] via-[#0e7490] to-[#0f766e] font-semibold text-white shadow-[0_14px_28px_rgba(14,116,144,0.24)] transition hover:from-[#1d4ed8] hover:via-[#0369a1] hover:to-[#0f766e] disabled:cursor-not-allowed disabled:opacity-75"
              >
                {submitting ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

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
