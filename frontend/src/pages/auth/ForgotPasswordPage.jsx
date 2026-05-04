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
                  <p className="auth-spotlight-kicker">Account Recovery</p>
                  <p className="auth-spotlight-name">CenterPulse</p>
                </div>
              </div>

              <div className="auth-spotlight-copy">
                <h1 className="auth-spotlight-title">
                  Recover access without the guesswork.
                </h1>
                <p className="auth-spotlight-text">
                  We&apos;ll send a reset link to the email tied to your account
                  so you can set a new password safely.
                </p>
              </div>

              <div className="auth-spotlight-points">
                <div className="auth-spotlight-point">
                  <span className="auth-spotlight-point-icon">
                    <MailCheck size={16} />
                  </span>
                  <div>
                    <p className="auth-spotlight-point-title">
                      Check your inbox and spam folder
                    </p>
                    <p className="auth-spotlight-point-copy">
                      Verification and reset mail can sometimes land in filtered
                      folders.
                    </p>
                  </div>
                </div>
                <div className="auth-spotlight-point">
                  <span className="auth-spotlight-point-icon">
                    <KeyRound size={16} />
                  </span>
                  <div>
                    <p className="auth-spotlight-point-title">
                      Use the latest reset link only
                    </p>
                    <p className="auth-spotlight-point-copy">
                      Opening the most recent email helps avoid expired or older
                      tokens.
                    </p>
                  </div>
                </div>
              </div>

              <div className="auth-spotlight-stat">
                <p className="auth-spotlight-stat-label">Recovery note</p>
                <p className="auth-spotlight-stat-value">
                  If the account exists, we&apos;ll send a secure reset email to
                  that address.
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
                <span className="auth-eyebrow">Password Reset</span>
              </div>
              <div className="auth-card-hero-copy">
                <h2 className="auth-title">Forgot your password?</h2>
                <p className="auth-subtitle">
                  Enter your account email and we&apos;ll send a secure reset
                  link.
                </p>
              </div>
            </CardHeader>

            <CardContent className="auth-card-body space-y-5">
              <div className="auth-tips-grid auth-tips-grid-2">
                <div className="auth-tip">
                  Use the email linked to your CenterPulse account.
                </div>
                <div className="auth-tip">
                  Check spam or junk if mail does not appear.
                </div>
              </div>

              <form className="auth-form-stack" onSubmit={submit}>
                <div className="auth-panel">
                  <label htmlFor="forgot-email" className="auth-label">
                    Account email
                  </label>
                  <Input
                    id="forgot-email"
                    className="auth-input"
                    placeholder="you@example.com"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {error ? (
                  <div className="notice notice-error">
                    <div>
                      <p className="notice-title">Reset email not sent</p>
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
                  {submitting ? "Sending..." : "Send reset link"}
                  <ArrowRight size={16} />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
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
