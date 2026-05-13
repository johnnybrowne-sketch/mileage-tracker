import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignup(event) {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    setStatusMessage("");
    setErrorMessage("");

    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage("Please enter a password with at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: window.location.origin + "/login",
          data: {
            full_name: cleanName,
          },
        },
      });

      if (error) {
        throw error;
      }

      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      setStatusMessage(
        "Account created. You can return to login now. If email confirmation is enabled, please check your inbox first."
      );
    } catch (error) {
      setErrorMessage(error?.message || "Could not create account. Please try again.");
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
              Worker Mileage Portal
            </p>

            <h1 className="text-5xl font-black leading-tight tracking-tight text-slate-950">
              Create Your Mileage Tracker Account.
            </h1>

            <p className="mt-5 text-lg font-semibold leading-8 text-slate-600">
              Use the email address connected to your worker profile. If your previous account was deleted, you can create a new account using the same email.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <InfoCard title="Daily Mileage" text="Submit trips with vehicle, property, odometer, and purpose." />
              <InfoCard title="Paper Uploads" text="Upload paper mileage sheets for admin review." />
              <InfoCard title="Admin Support" text="Message admin when you need corrections or help." />
            </div>
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
              <UserPlus size={24} />
            </div>

            <div>
              <h1 className="text-3xl font-black text-slate-950">
                Create Account
              </h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                Sign up with your worker email address.
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

          <form onSubmit={handleSignup} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-800">
                Full Name
              </span>
              <div className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                <ShieldCheck size={19} className="text-slate-400" />
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your full name"
                  className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none"
                />
              </div>
            </label>

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

            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-800">
                Password
              </span>
              <div className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                <Lock size={19} className="text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a password"
                  className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-800">
                Confirm Password
              </span>
              <div className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                <Lock size={19} className="text-slate-400" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm your password"
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
              className="mt-2 flex h-14 w-full items-center justify-center rounded-2xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm font-semibold text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="font-black text-blue-600 hover:text-blue-700">
              Log In
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ title, text }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-black text-slate-950">{title}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
        {text}
      </p>
    </div>
  );
}
