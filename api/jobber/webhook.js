import { createClient } from "@supabase/supabase-js";
import { refreshJobberToken, getRequiredEnv } from "./jobberAuth.js";

const JOBBER_GRAPHQL_URL = "https://api.getjobber.com/api/graphql";
const JOBBER_GRAPHQL_VERSION = "2025-04-16";

const supabase = createClient(
  getRequiredEnv("VITE_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY")
);

let accessToken = process.env.JOBBER_ACCESS_TOKEN;
let refreshToken = process.env.JOBBER_REFRESH_TOKEN;

const TIME_SHEET_ENTRIES_QUERY = `
  query GetTimeSheetEntries($first: Int!) {
    timeSheetEntries(first: $first) {
      nodes {
        id
        startAt
        endAt
        duration
        label
        note
        user {
          id
          name { full }
          email { raw }
        }
        job {
          id
          jobNumber
          title
          client {
            id
            name
          }
          property {
            id
            address {
              street
              city
              province
              postalCode
            }
          }
        }
      }
    }
  }
`;

function formatAddress(address = {}) {
  return [address.street, address.city, address.province, address.postalCode]
    .filter(Boolean)
    .join(", ");
}

function buildJobberJobUrl(jobId) {
  if (!jobId) return null;
  return `https://secure.getjobber.com/jobs/${encodeURIComponent(jobId)}`;
}

function mapTimeSheetEntryToRow(entry, existingRow = null) {
  const job = entry.job || null;
  const address = job?.property?.address || {};

  return {
    jobber_time_entry_id: entry.id,
    jobber_user_id: entry.user?.id || null,
    worker_name: entry.user?.name?.full || null,
    worker_email: entry.user?.email?.raw
      ? String(entry.user.email.raw).toLowerCase()
      : null,
    label: job?.id ? "Active Job" : entry.label || null,
    note: entry.note || null,
    start_at: entry.startAt || null,
    end_at: entry.endAt || null,
    duration_seconds: Number(entry.duration || 0),
    duration_minutes: Number(entry.duration || 0) / 60,
    jobber_job_id: job?.id || null,
    jobber_job_number:
      job?.jobNumber !== undefined && job?.jobNumber !== null
        ? String(job.jobNumber)
        : null,
    jobber_job_title: job?.title || null,
    jobber_client_id: job?.client?.id || null,
    jobber_client_name: job?.client?.name || null,
    jobber_property_id: job?.property?.id || null,
    jobber_property_address: formatAddress(address),
    jobber_job_url: buildJobberJobUrl(job?.id || null),

    mileage_status: existingRow?.mileage_status || "needs_review",
    vehicle_used: existingRow?.vehicle_used || null,
    linked_mileage_entry_id: existingRow?.linked_mileage_entry_id || null,
    mileage_completed_at: existingRow?.mileage_completed_at || null,

    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function refreshAccessToken() {
  const tokens = await refreshJobberToken(refreshToken);

  accessToken = tokens.access_token;

  if (tokens.refresh_token) {
    refreshToken = tokens.refresh_token;
    console.log("JOBBER_REFRESH_TOKEN_ROTATED:", tokens.refresh_token);
  }

  console.log("Jobber access token refreshed.");
}

async function callJobber(query, variables = {}, retry = true) {
  const response = await fetch(JOBBER_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-JOBBER-GRAPHQL-VERSION": JOBBER_GRAPHQL_VERSION,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();

  const jsonText = JSON.stringify(json || {}).toLowerCase();
  const authError =
    response.status === 401 ||
    response.status === 403 ||
    jsonText.includes("access token expired") ||
    jsonText.includes("token expired") ||
    jsonText.includes("unauthorized");

  if ((!response.ok || json.errors) && retry && authError) {
    await refreshAccessToken();
    return callJobber(query, variables, false);
  }

  if (!response.ok || json.errors) {
    console.error("Jobber API error:", JSON.stringify(json, null, 2));
    throw new Error("Jobber API request failed.");
  }

  return json.data;
}

async function syncLatestJobberTimesheets() {
  const data = await callJobber(TIME_SHEET_ENTRIES_QUERY, { first: 100 });
  const entries = data?.timeSheetEntries?.nodes || [];

  for (const entry of entries) {
    const { data: existingRow } = await supabase
      .from("jobber_timesheets")
      .select("*")
      .eq("jobber_time_entry_id", entry.id)
      .maybeSingle();

    const row = mapTimeSheetEntryToRow(entry, existingRow);

    const { error } = await supabase
      .from("jobber_timesheets")
      .upsert(row, { onConflict: "jobber_time_entry_id" });

    if (error) throw error;
  }

  return entries.length;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const count = await syncLatestJobberTimesheets();

    return res.status(200).json({
      ok: true,
      synced: count,
    });
  } catch (error) {
    console.error("Jobber webhook failed:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}