import { supabase } from "../lib/supabaseClient";
import { getVehicleKey } from "./mileageWorkflowService";

export async function getVehicleOdometerStates() {
  const { data, error } = await supabase
    .from("vehicle_odometer_states")
    .select("*")
    .order("vehicle_key", { ascending: true });

  if (error) {
    console.warn("Unable to load vehicle odometer states.", error);
    return [];
  }

  return data || [];
}

export function getExpectedVehicleStart({
  states = [],
  vehicle = null,
  vehicleName = "",
  fallbackOdometer = "",
}) {
  const displayName = vehicleName || getVehicleLabel(vehicle);
  const isSharedVehicle = isSharedCompanyVehicle({ vehicle, vehicleName: displayName });

  if (!isSharedVehicle) {
    return {
      expectedStartOdometer: fallbackOdometer,
      isSharedVehicle: false,
      vehicleKey: "",
      sourceLabel: fallbackOdometer ? "Last personal entry" : "No previous personal entry",
    };
  }

  const state = findVehicleOdometerState(states, { vehicle, vehicleName: displayName });
  const currentOdometer =
    state?.current_odometer !== null && state?.current_odometer !== undefined
      ? state.current_odometer
      : 0;

  return {
    expectedStartOdometer: String(currentOdometer),
    isSharedVehicle: true,
    state,
    vehicleKey: getVehicleKey(displayName),
    sourceLabel: state ? "Shared company odometer" : "New company vehicle baseline",
  };
}

export function requiresOdometerOverride({
  isSharedVehicle,
  startOdometer,
  expectedStartOdometer,
}) {
  if (!isSharedVehicle) return false;

  const start = toNumberOrNull(startOdometer);
  const expected = toNumberOrNull(expectedStartOdometer);

  if (start === null || expected === null) return false;

  return start !== expected;
}

export async function syncVehicleOdometerAfterMileage({
  vehicle = null,
  vehicleId = "",
  vehicleName = "",
  workerId = "",
  mileageEntryId = "",
  startOdometer = "",
  expectedStartOdometer = "",
  endOdometer = "",
  overrideReason = "",
  updatedBy = "",
}) {
  const displayName = vehicleName || getVehicleLabel(vehicle);
  const isSharedVehicle = isSharedCompanyVehicle({ vehicle, vehicleName: displayName });

  if (!isSharedVehicle) {
    return;
  }

  const end = toNumberOrNull(endOdometer);
  if (end === null) {
    return;
  }

  const vehicleKey = getVehicleKey(displayName);
  const cleanVehicleId = String(vehicleId || getVehicleId(vehicle) || "").trim();
  const expectedStart = toNumberOrNull(expectedStartOdometer);
  const enteredStart = toNumberOrNull(startOdometer);
  const unattributedMiles =
    expectedStart !== null && enteredStart !== null && enteredStart > expectedStart
      ? enteredStart - expectedStart
      : 0;
  const { data: existingState, error: existingStateError } = await supabase
    .from("vehicle_odometer_states")
    .select("current_odometer")
    .eq("vehicle_key", vehicleKey)
    .maybeSingle();

  if (existingStateError) {
    console.warn("Unable to read shared vehicle odometer.", existingStateError);
  }

  const existingOdometer = toNumberOrNull(existingState?.current_odometer);
  const shouldAdvanceOdometer = existingOdometer === null || end >= existingOdometer;

  if (!shouldAdvanceOdometer) {
    console.warn(
      `Skipped shared odometer update for ${vehicleKey}; ${end} is lower than current ${existingOdometer}.`
    );
  }

  if (shouldAdvanceOdometer) {
    const { error: stateError } = await supabase
      .from("vehicle_odometer_states")
      .upsert(
        {
          vehicle_key: vehicleKey,
          vehicle_id: cleanVehicleId || null,
          current_odometer: end,
          last_mileage_entry_id: mileageEntryId || null,
          last_worker_id: workerId || null,
          updated_by: updatedBy || workerId || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "vehicle_key" }
      );

    if (stateError) {
      console.warn("Unable to update shared vehicle odometer.", stateError);
      return;
    }
  }

  if (
    requiresOdometerOverride({
      isSharedVehicle,
      startOdometer,
      expectedStartOdometer,
    })
  ) {
    const { error: auditError } = await supabase
      .from("odometer_override_audits")
      .insert({
        mileage_entry_id: mileageEntryId || null,
        vehicle_key: vehicleKey,
        vehicle_id: cleanVehicleId || null,
        worker_id: workerId || null,
        expected_start_odometer: expectedStart,
        entered_start_odometer: enteredStart,
        override_reason: overrideReason || null,
        unattributed_miles: unattributedMiles,
      });

    if (auditError) {
      console.warn("Unable to save odometer override audit.", auditError);
    }
  }
}

function findVehicleOdometerState(states, { vehicle, vehicleName }) {
  const vehicleKey = getVehicleKey(vehicleName);
  const vehicleId = String(getVehicleId(vehicle) || "").trim();

  return (
    (states || []).find((state) => {
      return (
        (vehicleKey && state.vehicle_key === vehicleKey) ||
        (vehicleId && String(state.vehicle_id || "") === vehicleId)
      );
    }) || null
  );
}

function isSharedCompanyVehicle({ vehicle, vehicleName }) {
  if (isPersonalVehicleLabel(vehicleName)) {
    return false;
  }

  if (vehicle && Object.prototype.hasOwnProperty.call(vehicle, "is_company_vehicle")) {
    return (
      vehicle.is_company_vehicle === true ||
      String(vehicle.is_company_vehicle).toLowerCase() === "true"
    );
  }

  return Boolean(String(vehicleName || "").trim());
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

function getVehicleLabel(vehicle) {
  return vehicle?.display_name || vehicle?.vehicle_name || vehicle?.name || "";
}

function getVehicleId(vehicle) {
  return vehicle?.id || vehicle?.vehicle_id || "";
}

function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
}
