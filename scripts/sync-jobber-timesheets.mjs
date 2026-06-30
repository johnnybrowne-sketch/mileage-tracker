import { createClient } from "@supabase/supabase-js";

const JOBBER_GRAPHQL_URL = "https://api.getjobber.com/api/graphql";
const JOBBER_GRAPHQL_VERSION = "2025-04-16";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jobberAccessToken = process.env.JOBBER_ACCESS_TOKEN;

if (!supabaseUrl) throw new Error("Missing VITE_SUPABASE_URL in .env.local");
if (!supabaseServiceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
if (!jobberAccessToken) throw new Error("Missing JOBBER_ACCESS_TOKEN in .env.local");

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

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

async function callJobber(query, variables) {
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
    console.error(JSON.stringify(json, null, 2));
    throw new Error("Jobber API request failed.");
  }

  return json.data;
}

function formatAddress(address = {}) {
  return [
    address.street,
    address.city,
    address.province,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function buildJobberJobUrl(jobId) {
  if (!jobId) return null;

  const cleanJobId = String(jobId).trim();
  let webId = cleanJobId;

  try {
    const decodedId = Buffer.from(cleanJobId, "base64").toString("utf8");
    webId = decodedId.split("/").filter(Boolean).at(-1) || cleanJobId;
  } catch {
    // Keep the original id when it is already a Jobber web id.
  }

  return `https://secure.getjobber.com/work_orders/${encodeURIComponent(webId)}`;
}

function mapTimeSheetEntryToRow(entry) {
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
    mileage_status: "needs_review",
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function syncJobberTimesheets() {
  console.log("Syncing Jobber timesheets...");

  const data = await callJobber(TIME_SHEET_ENTRIES_QUERY, {
    first: 100,
  });

  const entries = data?.timeSheetEntries?.nodes || [];
  const cancelledTimeEntryIds = await getCancelledTimeEntryIds();
  const rows = entries
    .map(mapTimeSheetEntryToRow)
    .filter((row) => !cancelledTimeEntryIds.has(row.jobber_time_entry_id));

  console.log(`Timesheet entries found: ${entries.length}`);
  console.log(`Cancelled in Mileage Tracker: ${cancelledTimeEntryIds.size}`);
  console.log(`Rows to sync: ${rows.length}`);

  if (rows.length === 0) {
    console.log("No Jobber timesheets to sync.");
    return;
  }

  const { error } = await supabase
    .from("jobber_timesheets")
    .upsert(rows, { onConflict: "jobber_time_entry_id" });

  if (error) {
    console.error(error);
    throw new Error("Supabase upsert failed.");
  }

  console.log(`Success. Synced ${rows.length} Jobber timesheets.`);
}

async function getCancelledTimeEntryIds() {
  const { data, error } = await supabase
    .from("jobber_timesheets")
    .select("jobber_time_entry_id, is_cancelled, mileage_status")
    .or("is_cancelled.eq.true,mileage_status.eq.cancelled");

  if (!error) {
    return new Set(
      (data || [])
        .map((row) => row.jobber_time_entry_id)
        .filter(Boolean)
    );
  }

  const message = String(error?.message || "").toLowerCase();

  if (message.includes("is_cancelled") || message.includes("schema cache")) {
    console.warn(
      "Cancelled timesheet columns are not available yet. Run the Jobber timesheet cancel migration to keep removed timesheets from syncing again."
    );
    return new Set();
  }

  throw error;
}

syncJobberTimesheets().catch((error) => {
  console.error(error);
  process.exit(1);
});
