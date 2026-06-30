import { supabase } from "../lib/supabaseClient";

export async function invokeSupabaseFunction(name, options = {}) {
  const { data, error } = await supabase.functions.invoke(name, options);

  if (error) {
    throw await buildSupabaseFunctionError(error);
  }

  if (data?.error) {
    throw new Error(formatFunctionPayloadError(data.error));
  }

  return data;
}

async function buildSupabaseFunctionError(error) {
  const message = await readFunctionErrorMessage(error);
  const nextError = new Error(message);
  nextError.name = error?.name || "SupabaseFunctionError";
  nextError.cause = error;
  return nextError;
}

async function readFunctionErrorMessage(error) {
  const fallback =
    error?.message || "The AI service could not finish this request.";
  const response = error?.context;

  if (!response || typeof response.clone !== "function") {
    return fallback;
  }

  try {
    const payload = await response.clone().json();
    return (
      formatFunctionPayloadError(payload?.error) ||
      formatFunctionPayloadError(payload?.message) ||
      formatFunctionPayloadError(payload?.details) ||
      fallback
    );
  } catch {
    // Try plain text below.
  }

  try {
    const text = await response.clone().text();
    return text || fallback;
  } catch {
    return fallback;
  }
}

function formatFunctionPayloadError(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.message) return String(value.message);
  return JSON.stringify(value);
}
