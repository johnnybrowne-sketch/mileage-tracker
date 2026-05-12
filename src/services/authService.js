import { supabase } from "../lib/supabaseClient";
import { AUTH_REDIRECTS } from "../lib/constants";

export async function signInUser(email, password) {
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function signUpWorker({ email, password, fullName }) {
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: AUTH_REDIRECTS.signupConfirmation,
      data: {
        full_name: fullName,
      },
    },
  });
}

export async function sendPasswordReset(email, mode = "worker") {
  const redirectTo =
    mode === "admin"
      ? AUTH_REDIRECTS.adminPasswordReset
      : AUTH_REDIRECTS.workerPasswordReset;

  return await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
}

export async function updatePassword(newPassword) {
  return await supabase.auth.updateUser({
    password: newPassword,
  });
}

export async function signOutUser() {
  return await supabase.auth.signOut();
}