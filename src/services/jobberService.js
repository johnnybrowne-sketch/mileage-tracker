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

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchText(visit) {
  return normalizeSearchText(
    [
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
      formatJobberVisitAddress(visit),
      getJobberVisitDisplayLabel(visit),
    ]
      .filter(Boolean)
      .join(" ")
  );
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

function mapTimesheetToVisit(timesheet) {
  return {
    jobber_visit_id: timesheet.jobber_time_entry_id
      ? `timesheet-${timesheet.jobber_time_entry_id}`
      : `job-${timesheet.jobber_job_id}`,
    jobber_job_id: timesheet.jobber_job_id || null,
    jobber_job_number: timesheet.jobber_job_number || null,
    jobber_job_title: timesheet.jobber_job_title || null,
    jobber_client_id: timesheet.jobber_client_id || null,
    jobber_client_name: timesheet.jobber_client_name || null,
    jobber_property_id: timesheet.jobber_property_id || null,
    property_address: timesheet.jobber_property_address || "",
    property_city: "",
    property_state: "",
    property_postal_code: "",
    start_at: timesheet.start_at || null,
    end_at: timesheet.end_at || null,
    synced_at: timesheet.synced_at || null,
    source: "jobber_timesheet",
  };
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

    const existingUpdated = new Date(
      existing.synced_at || existing.updated_at || existing.start_at || 0
    ).getTime();

    const currentUpdated = new Date(
      visit.synced_at || visit.updated_at || visit.start_at || 0
    ).getTime();

    if (currentUpdated >= existingUpdated) {
      byJobOrVisit.set(key, visit);
    }
  }

  return Array.from(byJobOrVisit.values());
}

export async function getJobberVisitsForMonth(monthKey) {
  const cleanMonthKey = String(monthKey || "").trim();

  let visitsQuery = supabase
    .from("jobber_visits")
    .select("*")
    .order("jobber_job_title", { ascending: true })
    .limit(500);

  let timesheetsQuery = supabase
    .from("jobber_timesheets")
    .select("*")
    .order("start_at", { ascending: false })
    .limit(500);

  if (/^\d{4}-\d{2}$/.test(cleanMonthKey)) {
    const { startAt, endAt } = getMonthDateRange(cleanMonthKey);

    visitsQuery = visitsQuery.lt("start_at", endAt).gt("end_at", startAt);
    timesheetsQuery = timesheetsQuery.lt("start_at", endAt).gt("end_at", startAt);
  }

  const [visitsResult, timesheetsResult] = await Promise.all([
    visitsQuery,
    timesheetsQuery,
  ]);

  if (visitsResult.error) {
    throw visitsResult.error;
  }

  if (timesheetsResult.error) {
    throw timesheetsResult.error;
  }

  const visits = visitsResult.data || [];
  const timesheetVisits = (timesheetsResult.data || [])
    .filter((timesheet) => timesheet.jobber_job_id || timesheet.jobber_job_title)
    .map(mapTimesheetToVisit);

  return dedupeJobberVisits([...timesheetVisits, ...visits]);
}

export async function searchJobberVisits({ monthKey, query }) {
  const visits = await getJobberVisitsForMonth(monthKey);
  const cleanQuery = normalizeSearchText(query);

  if (!cleanQuery) {
    return visits.slice(0, 20);
  }

  const queryTerms = cleanQuery.split(" ").filter(Boolean);

  return visits
    .filter((visit) => {
      const searchText = buildSearchText(visit);

      return queryTerms.every((term) => searchText.includes(term));
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