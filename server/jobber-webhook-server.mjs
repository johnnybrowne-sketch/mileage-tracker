import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const PORT = process.env.JOBBER_WEBHOOK_PORT || 8787;

const JOBBER_GRAPHQL_URL = "https://api.getjobber.com/api/graphql";
const JOBBER_GRAPHQL_VERSION = "2025-04-16";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jobberAccessToken = process.env.JOBBER_ACCESS_TOKEN;

if (!supabaseUrl) throw new Error("Missing VITE_SUPABASE_URL in .env.local");
if (!supabaseServiceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
if (!jobberAccessToken) throw new Error("Missing JOBBER_ACCESS_TOKEN in .env.local");

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

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
          name {
            full
          }
          email {
            raw
          }
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

async function callJobber(query, variables = {}) {
  const response = await fetch(JOBBER_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jobberAccessToken}`,
      "Content-Type": "application/json",
      "X-JOBBER-GRAPHQL-VERSION": JOBBER_GRAPHQL_VERSION,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();

  if (!response.ok || json.errors) {
    console.error("Jobber API error:", JSON.stringify(json, null, 2));
    throw new Error("Jobber API request failed.");
  }

  return json.data;
}

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
    worker_email: entry.user?.email?.raw ? String(entry.user.email.raw).toLowerCase() : null,
    label: job?.id ? "Active Job" : entry.label || null,
    note: entry.note || null,
    start_at: entry.startAt || null,
    end_at: entry.endAt || null,
    duration_seconds: Number(entry.duration || 0),
    duration_minutes: Number(entry.duration || 0) / 60,
    jobber_job_id: job?.id || null,
    jobber_job_number:
      job?.jobNumber !== undefined && job?.jobNumber !== null ? String(job.jobNumber) : null,
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

async function syncLatestJobberTimesheets() {
  console.log("Fetching latest Jobber timesheets...");

  const data = await callJobber(TIME_SHEET_ENTRIES_QUERY, { first: 100 });
  const entries = data?.timeSheetEntries?.nodes || [];

  console.log(`Jobber timesheets found: ${entries.length}`);

  for (const entry of entries) {
    const { data: existingRow, error: existingError } = await supabase
      .from("jobber_timesheets")
      .select("*")
      .eq("jobber_time_entry_id", entry.id)
      .maybeSingle();

    if (existingError) {
      console.error("Supabase existing row check failed:", existingError);
      continue;
    }

    const row = mapTimeSheetEntryToRow(entry, existingRow);

    const { error } = await supabase
      .from("jobber_timesheets")
      .upsert(row, { onConflict: "jobber_time_entry_id" });

    if (error) {
      console.error("Supabase upsert failed:", error);
      continue;
    }

    console.log(`Upserted Jobber timesheet: ${entry.id}`);
  }

  console.log("Realtime timesheet sync complete.");
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "Jobber Mileage Webhook Server",
    port: PORT,
    time: new Date().toISOString(),
  });
});

app.post("/webhooks/jobber", async (req, res) => {
  try {
    console.log("Jobber webhook received.");
    console.log("Payload keys:", Object.keys(req.body || {}));

    res.status(200).json({ received: true });

    await syncLatestJobberTimesheets();
  } catch (error) {
    console.error("Webhook processing failed:", error);
  }
});

app.post("/sync/jobber-timesheets", async (req, res) => {
  try {
    await syncLatestJobberTimesheets();
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Jobber webhook server running at http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Webhook URL path: /webhooks/jobber`);
});