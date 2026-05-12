import { supabase } from "../lib/supabaseClient";

export function formatPropertyDisplay(property) {
  if (!property) {
    return "";
  }

  if (property.display_name?.trim()) {
    return property.display_name.trim();
  }

  const addressParts = [
    property.house_number,
    property.street_name,
    property.street_type,
  ].filter(Boolean);

  const address = addressParts.join(" ").trim();

  if (address && property.city) {
    return `${property.property_code} — ${address}, ${property.city}`;
  }

  if (address) {
    return `${property.property_code} — ${address}`;
  }

  return property.property_code || "Unnamed Property";
}

export async function getProperties() {
  const { data, error } = await supabase
    .from("properties")
    .select(
      `
      id,
      property_code,
      house_number,
      street_name,
      street_type,
      city,
      zip_code,
      display_name
    `
    )
    .order("property_code", { ascending: true })
    .limit(1000);

  if (error) {
    throw error;
  }

  return (data || []).map((property) => ({
    ...property,
    display_label: formatPropertyDisplay(property),
  }));
}