import { createClient } from "@supabase/supabase-js";
import { getRequiredEnv } from "./jobberAuth.js";

const supabase = createClient(
  getRequiredEnv("VITE_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY")
);

const TOKEN_ROW_ID = "primary";

export async function getStoredJobberTokens() {
  const { data, error } = await supabase
    .from("jobber_oauth_tokens")
    .select("*")
    .eq("id", TOKEN_ROW_ID)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function saveJobberTokens(tokens) {
  const expiresIn = Number(tokens.expires_in || 3600);
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { error } = await supabase.from("jobber_oauth_tokens").upsert(
    {
      id: TOKEN_ROW_ID,
      access_token: tokens.access_token || null,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) throw error;
}