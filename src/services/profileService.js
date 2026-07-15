import { supabase } from "../lib/supabaseClient";

function getDefaultNameFromUser(user) {
  const metadataName = user?.user_metadata?.full_name;

  if (metadataName?.trim()) {
    return metadataName.trim();
  }

  const emailName = user?.email?.split("@")?.[0];

  if (emailName?.trim()) {
    return emailName.trim();
  }

  return "Worker";
}

export async function getProfileForUser(user) {
  if (!user) return null;

  const { data: profileByAuthId, error: authIdError } = await supabase
    .from("worker_profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (authIdError) {
    throw authIdError;
  }

  if (profileByAuthId) {
    return profileByAuthId;
  }

  if (!user.email) {
    return null;
  }

  const cleanEmail = user.email.trim();

  const { data: profileByEmail, error: emailError } = await supabase
    .from("worker_profiles")
    .select("*")
    .ilike("email", cleanEmail)
    .maybeSingle();

  if (emailError) {
    throw emailError;
  }

  if (!profileByEmail) {
    return null;
  }

  if (
    profileByEmail.auth_user_id &&
    profileByEmail.auth_user_id !== user.id
  ) {
    throw new Error(
      "This worker profile is already linked to a different login account."
    );
  }

  const { data: linkedProfile, error: linkError } = await supabase
    .from("worker_profiles")
    .update({
      auth_user_id: user.id,
      email: cleanEmail,
    })
    .eq("id", profileByEmail.id)
    .select("*")
    .single();

  if (linkError) {
    throw linkError;
  }

  return linkedProfile;
}

export async function createDefaultWorkerProfileForUser(user) {
  if (!user) {
    throw new Error("No logged-in user found.");
  }

  const cleanEmail = user.email?.trim();

  if (!cleanEmail) {
    throw new Error("The logged-in user does not have an email address.");
  }

  const { data, error } = await supabase
    .from("worker_profiles")
    .insert({
      auth_user_id: user.id,
      full_name: getDefaultNameFromUser(user),
      email: cleanEmail,
      role: "worker",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getOrCreateWorkerProfileForUser(user) {
  const existingProfile = await getProfileForUser(user);

  if (existingProfile) {
    return existingProfile;
  }

  return await createDefaultWorkerProfileForUser(user);
}

export async function createOrUpdateWorkerProfileForUser({ user, fullName }) {
  if (!user) {
    throw new Error("No logged-in user found.");
  }

  if (!fullName?.trim()) {
    throw new Error("Full name is required.");
  }

  const existingProfile = await getProfileForUser(user);

  if (existingProfile) {
    const { data, error } = await supabase
      .from("worker_profiles")
      .update({
        auth_user_id: user.id,
        full_name: fullName.trim(),
        email: user.email,
      })
      .eq("id", existingProfile.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from("worker_profiles")
    .insert({
      auth_user_id: user.id,
      full_name: fullName.trim(),
      email: user.email,
      role: "worker",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateWorkerDefaultVehicle({
  workerId,
  vehicleName,
  vehicleId,
}) {
  if (!workerId) {
    throw new Error("Worker is required.");
  }

  const cleanVehicleName = String(vehicleName || "").trim();
  const cleanVehicleId = String(vehicleId || "").trim();

  const { data, error } = await supabase
    .from("worker_profiles")
    .update({
      default_vehicle_name: cleanVehicleName || null,
      default_vehicle_id: cleanVehicleId || null,
    })
    .eq("id", workerId)
    .select("*")
    .single();

  if (error) {
    const message = String(error.message || "");

    if (
      message.includes("default_vehicle_name") ||
      message.includes("default_vehicle_id") ||
      message.includes("schema cache") ||
      message.includes("column")
    ) {
      throw new Error(
        "Default vehicle setup is not installed in Supabase yet. Run the worker default vehicle SQL, then try saving again."
      );
    }

    throw error;
  }

  return data;
}

export function isAdminProfile(profile) {
  return profile?.role === "admin";
}
