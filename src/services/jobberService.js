import { supabase } from "../lib/supabaseClient";

export function getMonthDateRange(monthKey) {
  const cleanMonthKey = String(monthKey || "").trim();

  if (!/^\d{4}-\d{2}$/.test(cleanMonthKey)) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    return getMonthDateRange(`${year}-${month}`);
  }

  const [yearValue, monthValue] = cleanMonthKey.split("-");
  const year = Number(yearValue);
  const monthIndex = Number(monthValue) - 1;

  const startDate = new Date(year, monthIndex, 1);
  const endDate = new Date(year, monthIndex + 1, 1);

  return {
    startAt: startDate.toISOString(),
    endAt: endDate.toISOString(),
  };
}

export function formatJobberVisitAddress(visit) {
  return [
    visit?.property_address,
    visit?.property_city,
    visit?.property_state,
    visit?.property_postal_code,
  ]
    .filter(Boolean)
    .join(", ");
}

export function getJobberVisitDisplayLabel(visit) {
  if (!visit) return "";

  const address = formatJobberVisitAddress(visit);

  return [
    visit.jobber_job_title,
    visit.jobber_client_name,
    visit.jobber_job_number ? `Job #${visit.jobber_job_number}` : "",
    address,
  ]
    .filter(Boolean)
    .join(" - ");
}

function dedupeJobberVisits(visits) {
  const byJobOrVisit = new Map();

  for (const visit of visits || []) {
    const key = visit.jobber_job_id || visit.jobber_visit_id;

    if (!key) continue;

    const existing = byJobOrVisit.get(key);

    if (!existing) {
      byJobOrVisit.set(key, visit);
      continue;
    }

    const existingIsVisit = !String(existing.jobber_visit_id || "").startsWith("job-");
    const currentIsVisit = !String(visit.jobber_visit_id || "").startsWith("job-");

    if (currentIsVisit && !existingIsVisit) {
      byJobOrVisit.set(key, visit);
    }
  }

  return Array.from(byJobOrVisit.values());
}

export async function getJobberVisitsForMonth(monthKey) {
  const cleanMonthKey = String(monthKey || "").trim();
  let query = supabase
    .from("jobber_visits")
    .select("*")
    .order("jobber_job_title", { ascending: true })
    .limit(500);

  if (/^\d{4}-\d{2}$/.test(cleanMonthKey)) {
    const { startAt, endAt } = getMonthDateRange(cleanMonthKey);
    query = query.lt("start_at", endAt).gt("end_at", startAt);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return dedupeJobberVisits(data || []);
}

export async function searchJobberVisits({ monthKey, query }) {
  const visits = await getJobberVisitsForMonth(monthKey);
  const cleanQuery = String(query || "").trim().toLowerCase();

  if (!cleanQuery) {
    return visits.slice(0, 20);
  }

  return visits
    .filter((visit) => {
      const searchText = [
        visit.jobber_visit_id,
        visit.jobber_job_id,
        visit.jobber_job_number,
        visit.jobber_job_title,
        visit.jobber_client_name,
        visit.jobber_property_id,
        visit.property_address,
        visit.property_city,
        visit.property_state,
        visit.property_postal_code,
        getJobberVisitDisplayLabel(visit),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchText.includes(cleanQuery);
    })
    .slice(0, 20);
}

export function mapJobberVisitToMileageFields(visit) {
  if (!visit) {
    return {};
  }

  return {
    jobberVisitId: visit.jobber_visit_id || null,
    jobberJobId: visit.jobber_job_id || null,
    jobberClientId: visit.jobber_client_id || null,
    jobberPropertyId: visit.jobber_property_id || null,
    jobberJobNumber: visit.jobber_job_number || null,
    jobberJobTitle: visit.jobber_job_title || null,
    jobberClientName: visit.jobber_client_name || null,
    jobberPropertyAddress: formatJobberVisitAddress(visit),
  };
}
