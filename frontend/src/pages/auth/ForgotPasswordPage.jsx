import { useState } from "react";
import { ArrowRight, KeyRound, MailCheck } from "lucide-react";
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
                  <p className="auth-spotlight-kicker">Recover account</p>
                  <p className="auth-spotlight-name">CenterPULSE</p>
                </div>
              </div>

              <div className="auth-spotlight-copy">
                <h1 className="auth-spotlight-title">Reset your password.</h1>
                <p className="auth-spotlight-text">We&apos;ll send a link to your email.</p>
              </div>

              <div className="auth-spotlight-points">
                <div className="auth-spotlight-point">
                  <span className="auth-spotlight-point-icon">
                    <MailCheck size={16} />
                  </span>
                  <div>
                    <p className="auth-spotlight-point-title">
                      Check your inbox
                    </p>
                    <p className="auth-spotlight-point-copy">
                      Also check spam or junk.
                    </p>
                  </div>
                </div>
                <div className="auth-spotlight-point">
                  <span className="auth-spotlight-point-icon">
                    <KeyRound size={16} />
                  </span>
                  <div>
                    <p className="auth-spotlight-point-title">
                      Use the newest link
                    </p>
                    <p className="auth-spotlight-point-copy">
                      Older links may no longer work.
                    </p>
                  </div>
                </div>
              </div>

              <div className="auth-spotlight-stat">
                <p className="auth-spotlight-stat-label">Note</p>
                <p className="auth-spotlight-stat-value">
                  If the account exists, we&apos;ll send a reset email.
                </p>
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
                <span className="auth-eyebrow">Reset password</span>
              </div>
              <div className="auth-card-hero-copy">
                <h2 className="auth-title">Reset password</h2>
                <p className="auth-subtitle">Enter your email and we&apos;ll send a link.</p>
              </div>
            </CardHeader>

            <CardContent className="auth-card-body space-y-5">
              <div className="auth-tips-grid auth-tips-grid-2">
                <div className="auth-tip">Use the email on your account.</div>
                <div className="auth-tip">Check spam or junk if needed.</div>
              </div>

              <form className="auth-form-stack" onSubmit={submit}>
                <div className="auth-panel">
                  <label htmlFor="forgot-email" className="auth-label">
                    Email address
                  </label>
                  <Input
                    id="forgot-email"
                    className="auth-input"
                    placeholder="Email address"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {error ? (
                  <div className="notice notice-error">
                    <div>
                      <p className="notice-title">Couldn&apos;t send link</p>
                      <p className="notice-text">{error}</p>
                    </div>
                  </div>
                ) : null}

                {message ? (
                  <div className="notice notice-success">
                    <div>
                      <p className="notice-title">Check your email</p>
                      <p className="notice-text">{message}</p>
                    </div>
                  </div>
                ) : null}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="auth-primary-button w-full disabled:cursor-not-allowed disabled:opacity-75"
                >
                  {submitting ? "Sending..." : "Send link"}
                  <ArrowRight size={16} />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
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
