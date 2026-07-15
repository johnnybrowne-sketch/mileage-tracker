import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import WorkerDashboard from "./pages/WorkerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Onboarding from "./pages/Onboarding";
import { supabase } from "./lib/supabaseClient";
import { getProfileForUser, isAdminProfile } from "./services/profileService";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SessionRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/worker" element={<WorkerDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/onboarding" element={<Onboarding />} />
      </Routes>
    </BrowserRouter>
  );
}

function SessionRedirect() {
  const [redirectPath, setRedirectPath] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function chooseDashboard() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (!session?.user) {
          setRedirectPath("/login");
          return;
        }

        const profile = await getProfileForUser(session.user);

        if (!isMounted) return;

        if (!profile) {
          setRedirectPath("/onboarding");
          return;
        }

        setRedirectPath(isAdminProfile(profile) ? "/admin" : "/worker");
      } catch (error) {
        console.error(error);

        if (isMounted) {
          setRedirectPath("/login");
        }
      }
    }

    chooseDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!redirectPath) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef3f9] px-6 text-center text-sm font-black text-slate-600">
        Opening Mileage Tracker...
      </main>
    );
  }

  return <Navigate to={redirectPath} replace />;
}
