/** Compose une adresse lisible style HK+ (avenue / n° parcelle / quartier / commune / ville). */

export type AddressParts = {
  city: string;
  commune?: string | null;
  quartier?: string | null;
  avenue?: string | null;
  parcelle?: string | null;
};

/** Ligne unique : ville, commune, quartier, avenue, n° — séparés par des virgules. */
export function composeAddressLine(parts: AddressParts): string {
  return [
    parts.city,
    parts.commune,
    parts.quartier,
    parts.avenue,
    parts.parcelle,
  ]
    .map((p) => p?.trim() ?? "")
    .filter((p) => p.length > 0)
    .join(", ");
}

export function parseAddressLine(
  raw: string,
  fallbackCity = "Kinshasa",
): AddressParts {
  const bits = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return {
    city: bits[0] || fallbackCity,
    commune: bits[1] ?? "",
    quartier: bits[2] ?? "",
    avenue: bits[3] ?? "",
    parcelle: bits.slice(4).join(", "),
  };
}

export function composeAddress(parts: AddressParts): string {
  const city = parts.city.trim();
  const chunks: string[] = [];

  const avenue = parts.avenue?.trim();
  const parcelle = parts.parcelle?.trim();
  if (avenue) {
    chunks.push(parcelle ? `Av. ${avenue} n° ${parcelle}` : `Av. ${avenue}`);
  } else if (parcelle) {
    chunks.push(`Parcelle n° ${parcelle}`);
  }

  const quartier = parts.quartier?.trim();
  if (quartier) chunks.push(`Q. ${quartier}`);

  const commune = parts.commune?.trim();
  if (commune) chunks.push(`C. ${commune}`);

  chunks.push(city);
  return chunks.join(", ");
}
