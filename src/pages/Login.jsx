import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  Car,
  ClipboardList,
  Lock,
  Mail,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import { getProfileForUser } from "../services/profileService";

export default function LoginPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const isLogin = mode === "login";
  const isCreateAccount = mode === "create";
  const isResetPassword = mode === "reset";

  async function routeUserAfterLogin(user) {
    const profile = await getProfileForUser(user);

    if (!profile) {
      navigate("/onboarding");
      return;
    }

    if (profile.role === "admin") {
      navigate("/admin");
      return;
    }

    navigate("/worker");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      if (isResetPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password?mode=worker`,
        });

        if (error) {
          throw error;
        }

        setMessage("Password reset instructions were sent to your email.");
        return;
      }

      if (isCreateAccount) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        if (data?.user && data?.session) {
          await routeUserAfterLogin(data.user);
          return;
        }

        setMessage(
          "Account created. Please check your email to confirm your account before logging in."
        );
        setMode("login");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (!data?.user) {
        throw new Error("Login failed. Please try again.");
      }

      await routeUserAfterLogin(data.user);
    } catch (error) {
      console.error(error);
      setErrorMessage(getFriendlyAuthMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setMessage("");
    setErrorMessage("");
  }

  return (
    <main className="min-h-screen bg-[#eef3f9]">
      <section className="mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-8 inline-flex rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <img
              src="/prosper-logo.svg"
              alt="Prosper Real Estate Logo"
              className="h-24 w-auto object-contain"
            />
          </div>

          <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-600">
            Worker Mileage Portal
          </p>

          <h1 className="mt-3 text-5xl font-black tracking-tight text-slate-950 md:text-6xl">
            Mileage Tracker
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            A clean web dashboard for logging daily mileage, tracking monthly
            totals, selecting vehicles and properties, uploading paper sheets,
            and helping admins review worker entries without duplicate records.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <FeatureCard
              icon={<ClipboardList size={24} />}
              title="Daily Entries"
              text="Workers can submit mileage logs with date, vehicle, property, odometer, and purpose."
            />

            <FeatureCard
              icon={<BarChart3 size={24} />}
              title="Monthly Totals"
              text="Quickly see total miles and total entries for the current month."
            />

            <FeatureCard
              icon={<ShieldCheck size={24} />}
              title="Admin Review"
              text="Admins can review, manage, and follow up on mileage records."
            />
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-950">
                How It Works
              </h2>

              <div className="mt-5 space-y-4">
                <StepItem
                  number="1"
                  text="Worker logs in with email and password."
                />
                <StepItem
                  number="2"
                  text="Worker adds date, vehicle, property, odometer, and purpose."
                />
                <StepItem
                  number="3"
                  text="Admin reviews entries by worker, month, year, or vehicle."
                />
              </div>
            </div>

            <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-black text-blue-200">
                    Dashboard Preview
                  </p>
                  <h2 className="mt-2 text-2xl font-black">This Month</h2>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600">
                  <Car size={24} />
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <PreviewStat label="Total Entries" value="24" />
                <PreviewStat label="Total Miles" value="386.5" />
              </div>

              <div className="mt-6 rounded-3xl bg-white/10 p-5">
                <PreviewRow label="Vehicle" value="Personal" />
                <PreviewRow label="Property" value="LIVEEC" />
                <PreviewRow label="Status" value="Saved" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-7 shadow-xl shadow-slate-200/80 ring-1 ring-slate-200 md:p-9">
          <div className="mb-7 flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
              {isCreateAccount ? <UserPlus size={26} /> : <ShieldCheck size={26} />}
            </div>

            <div>
              <h2 className="text-3xl font-black text-slate-950">
                {isLogin && "Sign In"}
                {isCreateAccount && "Create Account"}
                {isResetPassword && "Reset Password"}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {isLogin &&
                  "Use your email and password to access your mileage dashboard."}
                {isCreateAccount &&
                  "Create an account using your assigned worker email."}
                {isResetPassword &&
                  "Enter your email and we will send password reset instructions."}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Email Address
              </span>

              <div className="flex h-14 items-center rounded-2xl border border-slate-300 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                <Mail size={20} className="text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="worker@example.com"
                  className="w-full border-0 bg-transparent px-3 text-slate-950 outline-none placeholder:text-slate-400"
                />
              </div>
            </label>

            {!isResetPassword && (
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">
                  Password
                </span>

                <div className="flex h-14 items-center rounded-2xl border border-slate-300 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                  <Lock size={20} className="text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength="6"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="w-full border-0 bg-transparent px-3 text-slate-950 outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>
            )}

            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-700">
                {errorMessage}
              </div>
            )}

            {message && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold leading-6 text-emerald-700">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading && "Please wait..."}
              {!loading && isLogin && "Log In"}
              {!loading && isCreateAccount && "Create Account"}
              {!loading && isResetPassword && "Send Reset Link"}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
            {!isResetPassword ? (
              <button
                type="button"
                onClick={() => switchMode("reset")}
                className="font-black text-blue-600 hover:text-blue-700"
              >
                Forgot Password?
              </button>
            ) : (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="font-black text-blue-600 hover:text-blue-700"
              >
                Back To Login
              </button>
            )}

            {isLogin ? (
              <button
                type="button"
                onClick={() => switchMode("create")}
                className="font-black text-slate-700 hover:text-slate-950"
              >
                Create Account
              </button>
            ) : (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="font-black text-slate-700 hover:text-slate-950"
              >
                Already Have Account?
              </button>
            )}
          </div>

          <div className="mt-8 rounded-3xl border border-blue-100 bg-blue-50 p-5">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <ShieldCheck size={24} />
              </div>

              <div>
                <h3 className="font-black text-slate-950">Admin Access</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Admins use the same email and password login. The app checks
                  your role from your Supabase worker profile.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <SmallBadge icon={<CalendarDays size={18} />} text="Monthly Tracking" />
            <SmallBadge icon={<Car size={18} />} text="Vehicle Selection" />
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ icon, title, text }) {
  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-5 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-600">
        {icon}
      </div>

      <h3 className="text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function StepItem({ number, text }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">
        {number}
      </div>

      <p className="text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function PreviewStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-300">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function PreviewRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 py-3 last:border-b-0">
      <p className="text-sm text-slate-300">{label}</p>
      <p className="text-sm font-black text-white">{value}</p>
    </div>
  );
}

function SmallBadge({ icon, text }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-blue-600">{icon}</div>
      <p className="text-sm font-black text-slate-700">{text}</p>
    </div>
  );
}

function getFriendlyAuthMessage(error) {
  const message = String(error?.message || "").toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "Invalid email or password. Please check your login details and try again.";
  }

  if (message.includes("email not confirmed")) {
    return "Please confirm your email before logging in.";
  }

  if (message.includes("password")) {
    return error.message || "Please check your password and try again.";
  }

  if (message.includes("email")) {
    return error.message || "Please check your email address and try again.";
  }

  return error?.message || "Something went wrong. Please try again.";
}