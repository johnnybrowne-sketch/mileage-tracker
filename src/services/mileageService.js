import { supabase } from "../lib/supabaseClient";
import { buildMileageWorkflowFields } from "./mileageWorkflowService";

export function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parseMileageDate(dateValue) {
  if (!dateValue) return null;

  if (dateValue instanceof Date) {
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }

  const stringValue = String(dateValue).trim();
  const dateOnlyMatch = stringValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);

    return new Date(year, month, day);
  }

  const timestampDate = new Date(stringValue);
  return Number.isNaN(timestampDate.getTime()) ? null : timestampDate;
}

export function getTodayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getMonthKeyFromDate(dateValue) {
  if (!dateValue) return "";

  const stringValue = String(dateValue).trim();

  if (/^\d{4}-\d{2}/.test(stringValue)) {
    return stringValue.slice(0, 7);
  }

  const parsedDate = parseMileageDate(dateValue);
  if (!parsedDate) return "";

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export function getMonthStartFromDate(dateValue) {
  const fallback = getTodayInputValue();
  const cleanDate = dateValue || fallback;
  const [year, month] = cleanDate.split("-");

  return `${year}-${month}-01`;
}

export function formatMonthKey(monthKey) {
  if (!monthKey) return "";

  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
}

export function calculateMilesFromOdometer(startOdometer, endOdometer) {
  const start = Number(startOdometer);
  const end = Number(endOdometer);

  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  if (end < start) return 0;

  return end - start;
}

export function calculateEntryMiles(entry) {
  const directMiles = Number(entry?.miles);

  if (!Number.isNaN(directMiles) && directMiles >= 0) {
    return directMiles;
  }

  return calculateMilesFromOdometer(entry?.start_odometer, entry?.end_odometer);
}

export async function getWorkerMileageEntries(workerId) {
  if (!workerId) return [];

  const { data, error } = await supabase
    .from("mileage_entries")
    .select(
      `
      id,
      sheet_id,
      user_id,
      entry_date,
      driver_name,
      property_code,
      property_display,
      start_odometer,
      end_odometer,
      miles,
      purpose,
      vehicle,
      status,
      created_at,
      updated_at,
      jobber_visit_id,
      jobber_job_id,
      jobber_client_id,
      jobber_property_id,
      jobber_job_number,
      jobber_job_title,
      jobber_client_name,
      jobber_property_address,
      jobber_timesheet_id
    `
    )
    .eq("user_id", workerId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  return data || [];
}

export async function ensureMileageSheetForMonth(workerId, entryDate) {
  if (!workerId) {
    throw new Error("Worker profile is missing.");
  }

  const monthStart = getMonthStartFromDate(entryDate);

  const { data: existingSheet, error: existingError } = await supabase
    .from("mileage_sheets")
    .select("*")
    .eq("user_id", workerId)
    .eq("month_start", monthStart)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingSheet) return existingSheet;

  const { data: newSheet, error: insertError } = await supabase
    .from("mileage_sheets")
    .insert({
      user_id: workerId,
      month_start: monthStart,
      status: "open",
    })
    .select("*")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: duplicateSafeSheet, error: duplicateSafeError } =
        await supabase
          .from("mileage_sheets")
          .select("*")
          .eq("user_id", workerId)
          .eq("month_start", monthStart)
          .single();

      if (duplicateSafeError) throw duplicateSafeError;

      return duplicateSafeSheet;
    }

    throw insertError;
  }

  return newSheet;
}

export async function saveWorkerMileageEntry({
  profile,
  entryDate,
  vehicleName,
  propertyCode,
  propertyDisplay,
  startOdometer,
  endOdometer,
  purpose,
  jobberVisit = null,
  jobberTimesheetId = null,
}) {
  if (!profile?.id) {
    throw new Error("Worker profile is missing.");
  }

  if (!entryDate) {
    throw new Error("Date is required.");
  }

  if (!vehicleName) {
    throw new Error("Vehicle is required.");
  }

  if (!propertyCode) {
    throw new Error("Please select a Jobber Visit, Jobber Timesheet, or Property.");
  }

  if (startOdometer === "" || startOdometer === null || startOdometer === undefined) {
    throw new Error("Start odometer is required.");
  }

  if (endOdometer === "" || endOdometer === null || endOdometer === undefined) {
    throw new Error("End odometer is required.");
  }

  const start = Number(startOdometer);
  const end = Number(endOdometer);

  if (Number.isNaN(start)) {
    throw new Error("Start odometer must be a number.");
  }

  if (Number.isNaN(end)) {
    throw new Error("End odometer must be a number.");
  }

  if (end < start) {
    throw new Error("End odometer must be greater than or equal to start odometer.");
  }

  const miles = end - start;
  const sheet = await ensureMileageSheetForMonth(profile.id, entryDate);

  const jobberPayload = jobberVisit
    ? {
        jobber_visit_id: jobberVisit.jobberVisitId || null,
        jobber_job_id: jobberVisit.jobberJobId || null,
        jobber_client_id: jobberVisit.jobberClientId || null,
        jobber_property_id: jobberVisit.jobberPropertyId || null,
        jobber_job_number: jobberVisit.jobberJobNumber || null,
        jobber_job_title: jobberVisit.jobberJobTitle || null,
        jobber_client_name: jobberVisit.jobberClientName || null,
        jobber_property_address: jobberVisit.jobberPropertyAddress || null,
      }
    : {};

  const data = await insertMileageEntryWithSchemaRetry({
    sheet_id: sheet.id,
    user_id: profile.id,
    entry_date: entryDate,
    driver_name: profile.full_name || profile.email || "Worker",
    property_code: propertyCode,
    property_display: propertyDisplay,
    start_odometer: start,
    end_odometer: end,
    miles,
    purpose: purpose?.trim() || null,
    vehicle: vehicleName,
    status: "saved",
    jobber_timesheet_id: jobberTimesheetId,
    ...jobberPayload,
    ...buildMileageWorkflowFields({
      jobberVisit,
      jobberTimesheetId,
      vehicleName,
      startOdometer,
      purpose,
    }),
  });

  if (jobberTimesheetId) {
    const { error: updateTimesheetError } = await supabase
      .from("jobber_timesheets")
      .update({
        mileage_entry_id: data.id,
        mileage_vehicle: vehicleName,
        mileage_status: "completed",
        mileage_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobberTimesheetId);

    if (updateTimesheetError) throw updateTimesheetError;
  }

  return data;
}

async function insertMileageEntryWithSchemaRetry(initialPayload) {
  let payload = stripUndefinedValues(initialPayload);
  let lastError = null;

  for (let attempt = 0; attempt < 18; attempt += 1) {
    const { data, error } = await supabase
      .from("mileage_entries")
      .insert(payload)
      .select("*")
      .single();

    if (!error) {
      return data;
    }

    lastError = error;

    const missingColumn = getMissingColumnFromError(error?.message);

    if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
      const nextPayload = { ...payload };
      delete nextPayload[missingColumn];
      payload = nextPayload;
      continue;
    }

    throw error;
  }

  throw lastError || new Error("Unable to save mileage entry.");
}

function stripUndefinedValues(payload) {
  return Object.fromEntries(
    Object.entries(payload || {}).filter(([, value]) => value !== undefined)
  );
}

function getMissingColumnFromError(message) {
  const cleanMessage = String(message || "");

  const schemaCacheMatch = cleanMessage.match(
    /Could not find the '([^']+)' column/i
  );

  if (schemaCacheMatch?.[1]) {
    return schemaCacheMatch[1];
  }

  const missingColumnMatch = cleanMessage.match(
    /column "([^"]+)" (?:does not exist|of relation "[^"]+" does not exist)/i
  );

  return missingColumnMatch?.[1] || "";
}

export async function deleteMileageEntry(entryId) {
  if (!entryId) {
    throw new Error("Missing mileage entry id.");
  }

  const { data: existingEntry, error: fetchError } = await supabase
    .from("mileage_entries")
    .select("id, jobber_timesheet_id")
    .eq("id", entryId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from("mileage_entries")
    .delete()
    .eq("id", entryId);

  if (error) throw error;

  if (existingEntry?.jobber_timesheet_id) {
    const { error: timesheetError } = await supabase
      .from("jobber_timesheets")
      .update({
        mileage_entry_id: null,
        mileage_vehicle: null,
        mileage_status: "needs_review",
        mileage_completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingEntry.jobber_timesheet_id);

    if (timesheetError) throw timesheetError;
  }
}

export function getMonthOptionsFromEntries(entries) {
  const monthKeys = new Set();

  for (const entry of entries || []) {
    monthKeys.add(getMonthKeyFromDate(entry.entry_date));
  }

  return Array.from(monthKeys).sort().reverse();
}

export function getEntriesForMonth(entries, monthKey) {
  return (entries || []).filter((entry) => {
    return getMonthKeyFromDate(entry.entry_date) === monthKey;
  });
}

export function getMileageSummary(entries) {
  const totalEntries = entries?.length || 0;

  const totalMiles = (entries || []).reduce((sum, entry) => {
    return sum + calculateEntryMiles(entry);
  }, 0);

  return {
    totalEntries,
    totalMiles,
  };
}
