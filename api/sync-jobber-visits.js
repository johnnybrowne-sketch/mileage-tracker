import { createClient } from "@supabase/supabase-js";
import { refreshJobberToken, getRequiredEnv } from "./jobber/jobberAuth.js";

const JOBBER_GRAPHQL_URL = "https://api.getjobber.com/api/graphql";
const JOBBER_GRAPHQL_VERSION = "2025-04-16";

const supabase = createClient(
  getRequiredEnv("VITE_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY")
);

let accessToken = process.env.JOBBER_ACCESS_TOKEN;
let refreshToken = process.env.JOBBER_REFRESH_TOKEN;

function jsonResponse(res, statusCode, body) {
  res.status(statusCode).json(body);
}

function getAddress(property) {
  const address = property?.address || {};

  return {
    property_address: address.street || "",
    property_city: address.city || "",
    property_state: address.province || "",
    property_postal_code: address.postalCode || "",
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
    throw new Error(JSON.stringify(json.errors || json));
  }

  return json.data;
}

const JOBBER_VISITS_QUERY = `
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

export default async function handler(req, res) {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return jsonResponse(res, 405, { error: "Method not allowed" });
    }

    const now = new Date();
    const startAt = new Date(now.getFullYear(), 0, 1).toISOString();
    const endAt = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString();

    const data = await callJobber(JOBBER_VISITS_QUERY, {
      startAt,
      endAt,
      first: 100,
    });

    const visits = data?.scheduledItems?.nodes || [];

    const rows = visits
      .filter((item) => item.__typename === "Visit")
      .map((visit) => {
        const address = getAddress(visit.property);

        return {
          jobber_visit_id: visit.id,
          jobber_job_id: visit.job?.id || null,
          jobber_job_number:
            visit.job?.jobNumber !== undefined && visit.job?.jobNumber !== null
              ? String(visit.job.jobNumber)
              : null,
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
      });

    if (rows.length > 0) {
      const { error } = await supabase
        .from("jobber_visits")
        .upsert(rows, { onConflict: "jobber_visit_id" });

      if (error) throw error;
    }

    return jsonResponse(res, 200, {
      success: true,
      syncedCount: rows.length,
    });
  } catch (error) {
    return jsonResponse(res, 500, {
      success: false,
      error: error.message,
    });
  }
}