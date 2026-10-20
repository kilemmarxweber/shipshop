export const COUNTRY_DIALS = [
  { iso: "CD", label: "RDC", dial: "+243", min: 9, max: 9 },
  { iso: "CG", label: "Congo-Brazzaville", dial: "+242", min: 9, max: 9 },
  { iso: "AO", label: "Angola", dial: "+244", min: 9, max: 9 },
  { iso: "RW", label: "Rwanda", dial: "+250", min: 9, max: 9 },
  { iso: "BI", label: "Burundi", dial: "+257", min: 8, max: 8 },
  { iso: "UG", label: "Ouganda", dial: "+256", min: 9, max: 9 },
  { iso: "TZ", label: "Tanzanie", dial: "+255", min: 9, max: 9 },
  { iso: "KE", label: "Kenya", dial: "+254", min: 9, max: 9 },
  { iso: "CM", label: "Cameroun", dial: "+237", min: 9, max: 9 },
  { iso: "GA", label: "Gabon", dial: "+241", min: 7, max: 8 },
  { iso: "CF", label: "Centrafrique", dial: "+236", min: 8, max: 8 },
  { iso: "TD", label: "Tchad", dial: "+235", min: 8, max: 8 },
  { iso: "NG", label: "Nigeria", dial: "+234", min: 10, max: 10 },
  { iso: "GH", label: "Ghana", dial: "+233", min: 9, max: 9 },
  { iso: "SN", label: "Sénégal", dial: "+221", min: 9, max: 9 },
  { iso: "CI", label: "Côte d'Ivoire", dial: "+225", min: 10, max: 10 },
  { iso: "ZA", label: "Afrique du Sud", dial: "+27", min: 9, max: 9 },
  { iso: "PT", label: "Portugal", dial: "+351", min: 9, max: 9 },
  { iso: "FR", label: "France", dial: "+33", min: 9, max: 9 },
  { iso: "BE", label: "Belgique", dial: "+32", min: 8, max: 9 },
  { iso: "DE", label: "Allemagne", dial: "+49", min: 10, max: 11 },
  { iso: "GB", label: "Royaume-Uni", dial: "+44", min: 10, max: 10 },
  { iso: "US", label: "USA / Canada", dial: "+1", min: 10, max: 10 },
] as const;

export type CountryDial = (typeof COUNTRY_DIALS)[number];

export const DEFAULT_DIAL = "+243";

export function countryByDial(dial: string): CountryDial {
  return COUNTRY_DIALS.find((c) => c.dial === dial) ?? COUNTRY_DIALS[0];
}

/** Drapeau emoji depuis le code ISO (CD → 🇨🇩). */
export function flagEmoji(iso: string) {
  return [...iso.toUpperCase()]
    .map((ch) => String.fromCodePoint(0x1f1e6 - 65 + ch.charCodeAt(0)))
    .join("");
}

export function countryMatches(country: CountryDial, query: string) {
  const q = query.trim().toLowerCase().replace(/^00/, "+");
  if (!q) return true;
  const hay = `${country.label} ${country.iso} ${country.dial}`.toLowerCase();
  const digits = q.replace(/\D/g, "");
  return (
    hay.includes(q) ||
    (digits.length > 0 && country.dial.includes(digits))
  );
}

function digitsAndPlus(raw: string) {
  return raw.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

export function nationalDigits(raw: string, max?: number) {
  const n = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (max != null) return n.slice(0, max);
  return n;
}

export function splitPhone(raw: string): { dial: string; national: string } {
  const cleaned = digitsAndPlus(raw.trim());
  if (!cleaned) return { dial: DEFAULT_DIAL, national: "" };

  const e164 = cleaned.startsWith("00")
    ? `+${cleaned.slice(2)}`
    : cleaned.startsWith("+")
      ? cleaned
      : cleaned;

  const ranked = [...COUNTRY_DIALS].sort(
    (a, b) => b.dial.length - a.dial.length,
  );
  for (const c of ranked) {
    if (e164.startsWith(c.dial)) {
      return {
        dial: c.dial,
        national: nationalDigits(e164.slice(c.dial.length), c.max),
      };
    }
    const noPlus = c.dial.slice(1);
    if (!e164.startsWith("+") && e164.startsWith(noPlus)) {
      return {
        dial: c.dial,
        national: nationalDigits(e164.slice(noPlus.length), c.max),
      };
    }
  }

  const fallback = countryByDial(DEFAULT_DIAL);
  return {
    dial: DEFAULT_DIAL,
    national: nationalDigits(e164.replace(/^\+/, ""), fallback.max),
  };
}

export function composePhone(dial: string, national: string) {
  const country = countryByDial(dial);
  const n = nationalDigits(national, country.max);
  if (!n) return "";
  return `${country.dial}${n}`;
}

export function isValidContactPhone(raw: string) {
  const parts = splitPhone(raw);
  const country = countryByDial(parts.dial);
  const n = nationalDigits(parts.national, country.max);
  return n.length >= country.min && n.length <= country.max;
}

export function looksLikeEmail(raw: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

/** Saisie identifiant : lettres / @ = e-mail, sinon téléphone. */
export function looksLikeEmailInput(raw: string) {
  return /[A-Za-z@]/.test(raw.trim());
}

export function normalizeAccountPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || looksLikeEmailInput(trimmed)) return null;
  const parts = splitPhone(trimmed);
  const e164 = composePhone(parts.dial, parts.national);
  return isValidContactPhone(e164) ? e164 : null;
}
