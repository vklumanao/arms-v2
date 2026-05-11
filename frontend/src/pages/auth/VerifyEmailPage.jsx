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
    <section className="auth-shell">
      <div className="auth-shell-inner">
        <div className="auth-layout">
          <aside className="auth-spotlight">
            <div className="auth-spotlight-inner">
              <div className="auth-spotlight-brand">
                <img
                  src="icon.svg"
                  alt="CenterPulse Logo"
                  className="auth-spotlight-logo"
                />
                <div>
                  <p className="auth-spotlight-kicker">Account Verification</p>
                  <p className="auth-spotlight-name">CenterPULSE</p>
                </div>
              </div>

              <div className="auth-spotlight-copy">
                <h1 className="auth-spotlight-title">
                  Finish verification and enter the workspace automatically.
                </h1>
                <p className="auth-spotlight-text">
                  Once your email is confirmed, CenterPULSE signs you in and
                  sends you straight to your dashboard.
                </p>
              </div>

              <div className="auth-spotlight-points">
                <div className="auth-spotlight-point">
                  <span className="auth-spotlight-point-icon">
                    <BadgeCheck size={16} />
                  </span>
                  <div>
                    <p className="auth-spotlight-point-title">
                      Verification activates your account
                    </p>
                    <p className="auth-spotlight-point-copy">
                      After confirmation, your account is ready for secure
                      access.
                    </p>
                  </div>
                </div>
                <div className="auth-spotlight-point">
                  <span className="auth-spotlight-point-icon">
                    <ShieldCheck size={16} />
                  </span>
                  <div>
                    <p className="auth-spotlight-point-title">
                      Resend is available if the link expires
                    </p>
                    <p className="auth-spotlight-point-copy">
                      You can request a fresh verification email without
                      starting over.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <Card className="auth-card auth-card-wide">
            <CardHeader className="auth-card-hero">
              <div className="auth-card-hero-brand">
                <img
                  src="icon.svg"
                  alt="CenterPulse Logo"
                  className="auth-card-hero-logo"
                />
                <span className="auth-eyebrow">Email Verification</span>
              </div>
              <div className="auth-card-hero-copy">
                <h2 className="auth-title">Verify your email</h2>
                <p className="auth-subtitle">
                  Confirming your email activates your CenterPULSE account and
                  signs you in automatically.
                </p>
              </div>
            </CardHeader>

            <CardContent className="auth-card-body space-y-4">
              {status === "loading" && (
                <div className="auth-status-panel">
                  <p className="auth-status-title">Verifying your email...</p>
                  <p className="auth-status-copy">
                    We&apos;re confirming your account and preparing your
                    session.
                  </p>
                </div>
              )}

              {status === "success" && (
                <div className="space-y-3">
                  <div className="auth-status-panel">
                    <p className="auth-status-title">
                      Your email has been verified.
                    </p>
                    <p className="auth-status-copy">
                      Signing you in now and sending you to your dashboard.
                    </p>
                  </div>

                  <Button asChild className="auth-primary-button w-full">
                    <Link to="/dashboard">
                      Continue to dashboard
                      <ArrowRight size={16} />
                    </Link>
                  </Button>
                </div>
              )}

              {status === "error" && (
                <div className="notice notice-error">
                  <div>
                    <p className="notice-title">Verification failed</p>
                    <p className="notice-text">{error}</p>
                  </div>
                </div>
              )}

              {status !== "success" && (
                <form className="auth-form-panel space-y-4" onSubmit={onResend}>
                  <div className="auth-field-group">
                    <label className="auth-label">
                      Resend verification email
                    </label>

                    <Input
                      className="auth-input"
                      placeholder="you@example.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="auth-tips-grid">
                    <div className="auth-tip">
                      <MailCheck
                        size={14}
                        className="inline-flex mr-2 align-middle"
                      />
                      Check spam or junk if the message is delayed.
                    </div>
                  </div>

                  {resendMessage && (
                    <div className="notice notice-success">
                      <div>
                        <p className="notice-title">Verification email sent</p>
                        <p className="notice-text">{resendMessage}</p>
                      </div>
                    </div>
                  )}

                  {error && status !== "error" && (
                    <div className="notice notice-error">
                      <div>
                        <p className="notice-title">Unable to resend</p>
                        <p className="notice-text">{error}</p>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={resendLoading}
                    className="auth-primary-button w-full"
                  >
                    {resendLoading ? "Sending..." : "Resend email"}
                    <ArrowRight size={16} />
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
