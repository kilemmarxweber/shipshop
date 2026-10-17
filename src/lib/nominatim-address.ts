import { KINSHASA_CITY, KINSHASA_COMMUNES } from "@/lib/kinshasa-geo";

export type NominatimReverse = {
  display_name?: string;
  addresstype?: string;
  name?: string;
  category?: string;
  address?: Record<string, string>;
};

export type ParsedKinshasaAddress = {
  city: string;
  commune: string;
  quartier: string;
  avenue: string;
  houseNumber: string;
  displayName: string;
};

const STREET_PREFIX =
  /^(avenue|av\.?|boul(?:evard)?|bd\.?|blvd\.?|rue|route|place|chaussee|chaussée)\s+/i;

const STREET_LIKE =
  /^(avenue|av\.?|boul(?:evard)?|bd\.?|blvd\.?|rue|route|place)\b/i;

export function fold(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Compare « Mont-Ngafula » / « Mont Ngafula » / « Commune de Gombe ». */
export function placeKey(s: string) {
  return fold(s)
    .replace(/^(la|le|les)\s+/, "")
    .replace(/^(commune|ville)\s+(de\s+|d['’])?/, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isKinshasaLabel(s: string | undefined) {
  const n = placeKey(s ?? "");
  return n === "kinshasa" || n.includes("ville de kin");
}

export function isCommuneName(s: string | undefined) {
  const n = placeKey(s ?? "");
  if (!n) return false;
  return KINSHASA_COMMUNES.some((c) => placeKey(c.name) === n);
}

export function officialCommuneName(s: string) {
  const n = placeKey(s);
  return KINSHASA_COMMUNES.find((c) => placeKey(c.name) === n)?.name ?? s.trim();
}

export function inKinshasa(
  a: Record<string, string>,
  lat: number,
  lng: number,
) {
  if (a["ISO3166-2-lvl4"] === "CD-KN") return true;
  if (
    [a.state, a.county, a.region, a.municipality].some((v) =>
      isKinshasaLabel(v),
    )
  ) {
    return true;
  }
  return lat >= -4.55 && lat <= -4.15 && lng >= 15.1 && lng <= 16.35;
}

function stripStreetPrefix(raw: string) {
  return raw.replace(STREET_PREFIX, "").trim();
}

function displayParts(displayName: string | undefined) {
  return (displayName ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

function isNoise(s: string) {
  const n = fold(s);
  return (
    !n ||
    isKinshasaLabel(s) ||
    n === "cd" ||
    n.includes("congo") ||
    n.includes("republique")
  );
}

export function parseNominatimKinshasa(
  data: NominatimReverse,
  lat: number,
  lng: number,
): ParsedKinshasaAddress {
  const a = data.address ?? {};
  const parts = displayParts(data.display_name);
  const kinshasa = inKinshasa(a, lat, lng);
  const city = kinshasa
    ? KINSHASA_CITY
    : a.state && isKinshasaLabel(a.state)
      ? KINSHASA_CITY
      : a.city || a.town || KINSHASA_CITY;

  // city/town OSM à Kinshasa = quartier, pas la commune.
  const communeRaw =
    [
      a.municipality,
      a.city_district,
      a.suburb,
      a.county,
      ...parts,
    ].find((v) => v && isCommuneName(v) && placeKey(v) !== "kinshasa") ?? "";
  const commune = communeRaw ? officialCommuneName(communeRaw) : "";

  const quartierCandidates = [
    a.neighbourhood,
    a.quarter,
    a.city_block,
    // À Kinshasa OSM : city = quartier (Commerce, Révolution), municipality = commune
    a.city,
    a.town,
    a.village,
    a.suburb,
    a.locality,
    a.hamlet,
    ...parts,
  ];

  const quartier =
    quartierCandidates.find((v) => {
      if (!v || isNoise(v)) return false;
      if (commune && fold(v) === fold(commune)) return false;
      if (isCommuneName(v)) return false;
      if (STREET_LIKE.test(v)) return false;
      if (data.addresstype === "amenity" && fold(v) === fold(data.name ?? "")) {
        return false;
      }
      if (a.amenity && fold(v) === fold(a.amenity)) return false;
      return true;
    }) ?? "";

  const streetRaw =
    a.road ||
    a.pedestrian ||
    a.path ||
    a.residential ||
    a.footway ||
    (data.addresstype === "road" ? data.name : "") ||
    parts.find((p) => STREET_LIKE.test(p)) ||
    "";

  const avenue = stripStreetPrefix(streetRaw);
  const houseNumber = (a.house_number || "").trim();

  return {
    city,
    commune,
    quartier,
    avenue,
    houseNumber,
    displayName: data.display_name ?? "",
  };
}
