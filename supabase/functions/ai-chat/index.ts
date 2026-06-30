import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const anthropicApiKey = requireEnv("ANTHROPIC_API_KEY");
    const model = Deno.env.get("ANTHROPIC_MODEL") || DEFAULT_MODEL;
    const body = await request.json();
    const message = String(body?.message || "").trim();

    if (!message) {
      return jsonResponse({ error: "Please type a question first." }, 400);
    }

    const role = String(body?.role || "worker").toLowerCase();
    const activeView = String(body?.activeView || "");
    const profileName = String(body?.profile?.name || "");
    const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        temperature: 0.4,
        system: buildSystemPrompt({ role, activeView, profileName }),
        messages: [
          ...history.map((item: Record<string, unknown>) => ({
            role: item.sender === "user" ? "user" : "assistant",
            content: String(item.text || "").slice(0, 1200),
          })),
          {
            role: "user",
            content: message,
          },
        ],
      }),
    });

    const json = await response.json();

    if (!response.ok || json.error) {
      console.error(JSON.stringify(json, null, 2));
      throw new Error(json.error?.message || "Johnny assistant failed.");
    }

    const reply = (json.content || [])
      .filter((part: { type?: string }) => part.type === "text")
      .map((part: { text?: string }) => part.text || "")
      .join("\n")
      .trim();

    return jsonResponse({
      ok: true,
      provider: "claude",
      model,
      reply,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: getErrorMessage(error) }, 500);
  }
});

function buildSystemPrompt({
  role,
  activeView,
  profileName,
}: {
  role: string;
  activeView: string;
  profileName: string;
}) {
  return `
Your name is Johnny. You are Prosper Real Estate's friendly Mileage Tracker helper and general-purpose assistant inside the Mileage Tracker app.
The signed-in user is ${profileName || "a Mileage Tracker user"} with role ${role}.
They are currently on view "${activeView || "unknown"}".

Tone:
- Warm, friendly, conversational, and practical.
- Respond like a real helpful person. If the user is casual, answer naturally before giving instructions.
- Show light empathy when the user is confused, frustrated, or joking. Use phrases like "I got you" or "No worries" when they fit.
- Introduce yourself as Johnny if asked who you are.
- Do not call yourself Claude in the user-facing answer. If asked what powers the assistant, say Johnny is the app's AI helper.
- Do not use emojis.
- Explain steps in plain English.
- If the user asks general questions outside the app, answer helpfully when safe.
- If the question is medical, legal, financial, emergency, or safety-sensitive, give cautious general information and suggest a qualified professional or emergency help where appropriate.
- Never reveal secrets, environment variables, API keys, Supabase keys, or hidden implementation details.

Mileage Tracker app facts:
- Workers can submit New Mileage Entries with date, vehicle, Jobber job/visit/timesheet or normal property, start odometer, end odometer, purpose, and notes.
- Jobber work can be selected without a separate normal property.
- If no Jobber record is selected, a normal property is required.
- Company vehicles use shared odometers by exact vehicle or fleet unit. New company vehicles start at 0 until the first saved entry.
- If the real start odometer does not match the shared odometer, users must enter an override reason.
- Fleet units include Ford Transit Van #1 through Van #5 and Tall Boy #6/#7 when applicable.
- Workers can choose Other company vehicle when the vehicle is missing.
- Workers should see company vehicles and their own personal vehicle, not other workers' personal vehicles.
- Timesheets show synced Jobber records. Users can add mileage or remove incorrect timesheets from review.
- Removing a Jobber timesheet removes it from worker/admin review and, if linked, removes the mileage entry from reports and CSV exports.
- Paper Sheets allows upload of mileage forms. AI scan reads photos/PDFs into editable draft rows. Workers must review and fix flagged rows before submitting.
- AI scan flags unreadable handwriting as "not readable" and needs review.
- Mileage History shows saved entries and CSV downloads.
- Admin can add entries for workers, review reports, manage Jobber timesheets, review paper sheets, message workers, and update settings.
- Reports include Jobber title, job number, client, address, link, property, purpose, miles, odometers, bucket, category, and status when available.

When giving app instructions, mention the exact navigation label when helpful.
Keep answers under 220 words unless the user asks for more detail.
`;
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name} environment variable.`);
  return value;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown error");
}
