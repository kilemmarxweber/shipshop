import { haversineKm } from "@/lib/shipping";

/** Facteur embouteillage Kinshasa selon l'heure locale (Africa/Kinshasa ≈ UTC+1). */
export function kinshasaTrafficFactor(now = new Date()): number {
  const hour = (now.getUTCHours() + 1) % 24;
  // Pointes matin / soir
  if ((hour >= 7 && hour < 10) || (hour >= 16 && hour < 20)) return 1.85;
  // Journée
  if (hour >= 10 && hour < 16) return 1.35;
  // Soirée / nuit
  if (hour >= 20 && hour < 23) return 1.2;
  return 1.05;
}

/** Vitesse moyenne moto-taxi (km/h) hors trafic. */
const BASE_SPEED_KMH = 28;

export type EtaResult = {
  distanceKm: number;
  etaMinutes: number;
  etaAt: Date;
  trafficFactor: number;
  etaText: string;
};

export function estimateCourierEta(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  opts?: { remoteZone?: boolean; now?: Date },
): EtaResult {
  const now = opts?.now ?? new Date();
  const distanceKm = Math.max(
    0.1,
    Math.round(haversineKm(fromLat, fromLng, toLat, toLng) * 10) / 10,
  );
  let factor = kinshasaTrafficFactor(now);
  if (opts?.remoteZone) factor *= 1.15;

  const hours = distanceKm / BASE_SPEED_KMH;
  const etaMinutes = Math.max(5, Math.ceil(hours * 60 * factor));
  const etaAt = new Date(now.getTime() + etaMinutes * 60_000);
  const etaText =
    etaMinutes < 60
      ? `${etaMinutes} min`
      : `${Math.floor(etaMinutes / 60)} h ${etaMinutes % 60} min`;

  return { distanceKm, etaMinutes, etaAt, trafficFactor: factor, etaText };
}

export function metersBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}
