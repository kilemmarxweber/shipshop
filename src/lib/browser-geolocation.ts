/** Précision GPS multi-échantillons — pattern Eteyelo. */

export type BrowserGeoCoords = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 0,
};

function toCoords(position: GeolocationPosition): BrowserGeoCoords {
  const accuracy = position.coords.accuracy;
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy:
      Number.isFinite(accuracy) && accuracy > 0 ? accuracy : undefined,
  };
}

function oncePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Géolocalisation non disponible sur cet appareil."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS);
  });
}

/**
 * Plusieurs mesures GPS, on garde la plus précise.
 * Évite qu'un seul getCurrentPosition (souvent 20–80 m) fausse l'adresse.
 */
export async function getCurrentPosition(): Promise<GeolocationPosition> {
  const first = await oncePosition();
  if (
    typeof navigator === "undefined" ||
    !navigator.geolocation?.watchPosition ||
    (Number.isFinite(first.coords.accuracy) && first.coords.accuracy <= 20)
  ) {
    return first;
  }

  return new Promise((resolve) => {
    let best = first;
    const started = Date.now();
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (
          !Number.isFinite(best.coords.accuracy) ||
          position.coords.accuracy < best.coords.accuracy
        ) {
          best = position;
        }
        if (best.coords.accuracy <= 15 || Date.now() - started >= 8000) {
          navigator.geolocation.clearWatch(watchId);
          resolve(best);
        }
      },
      () => {
        navigator.geolocation.clearWatch(watchId);
        resolve(best);
      },
      GEO_OPTIONS,
    );

    window.setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      resolve(best);
    }, 9000);
  });
}

export async function getCurrentGeoCoords(): Promise<BrowserGeoCoords> {
  const position = await getCurrentPosition();
  return toCoords(position);
}

export type ReverseGeocodeResult = {
  city: string;
  commune: string;
  quartier: string;
  avenue: string;
  houseNumber: string;
  displayName?: string;
};

/** Reverse geocode via l’API app (Nominatim côté serveur, évite le CORS). */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult> {
  const res = await fetch(
    `/api/geo/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
  );
  const data = (await res.json()) as ReverseGeocodeResult & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? "Reverse geocode échoué");
  }
  return {
    city: data.city?.trim() || "",
    commune: data.commune?.trim() || "",
    quartier: data.quartier?.trim() || "",
    avenue: data.avenue?.trim() || "",
    houseNumber: data.houseNumber?.trim() || "",
    displayName: data.displayName,
  };
}

/** Bearing en degrés entre deux points (orientation moto). */
export function bearingDeg(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
