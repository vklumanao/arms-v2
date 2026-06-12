import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  X,
} from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    <section>
      <div className="flex h-full items-center justify-center sm:px-5 lg:px-7">
        <Card className="w-full max-w-6xl lg:max-h-full lg:overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
            <aside className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(145deg,#0f172a_0%,#134e4a_48%,#ecfdf5_160%)] px-6 py-6 text-white sm:px-8 sm:py-7 lg:border-b-0 lg:border-r lg:border-white/10 lg:px-8 lg:py-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_20%_80%,rgba(52,211,153,0.22),transparent_26%)]" />

              <div className="relative flex h-full flex-col justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center bg-white/14">
                    <img
                      src="icon.svg"
                      alt="CenterPulse Logo"
                      className="h-24 w-24 object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-100/80">
                      Account Recovery
                    </p>
                    <p className="text-xl font-semibold tracking-[0.08em] text-white">
                      CenterPULSE: Platform for University Logging of Scholarly
                      Engagements
                    </p>
                  </div>
                </div>

                <div className="max-w-lg space-y-3">
                  <p className="text-sm font-medium uppercase tracking-[0.22em] text-emerald-100/80">
                    Reset Password
                  </p>
                  <h1 className="text-3xl font-semibold leading-tight text-white sm:text-[2rem]">
                    Set a secure new password and get back into your workspace.
                  </h1>
                  <p className="max-w-lg text-sm leading-6 text-slate-200 sm:text-[15px]">
                    Choose a fresh password that meets the security rules so
                    your account stays protected and ready for sign-in.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 text-emerald-100">
                      <ShieldCheck size={18} />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      Verified Reset Link
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">
                      Open the full email link so CenterPULSE can validate your
                      password reset request.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 text-emerald-100">
                      <KeyRound size={18} />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      Fresh Credentials
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">
                      Avoid reusing an older password and save one you can
                      safely remember.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/12 bg-black/10 p-4 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/80">
                    Ready to continue
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-100">
                    Once saved, you&apos;ll be redirected to login so you can
                    sign in with your updated password.
                  </p>
                </div>
              </div>
            </aside>

            <div className="flex items-center px-6 py-5 sm:px-8 sm:py-6 lg:px-8 lg:py-8">
              <div className="mx-auto w-full max-w-md">
                <CardHeader className="space-y-3 px-0 pb-4 pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                          Reset Password
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900 lg:text-3xl">
                      Set a new password
                    </h2>
                    <p className="text-sm leading-6 text-slate-600">
                      Pick a secure password for your account and save the
                      change once you&apos;re ready.
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 px-0">
                  {!resetToken ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                      <p className="font-semibold text-rose-900">
                        Reset link missing
                      </p>
                      <p className="mt-1 leading-6">
                        Please open the full reset link from your email.
                      </p>
                    </div>
                  ) : null}

                  {error ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                      <p className="font-semibold text-rose-900">
                        Couldn&apos;t update password
                      </p>
                      <p className="mt-1 leading-6">{error}</p>
                    </div>
                  ) : null}

                  {message ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      <p className="font-semibold text-emerald-900">
                        Password updated
                      </p>
                      <p className="mt-1 leading-6">{message}</p>
                    </div>
                  ) : null}

                  <form className="space-y-3" onSubmit={submit}>
                    <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Security
                        </p>
                        <p className="text-sm text-slate-600">
                          Your password must meet the account protection rules.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor="new-password"
                          className="text-sm font-medium text-slate-700"
                        >
                          New password
                        </label>
                        <div className="relative">
                          <Input
                            id="new-password"
                            className="h-12 rounded-xl border-slate-300 bg-white pr-12 text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                            placeholder="New password"
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
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

                      <div className="space-y-2">
                        <label
                          htmlFor="confirm-password"
                          className="text-sm font-medium text-slate-700"
                        >
                          Confirm password
                        </label>
                        <div className="relative">
                          <Input
                            id="confirm-password"
                            className="h-12 rounded-xl border-slate-300 bg-white pr-12 text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                            placeholder="Confirm password"
                            type={showConfirmPassword ? "text" : "password"}
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            aria-label={
                              showConfirmPassword
                                ? "Hide confirm password"
                                : "Show confirm password"
                            }
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

                      {confirmPassword ? (
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

                      <div className="rounded-2xl border border-white bg-white/80 px-4 py-2.5 text-sm text-slate-600">
                        Use a password you have not used recently for this
                        account.
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting || !resetToken}
                      className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-75"
                    >
                      {submitting ? "Updating..." : "Save password"}
                      <ArrowRight size={16} />
                    </Button>
                  </form>
                </CardContent>

                <div className="mt-4 border-t border-slate-200 pt-4 text-center text-sm text-slate-600">
                  Remembered your password?{" "}
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

      <ConfirmActionModal
        open={confirmChange}
        title="Save password"
        message="Save this new password now?"
        confirmLabel="Save password"
        loading={submitting}
        onCancel={() => setConfirmChange(false)}
        onConfirm={async () => submit(null, true)}
      />
    </section>
  );
}
