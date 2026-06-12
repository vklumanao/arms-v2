import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, BadgeCheck, MailCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  resendVerificationEmail,
  verifyEmailWithToken,
} from "@/services/authApi";
import { isValidEmail } from "@/utils/validation";

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const { completeAuthPayload } = useAuth();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!token) return;
      setStatus("loading");
      setError("");
      try {
        const payload = await verifyEmailWithToken(token);
        await completeAuthPayload(payload);
        if (!active) return;
        setStatus("success");
        window.setTimeout(() => {
          navigate("/dashboard", { replace: true });
        }, 900);
      } catch (err) {
        if (!active) return;
        setStatus("error");
        setError(
          String(err?.message || "Verification link is invalid or expired."),
        );
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [completeAuthPayload, navigate, token]);

  const onResend = async (e) => {
    e.preventDefault();
    setResendMessage("");
    setError("");
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setResendLoading(true);
    try {
      await resendVerificationEmail(email.trim().toLowerCase());
      setResendMessage(
        "If an unverified account exists, a new verification email has been sent.",
      );
    } catch (err) {
      setError(String(err?.message || "Failed to resend verification email."));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <section>
      <div className="flex h-full items-center justify-center px-4 py-4 sm:px-6 lg:px-8">
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
                      Account Verification
                    </p>
                    <p className="text-xl font-semibold tracking-[0.08em] text-white">
                      CenterPULSE: Platform for University Logging of Scholarly
                      Engagements
                    </p>
                  </div>
                </div>

                <div className="max-w-lg space-y-3">
                  <p className="text-sm font-medium uppercase tracking-[0.22em] text-emerald-100/80">
                    Verify Email
                  </p>
                  <h1 className="text-3xl font-semibold leading-tight text-white sm:text-[2rem]">
                    Confirm your email and continue into the workspace
                    automatically.
                  </h1>
                  <p className="max-w-lg text-sm leading-6 text-slate-200 sm:text-[15px]">
                    Once your email is verified, CenterPULSE activates your
                    account and prepares your sign-in session.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 text-emerald-100">
                      <BadgeCheck size={18} />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      Account Activation
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">
                      Verification confirms your email and unlocks secure access
                      to your account.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 text-emerald-100">
                      <ShieldCheck size={18} />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      New Link Available
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">
                      If the link expires, you can request another verification
                      email without starting over.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/12 bg-black/10 p-4 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/80">
                    Smooth entry
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-100">
                    A successful verification can sign you in automatically and
                    bring you straight to your dashboard.
                  </p>
                </div>
              </div>
            </aside>

            <div className="px-6 py-5 sm:px-8 sm:py-6 lg:h-full lg:overflow-hidden lg:px-8 lg:py-6">
              <div className="lg:flex lg:h-full lg:flex-col">
                <CardHeader className="space-y-3 px-0 pb-4 pt-0 lg:flex-shrink-0">
                  <div className="space-y-1.5">
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900 lg:text-3xl">
                      Verify your email
                    </h2>
                    <p className="text-sm leading-6 text-slate-600">
                      Confirming your email activates your CenterPULSE account
                      and helps you continue securely.
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 px-0">
                  {status === "loading" ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">
                        Verifying your email...
                      </p>
                      <p className="mt-1 leading-6">
                        We&apos;re confirming your account and preparing your
                        session.
                      </p>
                    </div>
                  ) : null}

                  {status === "success" ? (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                        <p className="font-semibold text-emerald-900">
                          Your email has been verified
                        </p>
                        <p className="mt-1 leading-6">
                          Signing you in now and sending you to your dashboard.
                        </p>
                      </div>

                      <Button
                        asChild
                        className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700"
                      >
                        <Link to="/dashboard">
                          Continue to dashboard
                          <ArrowRight size={16} />
                        </Link>
                      </Button>
                    </div>
                  ) : null}

                  {status === "error" ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                      <p className="font-semibold text-rose-900">
                        Verification failed
                      </p>
                      <p className="mt-1 leading-6">{error}</p>
                    </div>
                  ) : null}

                  {status !== "success" ? (
                    <form className="space-y-3" onSubmit={onResend}>
                      <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Resend
                          </p>
                          <p className="text-sm text-slate-600">
                            Need a fresh verification email? Enter the address
                            linked to your account.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor="verify-email"
                            className="text-sm font-medium text-slate-700"
                          >
                            Resend verification email
                          </label>
                          <Input
                            id="verify-email"
                            className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                            placeholder="you@example.com"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </div>

                        <div className="rounded-2xl border border-white bg-white/80 px-4 py-2.5 text-sm text-slate-600">
                          Open the latest verification email you receive to
                          avoid expired links.
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-600">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 text-emerald-600">
                              <MailCheck size={16} />
                            </span>
                            <p className="leading-6">
                              Check spam or junk folders too if the message is
                              delayed.
                            </p>
                          </div>
                        </div>
                      </div>

                      {resendMessage ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                          <p className="font-semibold text-emerald-900">
                            Verification email sent
                          </p>
                          <p className="mt-1 leading-6">{resendMessage}</p>
                        </div>
                      ) : null}

                      {error && status !== "error" ? (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                          <p className="font-semibold text-rose-900">
                            Unable to resend
                          </p>
                          <p className="mt-1 leading-6">{error}</p>
                        </div>
                      ) : null}

                      <Button
                        type="submit"
                        disabled={resendLoading}
                        className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-75"
                      >
                        {resendLoading ? "Sending..." : "Resend email"}
                        <ArrowRight size={16} />
                      </Button>
                    </form>
                  ) : null}
                </CardContent>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
