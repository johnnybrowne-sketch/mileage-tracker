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

const SCHEDULED_ITEMS_QUERY = `
  query GetScheduledItems($startAt: ISO8601DateTime!, $endAt: ISO8601DateTime!, $first: Int!) {
    scheduledItems(
      first: $first,
      filter: {
        occursWithin: {
          startAt: $startAt,
          endAt: $endAt
        }
      }
    ) {
      nodes {
        id
        title
        startAt
        endAt
        __typename
        ... on Visit {
          job {
            id
            jobNumber
            title
            client {
              id
              name
            }
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

const JOBS_QUERY = `
  query GetJobs($first: Int!) {
    jobs(first: $first) {
      nodes {
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
`;

function getCurrentYearRange() {
  const now = new Date();
  return {
    startAt: new Date(now.getFullYear(), 0, 1).toISOString(),
    endAt: new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString(),
  };
}

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

function mapAddress(address = {}) {
  return {
    property_address: address.street || "",
    property_city: address.city || "",
    property_state: address.province || "",
    property_postal_code: address.postalCode || "",
  };
}

function mapVisitToRow(visit) {
  const address = mapAddress(visit.property?.address || {});

  return {
    jobber_visit_id: visit.id,
    jobber_job_id: visit.job?.id || null,
    jobber_job_number: visit.job?.jobNumber ? String(visit.job.jobNumber) : null,
    jobber_job_title: visit.job?.title || visit.title || null,
    jobber_client_id: visit.job?.client?.id || null,
    jobber_client_name: visit.job?.client?.name || null,
    jobber_property_id: visit.property?.id || null,
    property_address: address.property_address,
    property_city: address.property_city,
    property_state: address.property_state,
    property_postal_code: address.property_postal_code,
    start_at: visit.startAt,
    end_at: visit.endAt,
    synced_at: new Date().toISOString(),
  };
}

function mapJobToRow(job) {
  const address = mapAddress(job.property?.address || {});
  const now = new Date();

  return {
    jobber_visit_id: `job-${job.id}`,
    jobber_job_id: job.id,
    jobber_job_number: job.jobNumber ? String(job.jobNumber) : null,
    jobber_job_title: job.title || null,
    jobber_client_id: job.client?.id || null,
    jobber_client_name: job.client?.name || null,
    jobber_property_id: job.property?.id || null,
    property_address: address.property_address,
    property_city: address.property_city,
    property_state: address.property_state,
    property_postal_code: address.property_postal_code,
    start_at: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    end_at: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString(),
    synced_at: new Date().toISOString(),
  };
}

function dedupeRows(rows) {
  const byId = new Map();

  for (const row of rows) {
    byId.set(row.jobber_visit_id, row);
  }

  return Array.from(byId.values());
}

async function syncJobberVisits() {
  const { startAt, endAt } = getCurrentYearRange();

  console.log("Syncing Jobber visits and jobs...");
  console.log(`Date range: ${startAt} to ${endAt}`);

  const scheduledData = await callJobber(SCHEDULED_ITEMS_QUERY, {
    startAt,
    endAt,
    first: 100,
  });

  const jobsData = await callJobber(JOBS_QUERY, {
    first: 100,
  });

  const scheduledItems = scheduledData?.scheduledItems?.nodes || [];
  const visits = scheduledItems.filter((item) => item.__typename === "Visit");
  const jobs = jobsData?.jobs?.nodes || [];

  const visitRows = visits.map(mapVisitToRow);
  const jobRows = jobs.map(mapJobToRow);

  const rows = dedupeRows([...visitRows, ...jobRows]);

  console.log(`Scheduled items found: ${scheduledItems.length}`);
  console.log(`Visits found: ${visits.length}`);
  console.log(`Jobs found: ${jobs.length}`);
  console.log(`Rows to sync: ${rows.length}`);

  if (rows.length === 0) {
    console.log("No Jobber records to sync.");
    return;
  }

  const { error } = await supabase
    .from("jobber_visits")
    .upsert(rows, { onConflict: "jobber_visit_id" });

  if (error) {
    console.error(error);
    throw new Error("Supabase upsert failed.");
  }

  console.log(`Success. Synced ${rows.length} Jobber records.`);
}

syncJobberVisits().catch((error) => {
  console.error(error);
  process.exit(1);
});