import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function ResetPassword() {
  const [mode, setMode] = useState("request");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function prepareRecoverySession() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        setMode("update");
        return;
      }

      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );

      const type = hashParams.get("type");

      if (type === "recovery") {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          setMode("update");
        }
      }
    }

    prepareRecoverySession();
  }, []);

  async function handleRequestReset(event) {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    setStatusMessage("");
    setErrorMessage("");

    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin + "/reset-password",
      });

      if (error) {
        throw error;
      }

      setMode("sent");
      setStatusMessage(
        "Password reset email sent. Please check your inbox and follow the reset link."
      );
    } catch (error) {
      setErrorMessage(
        error?.message || "Could not send password reset email. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdatePassword(event) {
    event.preventDefault();

    setStatusMessage("");
    setErrorMessage("");

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage("Please enter a password with at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      await supabase.auth.signOut();

      setNewPassword("");
      setConfirmPassword("");
      setMode("updated");
      setStatusMessage("Your password has been updated. You can log in now.");
    } catch (error) {
      setErrorMessage(
        error?.message || "Could not update password. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef5fb] px-5 py-8 text-slate-950">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1fr_460px]">
        <section className="hidden lg:block">
          <div className="mb-8 inline-flex rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <img
              src="/prosper-logo.svg"
              alt="Prosper Real Estate"
              className="h-20 w-auto"
            />
          </div>

          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-black uppercase tracking-[0.35em] text-blue-600">
              Account Recovery
            </p>

            <h1 className="text-5xl font-black leading-tight tracking-tight text-slate-950">
              Reset Your Mileage Tracker Password.
            </h1>

            <p className="mt-5 text-lg font-semibold leading-8 text-slate-600">
              Enter your email to receive a secure password reset link. After updating your password, return to the login page and sign in again.
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-300/30 ring-1 ring-slate-200 sm:p-8">
          <Link
            to="/login"
            className="mb-6 inline-flex items-center gap-2 text-sm font-black text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft size={17} />
            Back To Login
          </Link>

          <div className="mb-7 flex items-start gap-4">
            <div className="rounded-2xl bg-blue-600 p-3 text-white shadow-lg shadow-blue-200">
              <KeyRound size={24} />
            </div>

            <div>
              <h1 className="text-3xl font-black text-slate-950">
                Reset Password
              </h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                {mode === "update"
                  ? "Create a new password for your account."
                  : "Enter your email and we will send a reset link."}
              </p>
            </div>
          </div>

          {statusMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-700">
              <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">
              {errorMessage}
            </div>
          )}

          {mode === "request" && (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-800">
                  Email Address
                </span>
                <div className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                  <Mail size={19} className="text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="worker@example.com"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none"
                    required
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Sending Reset Link..." : "Send Reset Link"}
              </button>
            </form>
          )}

          {mode === "sent" && (
            <div className="space-y-4">
              <p className="rounded-3xl bg-slate-50 p-5 text-sm font-semibold leading-7 text-slate-600 ring-1 ring-slate-200">
                Check your inbox for the reset email. If you do not see it, check spam or junk mail.
              </p>

              <button
                type="button"
                onClick={() => {
                  setMode("request");
                  setStatusMessage("");
                  setErrorMessage("");
                }}
                className="flex h-14 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Send Another Reset Email
              </button>
            </div>
          )}

          {mode === "update" && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-800">
                  New Password
                </span>
                <div className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                  <Lock size={19} className="text-slate-400" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Enter new password"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((current) => !current)}
                    className="text-slate-400 hover:text-slate-700"
                    aria-label="Toggle new password visibility"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-800">
                  Confirm New Password
                </span>
                <div className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                  <Lock size={19} className="text-slate-400" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm new password"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    className="text-slate-400 hover:text-slate-700"
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Updating Password..." : "Update Password"}
              </button>
            </form>
          )}

          {mode === "updated" && (
            <Link
              to="/login"
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
            >
              Return To Login
            </Link>
          )}
        </section>
      </div>
    </main>
  );
}
