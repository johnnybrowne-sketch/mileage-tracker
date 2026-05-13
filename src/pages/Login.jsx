import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Car,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Route,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const logoSrc = "/prosper-logo.svg";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(event) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (!cleanEmail || !password) {
        throw new Error("Please enter your email and password.");
      }

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (authError) throw authError;

      const authUser = authData?.user;

      if (!authUser?.id) {
        throw new Error("Unable to verify your login session.");
      }

      let profile = null;

      const { data: profileByAuthId, error: authProfileError } = await supabase
        .from("worker_profiles")
        .select("id, full_name, email, role, auth_user_id")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();

      if (authProfileError) {
        throw authProfileError;
      }

      profile = profileByAuthId;

      if (!profile) {
        const { data: profileByEmail, error: emailProfileError } =
          await supabase
            .from("worker_profiles")
            .select("id, full_name, email, role, auth_user_id")
            .eq("email", cleanEmail)
            .maybeSingle();

        if (emailProfileError) {
          throw emailProfileError;
        }

        profile = profileByEmail;
      }

      if (!profile) {
        await supabase.auth.signOut();
        throw new Error(
          "Your login worked, but no worker profile was found. Please contact admin."
        );
      }

      const role = String(profile.role || "").toLowerCase();

      if (role === "admin") {
        navigate("/admin", { replace: true });
        return;
      }

      navigate("/worker", { replace: true });
    } catch (error) {
      console.error(error);
      setErrorMessage(error?.message || "Unable to log in.");
    } finally {
      setLoading(false);
    }
  }

  function openCentralWisconsinMap() {
    const mapsUrl =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent("Central Wisconsin rental property routes");

    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#eef3f9] text-slate-950">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-8rem] top-[-8rem] h-96 w-96 rounded-full bg-[#2f8fc8]/20 blur-3xl" />
        <div className="absolute right-[-8rem] top-20 h-96 w-96 rounded-full bg-[#6faa36]/15 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-300/20 blur-3xl" />
      </div>

      <section className="relative mx-auto grid min-h-screen w-full max-w-[1620px] gap-8 px-6 py-8 lg:grid-cols-[1.25fr_0.75fr] lg:px-10 xl:px-12">
        <div className="flex flex-col justify-center">
          <div className="max-w-5xl">
            <div className="inline-flex rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <img
                src={logoSrc}
                alt="Prosper Real Estate"
                className="h-20 w-auto"
              />
            </div>

            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-blue-700 shadow-sm">
              <Sparkles size={14} />
              Worker Mileage Portal
            </div>

            <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.95] tracking-tight text-slate-950 md:text-6xl xl:text-7xl">
              Mileage Tracking Built For Field Work.
            </h1>

            <p className="mt-6 max-w-3xl text-base font-medium leading-8 text-slate-600 md:text-lg">
              Log daily mileage, select vehicles and properties, upload paper
              forms, message admin, review history, and keep records organized
              from one secure live dashboard.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <FeatureCard
                icon={<Car size={22} />}
                title="Daily Mileage"
                text="Submit trips with date, vehicle, property, odometer, miles, and purpose."
              />

              <FeatureCard
                icon={<Upload size={22} />}
                title="Paper Uploads"
                text="Upload photos or PDFs so admin can review them manually or with AI."
              />

              <FeatureCard
                icon={<ClipboardCheck size={22} />}
                title="Admin Review"
                text="Admins can review, correct, approve, and follow up on entries."
              />
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-black uppercase tracking-wide text-blue-700">
                  What To Expect
                </p>

                <div className="mt-5 space-y-4">
                  <StepItem
                    number="1"
                    title="Log Trips"
                    text="Workers add mileage entries with property, purpose, and odometer readings."
                  />

                  <StepItem
                    number="2"
                    title="Upload Forms"
                    text="Paper sheets and receipts can be uploaded for admin review."
                  />

                  <StepItem
                    number="3"
                    title="Live Admin Support"
                    text="Messages and mileage updates sync between worker and admin dashboards."
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl">
                <div className="bg-[radial-gradient(circle_at_15%_10%,rgba(47,143,200,0.45),transparent_25rem),radial-gradient(circle_at_90%_0%,rgba(111,170,54,0.28),transparent_22rem),linear-gradient(135deg,#071527,#0b1f3a_48%,#123b56)] p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-blue-200">
                        Dashboard Preview
                      </p>
                      <h2 className="mt-2 text-3xl font-black">
                        Private After Sign-In
                      </h2>
                    </div>

                    <div className="rounded-2xl bg-[#2f8fc8] p-3 text-white">
                      <BarChart3 size={26} />
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <PreviewMetric label="Total Entries" value="Secure" />
                    <PreviewMetric label="Total Miles" value="Private" />
                  </div>

                  <div className="mt-5 rounded-3xl bg-white/10 p-5 ring-1 ring-white/10">
                    <PreviewRow label="Vehicle" value="Assigned Vehicle" />
                    <PreviewRow label="Property" value="Selected Property" />
                    <PreviewRow label="Status" value="Live Sync" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <InfoPill
                icon={<Building2 size={18} />}
                title="Property Based"
                text="Designed around Prosper property codes."
              />

              <InfoPill
                icon={<MessageCircle size={18} />}
                title="Admin Chat"
                text="Ask questions without leaving the portal."
              />

              <InfoPill
                icon={<FileText size={18} />}
                title="CSV Reports"
                text="Download monthly spreadsheet-ready records."
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <div className="rounded-[2.25rem] border border-slate-200 bg-white p-7 shadow-2xl shadow-slate-200/80 xl:p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-[#2f8fc8] p-3 text-white shadow-lg shadow-blue-200">
                <ShieldCheck size={28} />
              </div>

              <div>
                <h2 className="text-3xl font-black text-slate-950">
                  Sign In
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Access mileage entries, paper uploads, messages, route tools,
                  and admin review.
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="mt-7 space-y-5">
              <FormField label="Email Address">
                <div className="flex h-14 items-center rounded-2xl border border-slate-300 bg-white px-4 transition focus-within:border-[#2f8fc8] focus-within:ring-4 focus-within:ring-blue-100">
                  <Mail size={18} className="text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="worker@example.com"
                    autoComplete="email"
                    className="w-full border-0 bg-transparent px-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
              </FormField>

              <FormField label="Password">
                <div className="flex h-14 items-center rounded-2xl border border-slate-300 bg-white px-4 transition focus-within:border-[#2f8fc8] focus-within:ring-4 focus-within:ring-blue-100">
                  <Lock size={18} className="text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full border-0 bg-transparent px-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
              </FormField>

              {errorMessage && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-700">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#2f8fc8] px-6 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-[#1f6f9f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing In..." : "Log In"}
                {!loading && <ArrowRight size={18} />}
              </button>

              <div className="flex items-center justify-between gap-4 text-sm font-bold">
                <Link
                  to="/reset-password"
                  className="text-blue-700 transition hover:text-blue-900"
                >
                  Forgot Password?
                </Link>

                <Link
                  to="/signup"
                  className="text-slate-600 transition hover:text-slate-950"
                >
                  Create Account
                </Link>
              </div>
            </form>

            <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5">
              <div className="flex gap-4">
                <div className="rounded-2xl bg-[#2f8fc8] p-3 text-white">
                  <ShieldCheck size={22} />
                </div>

                <div>
                  <p className="font-black text-slate-950">Admin Access</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Admins use the same login page. The app checks your
                    Supabase worker profile role after sign-in.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                  <MapPin size={22} />
                </div>

                <div>
                  <p className="font-black text-slate-950">
                    Central Wisconsin Route Support
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Workers can open map searches from the dashboard before
                    starting a trip.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={openCentralWisconsinMap}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <Route size={17} />
                Open Central Wisconsin Map
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MiniBadge icon={<Navigation size={16} />} text="Route Tools" />
              <MiniBadge icon={<CheckCircle2 size={16} />} text="Live Sync" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ icon, title, text }) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/80">
      <div className="mb-5 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-700">
        {icon}
      </div>

      <h3 className="text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
        {text}
      </p>
    </div>
  );
}

function StepItem({ number, title, text }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2f8fc8] text-sm font-black text-white">
        {number}
      </div>

      <div>
        <p className="font-black text-slate-950">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
      </div>
    </div>
  );
}

function PreviewMetric({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
      <p className="text-xs font-black uppercase tracking-wide text-blue-100">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function PreviewRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 py-3 last:border-b-0">
      <span className="text-sm font-semibold text-blue-100">{label}</span>
      <span className="text-sm font-black text-white">{value}</span>
    </div>
  );
}

function InfoPill({ icon, title, text }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-blue-50 p-2 text-blue-700">{icon}</div>

        <div>
          <p className="font-black text-slate-950">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-950">
        {label}
      </span>
      {children}
    </label>
  );
}

function MiniBadge({ icon, text }) {
  return (
    <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
      <span className="text-[#2f8fc8]">{icon}</span>
      {text}
    </div>
  );
}