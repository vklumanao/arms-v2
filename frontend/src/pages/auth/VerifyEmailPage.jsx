import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  resendVerificationEmail,
  verifyEmailWithToken,
} from "@/services/authApi";
import { isValidEmail } from "@/utils/validation";

export default function VerifyEmailPage() {
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
        await verifyEmailWithToken(token);
        if (active) setStatus("success");
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
  }, [token]);

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
    <section className="mx-auto max-w-md px-4 py-12">
      <Card className="border border-zinc-200 bg-white shadow-sm rounded-2xl">
        <CardHeader className="space-y-2 text-center pb-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Verify your email
          </h1>
          <p className="text-sm text-zinc-500">
            Confirming your email activates your ARMS account.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {status === "loading" && (
            <p className="text-sm text-zinc-600">Verifying your email...</p>
          )}

          {status === "success" && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-900 font-medium">
                Your email has been verified. You can now sign in.
              </p>

              <Button
                asChild
                className="w-full h-11 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white"
              >
                <Link to="/login">Go to login</Link>
              </Button>
            </div>
          )}

          {status === "error" && (
            <p className="text-sm text-zinc-900 font-medium">{error}</p>
          )}

          {status !== "success" && (
            <form className="space-y-4" onSubmit={onResend}>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">
                  Resend verification email
                </label>

                <Input
                  className="rounded-lg border-zinc-200 focus-visible:ring-zinc-400"
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {resendMessage && (
                <p className="text-sm text-zinc-900 font-medium">
                  {resendMessage}
                </p>
              )}

              {error && status !== "error" && (
                <p className="text-sm text-zinc-900 font-medium">{error}</p>
              )}

              <Button
                type="submit"
                disabled={resendLoading}
                className="w-full h-11 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium"
              >
                {resendLoading ? "Sending..." : "Resend email"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
