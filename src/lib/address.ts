/** Compose une adresse lisible style HK+ (avenue / n° parcelle / quartier / commune / ville). */

export type AddressParts = {
  city: string;
  commune?: string | null;
  quartier?: string | null;
  avenue?: string | null;
  parcelle?: string | null;
};

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
