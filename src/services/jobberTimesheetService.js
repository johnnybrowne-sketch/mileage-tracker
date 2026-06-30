import { supabase } from "../lib/supabaseClient";

export async function getWorkerJobberTimesheets(workerEmail) {
  if (!workerEmail) return [];

  const { data, error } = await supabase
    .from("jobber_timesheets")
    .select("*")
    .eq("worker_email", workerEmail.toLowerCase())
    .order("start_at", { ascending: false });

  if (error) throw error;

  return filterActiveJobberTimesheets(data);
}

export async function getAllJobberTimesheets() {
  const { data, error } = await supabase
    .from("jobber_timesheets")
    .select("*")
    .order("start_at", { ascending: false });

  if (error) throw error;

  return filterActiveJobberTimesheets(data);
}

export async function getJobberTimesheetById(timesheetId) {
  if (!timesheetId) return null;

  const { data, error } = await supabase
    .from("jobber_timesheets")
    .select("*")
    .eq("id", timesheetId)
    .single();

  if (error) throw error;

  return isTimesheetCancelled(data) ? null : data;
}

export async function getIncompleteJobberTimesheets(workerEmail = null) {
  let query = supabase
    .from("jobber_timesheets")
    .select("*")
    .neq("mileage_status", "completed");

  if (workerEmail) {
    query = query.eq("worker_email", workerEmail.toLowerCase());
  }

  const { data, error } = await query.order("start_at", {
    ascending: false,
  });

  if (error) throw error;

  return filterActiveJobberTimesheets(data);
}

export async function removeJobberTimesheet({
  timesheetId,
  removedBy = "",
  removedByRole = "worker",
  reason = "Removed from Mileage Tracker review.",
}) {
  if (!timesheetId) {
    throw new Error("Jobber timesheet is missing.");
  }

  const now = new Date().toISOString();

  const { error: linkedMileageError } = await supabase
    .from("mileage_entries")
    .delete()
    .eq("jobber_timesheet_id", timesheetId);

  if (linkedMileageError) {
    throw linkedMileageError;
  }

  const { data, error } = await supabase
    .from("jobber_timesheets")
    .update({
      is_cancelled: true,
      cancelled_at: now,
      cancelled_by: removedBy || null,
      cancelled_by_role: removedByRole || null,
      cancel_reason: reason || null,
      mileage_entry_id: null,
      mileage_vehicle: null,
      mileage_status: "cancelled",
      mileage_completed_at: null,
      updated_at: now,
    })
    .eq("id", timesheetId)
    .select("id")
    .maybeSingle();

  if (!error) {
    return data;
  }

  if (!isMissingCancelColumnsError(error)) {
    throw error;
  }

  const { error: deleteError } = await supabase
    .from("jobber_timesheets")
    .delete()
    .eq("id", timesheetId);

  if (deleteError) {
    throw deleteError;
  }

  return { id: timesheetId, deleted: true };
}

export function formatTimesheetDuration(minutes) {
  const totalMinutes = Number(minutes || 0);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = Math.round(totalMinutes % 60);

  if (hours === 0) return `${remainingMinutes} min`;

  return `${hours} hr ${remainingMinutes} min`;
}

export function getTimesheetMonthKey(timesheet) {
  const dateValue = timesheet?.start_at || timesheet?.end_at || "";
  const stringValue = String(dateValue || "").trim();

  if (/^\d{4}-\d{2}/.test(stringValue)) {
    return stringValue.slice(0, 7);
  }

  const date = new Date(stringValue);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getTimesheetDateInputValue(timesheet) {
  const dateValue = timesheet?.start_at || timesheet?.end_at || "";
  const stringValue = String(dateValue || "").trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(stringValue)) {
    return stringValue.slice(0, 10);
  }

  const date = new Date(stringValue);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function getTimesheetMileageStatus(timesheet) {
  return String(timesheet?.mileage_status || "needs_review").toLowerCase();
}

export function isTimesheetCancelled(timesheet) {
  const status = getTimesheetMileageStatus(timesheet);

  return Boolean(
    status === "cancelled" ||
      timesheet?.is_cancelled === true ||
      String(timesheet?.is_cancelled || "").toLowerCase() === "true" ||
      timesheet?.cancelled_at
  );
}

export function isTimesheetMileageCompleted(timesheet) {
  return getTimesheetMileageStatus(timesheet) === "completed";
}

export function isActiveJob(timesheet) {
  return timesheet?.label === "Active Job";
}

export function getTimesheetDisplayTitle(timesheet) {
  if (!timesheet) return "";

  if (timesheet.jobber_job_title) {
    return timesheet.jobber_job_title;
  }

  return timesheet.label || "Timesheet Entry";
}

export function getTimesheetPropertyCode(timesheet) {
  return (
    timesheet?.jobber_property_id ||
    timesheet?.jobber_time_entry_id ||
    timesheet?.id ||
    ""
  );
}

export function getTimesheetPropertyDisplay(timesheet) {
  return (
    timesheet?.jobber_property_address ||
    timesheet?.jobber_job_title ||
    timesheet?.label ||
    "Jobber Timesheet"
  );
}

export function getTimesheetMileagePurpose(timesheet) {
  return [timesheet?.note, timesheet?.label ? `Timesheet: ${timesheet.label}` : ""]
    .filter(Boolean)
    .join(" - ");
}

export function mapTimesheetToMileageJobberFields(timesheet) {
  if (!timesheet) return null;

  return {
    jobberVisitId: null,
    jobberJobId: timesheet.jobber_job_id || null,
    jobberClientId: timesheet.jobber_client_id || null,
    jobberPropertyId: timesheet.jobber_property_id || null,
    jobberJobNumber: timesheet.jobber_job_number || null,
    jobberJobTitle: timesheet.jobber_job_title || null,
    jobberClientName: timesheet.jobber_client_name || null,
    jobberPropertyAddress: timesheet.jobber_property_address || null,
  };
}

function filterActiveJobberTimesheets(timesheets = []) {
  return (timesheets || []).filter((timesheet) => !isTimesheetCancelled(timesheet));
}

function isMissingCancelColumnsError(error) {
  const text = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("is_cancelled") ||
    text.includes("cancelled_at") ||
    text.includes("cancelled_by") ||
    text.includes("cancel_reason") ||
    text.includes("schema cache") ||
    text.includes("column")
  );
}
