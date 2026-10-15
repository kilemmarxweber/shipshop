import { KINSHASA_COMMUNES } from "@/lib/kinshasa-geo";

type ZoneKind = "CENTER" | "REMOTE";

const CENTER = new Set([
  "Gombe",
  "Barumbu",
  "Kinshasa",
  "Lingwala",
  "Kintambo",
  "Kasa-Vubu",
  "Kalamu",
  "Ngiri-Ngiri",
  "Bandalungwa",
  "Limete",
]);

/** Centroïdes approximatifs pour devis km. */
const COORDS: Record<string, { lat: number; lng: number }> = {
  Gombe: { lat: -4.305, lng: 15.311 },
  Barumbu: { lat: -4.31, lng: 15.32 },
  Kinshasa: { lat: -4.3276, lng: 15.3136 },
  Lingwala: { lat: -4.32, lng: 15.3 },
  Kintambo: { lat: -4.33, lng: 15.27 },
  "Kasa-Vubu": { lat: -4.335, lng: 15.29 },
  Kalamu: { lat: -4.34, lng: 15.3 },
  "Ngiri-Ngiri": { lat: -4.345, lng: 15.285 },
  Bandalungwa: { lat: -4.34, lng: 15.27 },
  Selembao: { lat: -4.37, lng: 15.26 },
  Bumbu: { lat: -4.36, lng: 15.28 },
  Makala: { lat: -4.365, lng: 15.295 },
  Ngaba: { lat: -4.38, lng: 15.31 },
  Limete: { lat: -4.36, lng: 15.34 },
  Matete: { lat: -4.39, lng: 15.34 },
  Lemba: { lat: -4.4, lng: 15.32 },
  Ngaliema: { lat: -4.34, lng: 15.25 },
  "Mont-Ngafula": { lat: -4.42, lng: 15.27 },
  Kisenso: { lat: -4.41, lng: 15.36 },
  Masina: { lat: -4.38, lng: 15.4 },
  Ndjili: { lat: -4.4, lng: 15.38 },
  Kimbanseke: { lat: -4.42, lng: 15.42 },
  Nsele: { lat: -4.38, lng: 15.5 },
  Maluku: { lat: -4.2, lng: 15.55 },
};

export function buildKinshasaDeliveryZones() {
  return KINSHASA_COMMUNES.map((c) => {
    const kind: ZoneKind = CENTER.has(c.name) ? "CENTER" : "REMOTE";
    const coords = COORDS[c.name] ?? { lat: -4.33, lng: 15.31 };
    return {
      commune: c.name,
      name: `${kind === "CENTER" ? "Centre" : "Périphérie"} ${c.name}`,
      kind,
      baseCents: kind === "CENTER" ? 250 : 500,
      ratePerKmCents: kind === "CENTER" ? 55 : 100,
      centerLat: coords.lat,
      centerLng: coords.lng,
    };
  });
}
