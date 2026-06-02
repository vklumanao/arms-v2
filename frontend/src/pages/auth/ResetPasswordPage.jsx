import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
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
                  <p className="auth-spotlight-kicker">Reset password</p>
                  <p className="auth-spotlight-name">CenterPULSE</p>
                </div>
              </div>

              <div className="auth-spotlight-copy">
                <h1 className="auth-spotlight-title">Set a new password.</h1>
                <p className="auth-spotlight-text">Use one you can remember.</p>
              </div>

              <div className="auth-spotlight-points">
                <div className="auth-spotlight-point">
                  <span className="auth-spotlight-point-icon">
                    <ShieldCheck size={16} />
                  </span>
                  <div>
                    <p className="auth-spotlight-point-title">
                      The link is checked automatically
                    </p>
                    <p className="auth-spotlight-point-copy">
                      Open the full link from your email.
                    </p>
                  </div>
                </div>
                <div className="auth-spotlight-point">
                  <span className="auth-spotlight-point-icon">
                    <KeyRound size={16} />
                  </span>
                  <div>
                    <p className="auth-spotlight-point-title">
                      Don&apos;t reuse an old password
                    </p>
                    <p className="auth-spotlight-point-copy">
                      A fresh password is better for this account.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <Card className="auth-card auth-card-wide">
            <CardHeader className="auth-card-hero is-alt">
              <div className="auth-card-hero-brand">
                <img
                  src="icon.svg"
                  alt="CenterPulse Logo"
                  className="auth-card-hero-logo"
                />
                <span className="auth-eyebrow">Reset password</span>
              </div>
              <div className="auth-card-hero-copy">
                <h2 className="auth-title">Set a new password</h2>
                <p className="auth-subtitle">Pick a new password and save it.</p>
              </div>
            </CardHeader>

            <CardContent className="auth-card-body space-y-5">
              <div className="auth-tips-grid auth-tips-grid-3">
                <div className="auth-tip">8+ characters</div>
                <div className="auth-tip">Uppercase and lowercase</div>
                <div className="auth-tip">At least one number</div>
              </div>

              <form className="auth-form-stack" onSubmit={submit}>
                {!resetToken ? (
                  <div className="notice notice-error">
                    <div>
                      <p className="notice-title">Reset link missing</p>
                      <p className="notice-text">Please open the full reset link.</p>
                    </div>
                  </div>
                ) : null}

                <div className="auth-panel">
                  <div className="auth-field-group">
                    <label htmlFor="new-password" className="auth-label">
                      New password
                    </label>
                    <Input
                      id="new-password"
                      className="auth-input"
                      placeholder="New password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  {passwordValue ? (
                    <div className="auth-password-grid mt-3">
                      <span
                        className={`auth-password-chip ${passwordChecks.length ? "is-valid" : ""}`}
                      >
                        8+ chars
                      </span>
                      <span
                        className={`auth-password-chip ${passwordChecks.uppercase ? "is-valid" : ""}`}
                      >
                        Uppercase
                      </span>
                      <span
                        className={`auth-password-chip ${passwordChecks.lowercase ? "is-valid" : ""}`}
                      >
                        Lowercase
                      </span>
                      <span
                        className={`auth-password-chip ${passwordChecks.number ? "is-valid" : ""}`}
                      >
                        Number
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="auth-panel">
                  <div className="auth-field-group">
                    <label htmlFor="confirm-password" className="auth-label">
                      Confirm password
                    </label>
                    <Input
                      id="confirm-password"
                      className="auth-input"
                      placeholder="Confirm password"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  {confirmPassword ? (
                    <p
                      className={`auth-password-hint ${passwordsMatch ? "is-valid" : "is-invalid"}`}
                    >
                      {passwordsMatch ? "Passwords match." : "Passwords do not match."}
                    </p>
                  ) : null}
                </div>

                {error ? (
                  <div className="notice notice-error">
                    <div>
                      <p className="notice-title">Couldn&apos;t update password</p>
                      <p className="notice-text">{error}</p>
                    </div>
                  </div>
                ) : null}

                {message ? (
                  <div className="notice notice-success">
                    <div>
                      <p className="notice-title">Password updated</p>
                      <p className="notice-text">{message}</p>
                    </div>
                  </div>
                ) : null}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="auth-primary-button w-full disabled:cursor-not-allowed disabled:opacity-75"
                >
                  {submitting ? "Updating..." : "Save password"}
                  <ArrowRight size={16} />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
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
