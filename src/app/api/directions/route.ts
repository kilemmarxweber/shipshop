import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

type Seg = { lat: number; lng: number; color: string };

function speedColor(meters: number, seconds: number) {
  if (seconds <= 0) return "#22c55e";
  const kmh = (meters / seconds) * 3.6;
  if (kmh >= 25) return "#22c55e";
  if (kmh >= 12) return "#eab308";
  return "#ef4444";
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const url = new URL(req.url);
  const fromLat = Number(url.searchParams.get("fromLat"));
  const fromLng = Number(url.searchParams.get("fromLng"));
  const toLat = Number(url.searchParams.get("toLat"));
  const toLng = Number(url.searchParams.get("toLng"));
  if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
    return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 });
  }

  const osrm = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&annotations=duration,distance&steps=true`;
  try {
    const res = await fetch(osrm, { next: { revalidate: 20 } });
    if (!res.ok) throw new Error("osrm");
    const json = (await res.json()) as {
      routes?: {
        distance: number;
        duration: number;
        geometry: { coordinates: [number, number][] };
        legs?: {
          steps?: {
            distance: number;
            duration: number;
            geometry?: { coordinates: [number, number][] };
            maneuver?: { location: [number, number] };
          }[];
        }[];
      }[];
    };
    const route = json.routes?.[0];
    if (!route) throw new Error("no route");
    const segments: Seg[] = [];
    for (const step of route.legs?.[0]?.steps ?? []) {
      const coords = step.geometry?.coordinates ?? [];
      const color = speedColor(step.distance, step.duration);
      for (const [lng, lat] of coords) {
        segments.push({ lat, lng, color });
      }
    }
    if (segments.length === 0) {
      for (const [lng, lat] of route.geometry.coordinates) {
        segments.push({ lat, lng, color: "#64748b" });
      }
    }
    return NextResponse.json({
      distanceM: route.distance,
      durationS: route.duration,
      traffic: "osrm-speed",
      note:
        "Couleurs selon la vitesse OSRM (trafic temps réel indisponible sans clé Mapbox/Google).",
      path: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      segments,
    });
  } catch {
    return NextResponse.json({
      distanceM: null,
      durationS: null,
      traffic: "none",
      note: "Itinéraire indisponible",
      path: [
        { lat: fromLat, lng: fromLng },
        { lat: toLat, lng: toLng },
      ],
      segments: [
        { lat: fromLat, lng: fromLng, color: "#64748b" },
        { lat: toLat, lng: toLng, color: "#64748b" },
      ],
    });
  }
}
