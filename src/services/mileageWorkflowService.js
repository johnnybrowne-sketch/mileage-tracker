export const mileageBucketLabels = {
  jobber_job: "Jobber Job",
  general_business: "General Business",
  personal_excluded: "Personal Excluded",
};

export const generalBusinessOptions = [
  { value: "office_admin", label: "Office / Admin" },
  { value: "supply_run", label: "Supply Run" },
  { value: "bank_deposit", label: "Bank Deposit" },
  { value: "maintenance_materials", label: "Maintenance / Materials" },
  { value: "showing_inspection", label: "Showing / Inspection" },
  { value: "lockbox_keys", label: "Lockbox / Keys" },
  { value: "sign_marketing", label: "Sign / Marketing" },
  { value: "meeting_training", label: "Meeting / Training" },
  { value: "fuel_vehicle_service", label: "Fuel / Vehicle Service" },
  { value: "other_business", label: "Other Business" },
];

export function getMileageBucketLabelForEntry(entry = {}, timesheet = null) {
  const savedBucket = normalizeSavedValue(entry.mileage_bucket || entry.mileage_type);

  if (mileageBucketLabels[savedBucket]) {
    return mileageBucketLabels[savedBucket];
  }

  if (hasJobberEntry(entry, timesheet)) {
    return mileageBucketLabels.jobber_job;
  }

  if (isPersonalVehicleLabel(getEntryVehicle(entry))) {
    return mileageBucketLabels.personal_excluded;
  }

  return mileageBucketLabels.general_business;
}

export function buildMileageWorkflowFields({
  jobberVisit = null,
  jobberTimesheetId = null,
  vehicleName = "",
  startOdometer = "",
  expectedStartOdometer = startOdometer,
  odometerOverrideReason = "",
  purpose = "",
}) {
  const enteredStart = toNumberOrNull(startOdometer);
  const expectedStart = toNumberOrNull(expectedStartOdometer);
  const startWasConfirmed =
    expectedStart !== null && enteredStart !== null && expectedStart === enteredStart;
  const unattributedMiles =
    expectedStart !== null && enteredStart !== null && enteredStart > expectedStart
      ? enteredStart - expectedStart
      : 0;

  return {
    vehicle_key: getVehicleKey(vehicleName),
    mileage_bucket: getMileageBucketValueForTrip({
      jobberVisit,
      jobberTimesheetId,
      vehicleName,
    }),
    business_category: getBusinessCategoryValueForTrip({
      jobberVisit,
      jobberTimesheetId,
      vehicleName,
      purpose,
    }),
    business_note: String(purpose || "").trim() || null,
    odometer_expected_start: expectedStart,
    odometer_start_confirmed: startWasConfirmed,
    odometer_override_reason: startWasConfirmed
      ? null
      : String(odometerOverrideReason || "").trim() || null,
    unattributed_miles: unattributedMiles,
  };
}

export function getMileageBucketValueForTrip({
  jobberVisit = null,
  jobberTimesheetId = null,
  vehicleName = "",
}) {
  if (jobberVisit || jobberTimesheetId) {
    return "jobber_job";
  }

  if (isPersonalVehicleLabel(vehicleName)) {
    return "personal_excluded";
  }

  return "general_business";
}

export function getBusinessCategoryValueForTrip({
  jobberVisit = null,
  jobberTimesheetId = null,
  vehicleName = "",
  purpose = "",
}) {
  if (jobberVisit || jobberTimesheetId) {
    return "jobber_job";
  }

  if (isPersonalVehicleLabel(vehicleName)) {
    return "personal_excluded";
  }

  const normalizedPurpose = normalizeSavedValue(purpose);
  const matchedOption = generalBusinessOptions.find((option) => {
    return normalizedPurpose.includes(option.value);
  });

  return matchedOption?.value || "other_business";
}

export function getVehicleKey(vehicleName) {
  return String(vehicleName || "")
    .trim()
    .toLowerCase()
    .replace(/\s*-\s*/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getBusinessCategoryLabelForEntry(entry = {}, timesheet = null) {
  const savedCategory = normalizeSavedValue(
    entry.business_category || entry.general_business_category
  );
  const savedOption = generalBusinessOptions.find(
    (option) => option.value === savedCategory
  );

  if (savedOption) {
    return savedOption.label;
  }

  if (hasJobberEntry(entry, timesheet)) {
    return (
      entry.jobber_job_title ||
      timesheet?.jobber_job_title ||
      entry.jobber_job_number ||
      timesheet?.jobber_job_number ||
      "Jobber Job"
    );
  }

  if (isPersonalVehicleLabel(getEntryVehicle(entry))) {
    return "Personal Excluded";
  }

  const purpose = String(entry.business_note || entry.purpose || entry.notes || "");
  const matchedOption = generalBusinessOptions.find((option) => {
    return normalizeSavedValue(purpose).includes(option.value);
  });

  return matchedOption?.label || "General Business";
}

function hasJobberEntry(entry, timesheet) {
  return Boolean(
    timesheet ||
      entry?.jobber_timesheet_id ||
      entry?.jobber_visit_id ||
      entry?.jobber_job_id ||
      entry?.jobber_job_title ||
      entry?.jobber_client_name ||
      entry?.jobber_property_address
  );
}

function getEntryVehicle(entry) {
  return entry?.vehicle || entry?.vehicle_name || entry?.vehicle_display || "";
}

function isPersonalVehicleLabel(value) {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ");

  return (
    normalizedValue === "personal" ||
    normalizedValue.startsWith("personal -") ||
    normalizedValue.endsWith("- personal")
  );
}

function normalizeSavedValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
}
