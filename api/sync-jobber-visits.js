import { createClient } from "@supabase/supabase-js";

const JOBBER_GRAPHQL_URL = "https://api.getjobber.com/api/graphql";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

async function callJobber(query, variables = {}) {
  const response = await fetch(JOBBER_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.JOBBER_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "X-JOBBER-GRAPHQL-VERSION": "2025-04-16",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();

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

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(res, 500, {
        error: "Missing SUPABASE_SERVICE_ROLE_KEY.",
      });
    }

    if (!process.env.JOBBER_ACCESS_TOKEN) {
      return jsonResponse(res, 500, {
        error: "Missing JOBBER_ACCESS_TOKEN.",
      });
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
          jobber_job_number: visit.job?.jobNumber
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

      if (error) {
        throw error;
      }
    }

    return jsonResponse(res, 200, {
      success: true,
      syncedCount: rows.length,
      visits: rows,
    });
  } catch (error) {
    return jsonResponse(res, 500, {
      success: false,
      error: error.message,
    });
  }
}