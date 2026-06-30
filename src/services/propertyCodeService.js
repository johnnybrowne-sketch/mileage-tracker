const DIRECTION_WORDS = new Set([
  "n",
  "north",
  "s",
  "south",
  "e",
  "east",
  "w",
  "west",
]);

const STREET_SUFFIX_WORDS = new Set([
  "ave",
  "avenue",
  "blvd",
  "boulevard",
  "cir",
  "circle",
  "ct",
  "court",
  "dr",
  "drive",
  "hwy",
  "ln",
  "lane",
  "pkwy",
  "parkway",
  "pl",
  "place",
  "rd",
  "road",
  "st",
  "street",
  "ter",
  "terrace",
  "trail",
  "way",
]);

const ORDINAL_PREFIXES = {
  "9": "NI",
  "9th": "NI",
  "10": "TE",
  "10th": "TE",
};

function cleanText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getHouseDigits(value) {
  const match = String(value || "").match(/\d+/);
  return match?.[0] || "";
}

function normalizeStreetWords(value) {
  const rawWords = cleanText(value)
    .split(" ")
    .filter(Boolean);

  const words =
    rawWords.length > 1
      ? rawWords.filter((word) => !DIRECTION_WORDS.has(word))
      : rawWords;

  while (words.length > 1 && STREET_SUFFIX_WORDS.has(words.at(-1))) {
    words.pop();
  }

  return words;
}

function getStreetPrefix(streetName) {
  const firstWord = normalizeStreetWords(streetName)[0] || "";

  if (!firstWord) return "";
  if (ORDINAL_PREFIXES[firstWord]) return ORDINAL_PREFIXES[firstWord];

  const letters = firstWord.replace(/[^a-z]/g, "");
  return letters.slice(0, 2).toUpperCase();
}

function parseAddress(address) {
  const cleanAddress = String(address || "").trim();
  const match = cleanAddress.match(/^([NSEW]?\d+[A-Z]?)\s+(.+)$/i);

  if (!match) {
    return {
      houseDigits: "",
      streetName: cleanAddress,
    };
  }

  return {
    houseDigits: getHouseDigits(match[1]),
    streetName: match[2],
  };
}

function normalizePropertyStreet(property) {
  return normalizeStreetWords(
    [
      property?.street_name,
      property?.street_type,
      property?.street_ave,
      property?.street,
    ]
      .filter(Boolean)
      .join(" ")
  ).join(" ");
}

function normalizeAddressStreet(address) {
  return normalizeStreetWords(parseAddress(address).streetName).join(" ");
}

function getPropertyHouseDigits(property) {
  return getHouseDigits(property?.house_number || property?.address || "");
}

export function derivePropertyCodeFromAddress(address) {
  const { houseDigits, streetName } = parseAddress(address);
  const streetPrefix = getStreetPrefix(streetName);

  if (!streetPrefix || !houseDigits) return "";

  const numberPart = houseDigits.length === 3 ? `${houseDigits}X` : houseDigits;
  return `${streetPrefix}${numberPart}`;
}

export function findPropertyByAddress(address, properties = []) {
  const { houseDigits } = parseAddress(address);
  const addressStreet = normalizeAddressStreet(address);

  if (!houseDigits || !addressStreet) return null;

  return (
    (properties || []).find((property) => {
      return (
        getPropertyHouseDigits(property) === houseDigits &&
        normalizePropertyStreet(property) === addressStreet
      );
    }) || null
  );
}

export function resolvePropertyCode({ address, properties = [], fallbackCode = "" }) {
  const matchedProperty = findPropertyByAddress(address, properties);

  return (
    matchedProperty?.property_code ||
    derivePropertyCodeFromAddress(address) ||
    fallbackCode ||
    ""
  );
}
