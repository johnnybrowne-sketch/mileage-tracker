import { supabase } from "../lib/supabaseClient";
import {
  expandFleetVehicleOptions,
  getVehicleDisplayName,
} from "./fleetVehicleService";

function normalizeVehicleName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ");
}

function getCleanVehicleDisplayName(vehicleName) {
  const name = String(vehicleName || "").trim();

  if (/ - personal$/i.test(name)) {
    return "Personal";
  }

  if (/^personal$/i.test(name)) {
    return "Personal";
  }

  return name;
}

export async function getWorkerVehicles(workerId) {
  if (!workerId) {
    return [];
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("worker_vehicle_assignments")
    .select("vehicle_id, is_active")
    .eq("worker_id", workerId)
    .eq("is_active", true);

  if (assignmentsError) {
    throw assignmentsError;
  }

  const assignedVehicleIds = new Set(
    (assignments || []).map((assignment) => assignment.vehicle_id)
  );

  const { data: vehicles, error: vehiclesError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("is_active", true)
    .order("vehicle_name", { ascending: true });

  if (vehiclesError) {
    throw vehiclesError;
  }

  const filteredVehicles = (vehicles || []).filter((vehicle) => {
    return (
      vehicle.is_company_vehicle === true ||
      vehicle.user_id === workerId ||
      assignedVehicleIds.has(vehicle.id)
    );
  });

  const uniqueVehiclesMap = new Map();

  for (const vehicle of expandFleetVehicleOptions(filteredVehicles)) {
    const displayName = getCleanVehicleDisplayName(getVehicleDisplayName(vehicle));
    const normalizedKey = normalizeVehicleName(displayName);

    if (!normalizedKey) {
      continue;
    }

    const existingVehicle = uniqueVehiclesMap.get(normalizedKey);

    if (!existingVehicle) {
      uniqueVehiclesMap.set(normalizedKey, {
        ...vehicle,
        display_name: displayName,
      });
      continue;
    }

    if (vehicle.is_default && !existingVehicle.is_default) {
      uniqueVehiclesMap.set(normalizedKey, {
        ...vehicle,
        display_name: displayName,
      });
    }
  }

  return Array.from(uniqueVehiclesMap.values()).sort((a, b) => {
    if (a.display_name === "Personal") return -1;
    if (b.display_name === "Personal") return 1;

    return a.display_name.localeCompare(b.display_name);
  });
}
