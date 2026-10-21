import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { haversineKm } from "@/lib/shipping";
import {
  inKinshasa,
  officialCommuneName,
  parseNominatimKinshasa,
  placeKey,
  type NominatimReverse,
  type ParsedKinshasaAddress,
} from "@/lib/nominatim-address";

async function snapCommune(
  lat: number,
  lng: number,
  osmCommune: string,
): Promise<string> {
  const zones = await withDbRetry(() =>
    prisma.deliveryZone.findMany({
      where: { isActive: true },
      select: { commune: true, centerLat: true, centerLng: true },
    }),
  );
  if (zones.length === 0) {
    return osmCommune ? officialCommuneName(osmCommune) : osmCommune;
  }

  const osmKey = placeKey(osmCommune);
  const fromOsm = zones.find(
    (z) => osmKey && osmKey !== "kinshasa" && placeKey(z.commune) === osmKey,
  );
  if (fromOsm) return fromOsm.commune;

  let best = zones[0]!;
  let bestKm = Infinity;
  for (const z of zones) {
    const km = haversineKm(lat, lng, z.centerLat, z.centerLng);
    if (km < bestKm) {
      bestKm = km;
      best = z;
    }
  }
  return best.commune;
}

async function nominatimReverse(
  lat: number,
  lng: number,
  zoom: number,
): Promise<NominatimReverse | null> {
  const nominatim = new URL("https://nominatim.openstreetmap.org/reverse");
  nominatim.searchParams.set("format", "jsonv2");
  nominatim.searchParams.set("lat", String(lat));
  nominatim.searchParams.set("lon", String(lng));
  nominatim.searchParams.set("zoom", String(zoom));
  nominatim.searchParams.set("addressdetails", "1");
  nominatim.searchParams.set("accept-language", "fr");

  const res = await fetch(nominatim, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ShipShop/1.0 (delivery reverse-geocode)",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  return (await res.json()) as NominatimReverse;
}

function mergeParsed(
  primary: ParsedKinshasaAddress,
  extra: ParsedKinshasaAddress | null,
): ParsedKinshasaAddress {
  if (!extra) return primary;
  return {
    city: primary.city || extra.city,
    commune: primary.commune || extra.commune,
    quartier: primary.quartier || extra.quartier,
    avenue: primary.avenue || extra.avenue,
    houseNumber: primary.houseNumber || extra.houseNumber,
    displayName: primary.displayName || extra.displayName,
  };
}

function firstFilled(values: Array<string | undefined>) {
  return values.find((v) => (v ?? "").trim().length > 0)?.trim() ?? "";
}

function parseGenericAddress(data: NominatimReverse): ParsedKinshasaAddress {
  const a = data.address ?? {};
  const city = firstFilled([a.city, a.town, a.village, a.state_district, a.state]);
  const commune = firstFilled([a.city_district, a.county, a.municipality, a.suburb]);
  const quartier = firstFilled([a.neighbourhood, a.quarter, a.suburb, a.locality]);
  const avenue = firstFilled([a.road, a.pedestrian, a.path, a.residential]);
  const houseNumber = firstFilled([a.house_number]);
  return {
    city,
    commune,
    quartier,
    avenue,
    houseNumber,
    displayName: data.display_name ?? "",
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 });
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 });
  }

  const streetLevel = await nominatimReverse(lat, lng, 18);
  if (!streetLevel) {
    return NextResponse.json(
      { error: "Adresse introuvable pour ce point" },
      { status: 502 },
    );
  }

  const isKin = inKinshasa(streetLevel.address ?? {}, lat, lng);
  let parsed = isKin
    ? parseNominatimKinshasa(streetLevel, lat, lng)
    : parseGenericAddress(streetLevel);

  if (!parsed.avenue || !parsed.quartier || !parsed.commune || !parsed.city) {
    const wider = await nominatimReverse(lat, lng, 16);
    if (wider) {
      parsed = mergeParsed(
        parsed,
        isKin ? parseNominatimKinshasa(wider, lat, lng) : parseGenericAddress(wider),
      );
    }
  }

  if (isKin) {
    parsed = {
      ...parsed,
      commune: await snapCommune(lat, lng, parsed.commune),
    };
  }

  return NextResponse.json(parsed);
}
