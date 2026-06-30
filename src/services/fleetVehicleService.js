const DEFAULT_FLEET_UNIT_RULES = [
  {
    match: ["transit"],
    units: ["Van #1", "Van #2", "Van #3", "Van #4", "Van #5"],
  },
  {
    match: ["promaster", "road master", "roadmaster", "tall boy"],
    units: ["Tall Boy #6", "Tall Boy #7"],
  },
];

export function expandFleetVehicleOptions(vehicles = []) {
  return (vehicles || []).flatMap((vehicle) => {
    const baseDisplayName = getVehicleDisplayName(vehicle);
    const units = getFleetUnitsForVehicle(vehicle, baseDisplayName);

    if (!units.length) {
      return [
        {
          ...vehicle,
          display_name: baseDisplayName,
          base_vehicle_id: vehicle.id || vehicle.vehicle_id || "",
        },
      ];
    }

    return units.map((unit) => {
      const unitSlug = slugify(unit);

      return {
        ...vehicle,
        id: `${vehicle.id || baseDisplayName}__unit__${unitSlug}`,
        base_vehicle_id: vehicle.id || vehicle.vehicle_id || "",
        vehicle_unit: unit,
        vehicle_subclass: unit,
        display_name: `${baseDisplayName} - ${unit}`,
        vehicle_name: `${baseDisplayName} - ${unit}`,
      };
    });
  });
}

export function getVehicleDisplayName(vehicle) {
  if (!vehicle) return "";

  return (
    vehicle.display_name ||
    vehicle.vehicle_display ||
    vehicle.vehicle_name ||
    vehicle.name ||
    [vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
    ""
  );
}

export function getBaseVehicleId(vehicle) {
  return vehicle?.base_vehicle_id || vehicle?.vehicle_id || vehicle?.id || "";
}

function getFleetUnitsForVehicle(vehicle, baseDisplayName) {
  if (isSpecificVehicleUnit(vehicle, baseDisplayName)) {
    return [];
  }

  const explicitUnits = parseExplicitUnits(
    vehicle?.fleet_units ||
      vehicle?.vehicle_units ||
      vehicle?.subclass_units ||
      vehicle?.subclasses
  );

  if (explicitUnits.length > 0) {
    return explicitUnits;
  }

  const searchText = normalizeText(
    [
      baseDisplayName,
      vehicle?.title,
      vehicle?.description,
      vehicle?.subclass,
      vehicle?.vehicle_subclass,
      vehicle?.make,
      vehicle?.model,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const matchedRule = DEFAULT_FLEET_UNIT_RULES.find((rule) => {
    return rule.match.some((matchText) => searchText.includes(matchText));
  });

  return matchedRule?.units || [];
}

function isSpecificVehicleUnit(vehicle, baseDisplayName) {
  const searchText = normalizeText(
    [
      baseDisplayName,
      vehicle?.title,
      vehicle?.vehicle_unit,
      vehicle?.vehicle_subclass,
      vehicle?.subclass,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return (
    /\bvan\s*#?\s*[1-9]\b/.test(searchText) ||
    /\btransit\s*[1-9]\b/.test(searchText) ||
    /\btall\s*boy\s*#?\s*[1-9]\b/.test(searchText)
  );
}

function parseExplicitUnits(value) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value !== "string") {
    return [];
  }

  const cleanValue = value.trim();
  if (!cleanValue) return [];

  try {
    const parsedValue = JSON.parse(cleanValue);

    if (Array.isArray(parsedValue)) {
      return parsedValue.map(String).map((item) => item.trim()).filter(Boolean);
    }
  } catch {
    // Not JSON; split as plain text below.
  }

  return cleanValue
    .split(/[,;\n|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
