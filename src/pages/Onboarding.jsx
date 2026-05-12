import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, LogOut, UserRoundCheck } from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import { signOutUser } from "../services/authService";
import { createOrUpdateWorkerProfileForUser } from "../services/profileService";

export default function Onboarding() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [fullName, setFullName] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadUser() {
      setLoadingUser(true);

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        setErrorMessage("Unable to load your login session.");
        setLoadingUser(false);
        return;
      }

      if (!session?.user) {
        navigate("/login");
        return;
      }

      const currentUser = session.user;
      const suggestedName =
        currentUser.user_metadata?.full_name ||
        currentUser.email?.split("@")?.[0] ||
        "";

      setUser(currentUser);
      setFullName(suggestedName);
      setLoadingUser(false);
    }

    loadUser();
  }, [navigate]);

  async function handleSubmit(event) {
    event.preventDefault();

    setSaving(true);
    setErrorMessage("");

    try {
      await createOrUpdateWorkerProfileForUser({
        user,
        fullName,
      });

      navigate("/worker");
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error?.message || "Unable to save your profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await signOutUser();
    navigate("/login");
  }

  if (loadingUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="rounded-3xl bg-white px-8 py-6 shadow-sm ring-1 ring-slate-200">
          <p className="font-semibold text-slate-700">Loading profile setup...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 px-6 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="flex flex-col justify-center">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
            <Car size={30} />
          </div>

          <p className="mb-4 inline-flex w-fit rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 shadow-sm">
            One Last Step
          </p>

          <h1 className="max-w-2xl text-5xl font-black tracking-tight text-slate-950">
            Complete Your Mileage Tracker Profile
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            Your login is active. Now we need to connect your Supabase account
            to a worker profile so mileage entries can be saved under the
            correct person.
          </p>

          <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-black text-slate-950">What This Does</h2>

            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <p>• Links your login to your worker profile.</p>
              <p>• Allows mileage entries to be saved under your account.</p>
              <p>• Keeps admin access controlled by the database role field.</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-2xl shadow-slate-300/70 ring-1 ring-slate-200 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-4 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-600">
                <UserRoundCheck size={28} />
              </div>

              <h2 className="text-3xl font-black text-slate-950">
                Profile Setup
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Confirm your name before entering the mileage dashboard.
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>

          <div className="mt-8 rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
            <p className="text-sm font-bold text-slate-500">Logged In As</p>
            <p className="mt-1 break-all text-lg font-black text-slate-950">
              {user?.email}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Full Name
              </span>

              <input
                type="text"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Enter your full name"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving Profile..." : "Continue To Dashboard"}
            </button>
          </form>

          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="font-black text-amber-900">Admin Note</h3>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              This page creates regular worker profiles only. To make this user
              an admin, update their row in Supabase and set role to admin.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}