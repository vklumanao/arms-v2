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
  const passwordValue = password || "";
  const passwordChecks = {
    length: passwordValue.length >= 8,
    uppercase: /[A-Z]/.test(passwordValue),
    lowercase: /[a-z]/.test(passwordValue),
    number: /\d/.test(passwordValue),
  };
  const passwordsMatch = confirmPassword !== "" && confirmPassword === password;

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
    <section className="relative min-h-[calc(100vh-5rem)] overflow-hidden px-4 py-8 sm:px-6 sm:py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_500px_at_6%_0%,rgba(14,165,233,0.24),transparent_60%),radial-gradient(900px_460px_at_94%_16%,rgba(14,116,144,0.18),transparent_55%),radial-gradient(980px_520px_at_50%_100%,rgba(30,58,138,0.16),transparent_58%)]" />

      <div className="relative mx-auto w-full max-w-3xl">
        <Card className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-[0_22px_56px_rgba(15,23,42,0.18)] backdrop-blur">
          <CardHeader className="border-b border-slate-200/70 bg-gradient-to-r from-[#0f766e] via-[#1E3A8A] to-[#0e7490] px-6 pb-6 pt-7 text-white sm:px-8">
            <div className="flex items-center gap-3">
              <img
                src="icon.svg"
                alt="CenterPulse Logo"
                className="h-11 w-auto rounded-xl bg-white/90 p-1.5"
              />
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/95">
                Security Reset
              </p>
            </div>
            <h1 className="mt-5 font-['Manrope'] text-2xl font-extrabold tracking-tight sm:text-[2rem]">
              Reset access to your account
            </h1>
            <p className="mt-2 max-w-xl text-sm text-cyan-100/95">
              Choose a new password below. We will verify your token and then
              redirect you to login.
            </p>
          </CardHeader>

          <CardContent className="space-y-5 px-6 py-6 sm:px-8 sm:py-7">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                8+ characters minimum
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                Include uppercase and lowercase
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                Add at least one number
              </div>
            </div>

            <form className="space-y-4" onSubmit={submit}>
              {!resetToken ? (
                <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  Reset token is missing. Please open the full password reset
                  link.
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                <div className="space-y-2">
                  <label
                    htmlFor="new-password"
                    className="text-sm font-semibold text-slate-700"
                  >
                    New password
                  </label>
                  <Input
                    id="new-password"
                    className="h-11 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#1E3A8A]/35"
                    placeholder="Enter your new password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {passwordValue ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <span
                      className={`rounded-lg border px-2 py-1.5 ${
                        passwordChecks.length
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      8+ chars
                    </span>
                    <span
                      className={`rounded-lg border px-2 py-1.5 ${
                        passwordChecks.uppercase
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      Uppercase
                    </span>
                    <span
                      className={`rounded-lg border px-2 py-1.5 ${
                        passwordChecks.lowercase
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      Lowercase
                    </span>
                    <span
                      className={`rounded-lg border px-2 py-1.5 ${
                        passwordChecks.number
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      Number
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                <div className="space-y-2">
                  <label
                    htmlFor="confirm-password"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Confirm new password
                  </label>
                  <Input
                    id="confirm-password"
                    className="h-11 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#1E3A8A]/35"
                    placeholder="Re-enter your new password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                {confirmPassword ? (
                  <p
                    className={`mt-2 text-xs font-semibold ${
                      passwordsMatch ? "text-emerald-700" : "text-rose-600"
                    }`}
                  >
                    {passwordsMatch
                      ? "Passwords match."
                      : "Passwords do not match yet."}
                  </p>
                ) : null}
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
                className="h-11 w-full rounded-xl bg-gradient-to-r from-[#1E3A8A] via-[#0f766e] to-[#0e7490] font-semibold text-white shadow-[0_14px_28px_rgba(14,116,144,0.24)] transition hover:from-[#1d4ed8] hover:via-[#0f766e] hover:to-[#0369a1] disabled:cursor-not-allowed disabled:opacity-75"
              >
                {submitting ? "Updating..." : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

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
