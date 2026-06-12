import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, KeyRound, MailCheck, ShieldCheck } from "lucide-react";
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
    <section>
      <div className="flex h-full items-center justify-center px-4 py-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-6xl lg:max-h-full lg:overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
            <aside className="relative overflow-hidden border-b border-slate-200 bg-[url('/images/bg.jpeg')] bg-cover bg-center px-6 py-6 text-white sm:px-8 sm:py-7 lg:border-b-0 lg:border-r lg:border-white/10 lg:px-8 lg:py-8">
              <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(15,23,42,0.9)_0%,rgba(19,78,74,0.82)_48%,rgba(6,78,59,0.72)_100%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_20%_80%,rgba(52,211,153,0.18),transparent_26%)]" />
              <div className="absolute inset-0 bg-black/15" />

              <div className="relative flex h-full flex-col justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-50/90">
                      Account Recovery
                    </p>
                    <p className="text-xl font-semibold tracking-[0.08em] text-white drop-shadow-[0_2px_10px_rgba(15,23,42,0.35)]">
                      CenterPULSE: Platform for University Logging of Scholarly
                      Engagements
                    </p>
                  </div>
                </div>

                <div className="max-w-lg space-y-3">
                  <p className="text-sm font-medium uppercase tracking-[0.22em] text-emerald-50/90">
                    Forgot Password
                  </p>
                  <h1 className="text-3xl font-semibold leading-tight text-white drop-shadow-[0_4px_18px_rgba(15,23,42,0.45)] sm:text-[2rem]">
                    Request a reset link and recover access to your workspace.
                  </h1>
                  <p className="max-w-lg text-sm leading-6 text-slate-100 sm:text-[15px]">
                    Enter the email address tied to your account and CenterPULSE
                    will prepare a secure password reset link.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/18 bg-white/12 p-4 backdrop-blur-md">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/14 text-emerald-50">
                      <MailCheck size={18} />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      Check Your Inbox
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-100">
                      Look in spam or junk too if the reset email does not show
                      up right away.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/18 bg-white/12 p-4 backdrop-blur-md">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/14 text-emerald-50">
                      <KeyRound size={18} />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      Use the Latest Link
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-100">
                      Older reset emails may expire, so open the newest message
                      you receive.
                    </p>
                  </div>
                </div>
              </div>
            </aside>

            <div className="flex items-center px-6 py-5 sm:px-8 sm:py-6 lg:px-8 lg:py-8">
              <div className="mx-auto w-full max-w-md">
                <CardHeader className="space-y-3 px-0 pb-4 pt-0">
                  <div className="space-y-1.5">
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900 lg:text-3xl">
                      Reset password
                    </h2>
                    <p className="text-sm leading-6 text-slate-600">
                      Enter your email address and we&apos;ll send a password
                      reset link if the account is available.
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 px-0">
                  {error ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                      <p className="font-semibold text-rose-900">
                        Couldn&apos;t send link
                      </p>
                      <p className="mt-1 leading-6">{error}</p>
                    </div>
                  ) : null}

                  {message ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      <p className="font-semibold text-emerald-900">
                        Check your email
                      </p>
                      <p className="mt-1 leading-6">{message}</p>
                    </div>
                  ) : null}

                  <form className="space-y-3" onSubmit={submit}>
                    <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Recovery
                        </p>
                        <p className="text-sm text-slate-600">
                          Use the email address linked to your CenterPULSE
                          account.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor="forgot-email"
                          className="text-sm font-medium text-slate-700"
                        >
                          Email address
                        </label>
                        <Input
                          id="forgot-email"
                          className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                          placeholder="Email address"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>

                      <div className="rounded-2xl border border-white bg-white/80 px-4 py-2.5 text-sm text-slate-600">
                        We&apos;ll send instructions to your inbox if the email
                        matches an account in the system.
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-600">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 text-emerald-600">
                            <ShieldCheck size={16} />
                          </span>
                          <p className="leading-6">
                            For security, this page won&apos;t confirm whether a
                            specific email is registered.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting}
                      className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-75"
                    >
                      {submitting ? "Sending..." : "Send link"}
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
        open={Boolean(confirmEmail)}
        title="Send reset link"
        message={confirmEmail ? `Send a reset link to ${confirmEmail}?` : ""}
        confirmLabel="Send link"
        loading={submitting}
        onCancel={() => setConfirmEmail("")}
        onConfirm={async () => submit(null, true, confirmEmail)}
      />
    </section>
  );
}
