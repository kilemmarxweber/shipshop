import type { DeliveryPricingMode } from "@/generated/prisma/client";
import { isKinshasaCity } from "@/lib/kinshasa-geo";
import { prisma, withDbRetry } from "@/lib/prisma";

export type ShippingQuoteInput = {
  shopId: string;
  city?: string | null;
  commune?: string | null;
  lat?: number | null;
  lng?: number | null;
  busStopName?: string | null;
};

export type ShippingQuote = {
  zoneId: string;
  commune: string;
  kind: "CENTER" | "REMOTE";
  pricingMode: DeliveryPricingMode;
  distanceKm: number;
  baseCents: number;
  ratePerKmCents: number;
  flatCents: number | null;
  shippingCents: number;
  busStopName?: string | null;
  shopLat: number;
  shopLng: number;
  destLat: number;
  destLng: number;
};

type BusStop = {
  name: string;
  lat?: number | null;
  lng?: number | null;
  cents: number;
};

function parseBusStops(raw: unknown): BusStop[] {
  if (!Array.isArray(raw)) return [];
  const out: BusStop[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    const cents = Number(row.cents);
    if (!name || !Number.isFinite(cents)) continue;
    out.push({
      name,
      lat: typeof row.lat === "number" ? row.lat : null,
      lng: typeof row.lng === "number" ? row.lng : null,
      cents: Math.max(0, Math.round(cents)),
    });
  }
  return out;
}

/** Haversine distance in km */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type RateFields = {
  pricingMode: DeliveryPricingMode;
  baseCents: number;
  ratePerKmCents: number;
  flatCents: number | null;
  busStops: unknown;
};

function applyShopOverride(
  zone: RateFields,
  override: {
    pricingMode: DeliveryPricingMode;
    baseCents: number;
    ratePerKmCents: number;
    flatCents: number | null;
  } | null,
): RateFields {
  if (!override) return zone;
  return {
    pricingMode: override.pricingMode,
    baseCents: override.baseCents,
    ratePerKmCents: override.ratePerKmCents,
    flatCents: override.flatCents,
    busStops: zone.busStops,
  };
}

function computeShippingCents(
  rate: RateFields,
  distanceKm: number,
  destLat: number,
  destLng: number,
  busStopName?: string | null,
): { shippingCents: number; busStopName: string | null } {
  const mode = rate.pricingMode;
  if (mode === "FLAT_ZONE" || mode === "COMMUNE") {
    const flat = rate.flatCents ?? rate.baseCents;
    return { shippingCents: Math.max(0, flat), busStopName: null };
  }

  if (mode === "BUS_STOP") {
    const stops = parseBusStops(rate.busStops);
    if (stops.length === 0) {
      const flat = rate.flatCents ?? rate.baseCents;
      return { shippingCents: Math.max(0, flat), busStopName: null };
    }
    const named = busStopName?.trim().toLowerCase();
    if (named) {
      const hit = stops.find((s) => s.name.toLowerCase() === named);
      if (hit) {
        return { shippingCents: hit.cents, busStopName: hit.name };
      }
    }
    // Arrêt le plus proche si coords connues, sinon premier
    let best = stops[0]!;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const stop of stops) {
      if (stop.lat == null || stop.lng == null) continue;
      const d = haversineKm(destLat, destLng, stop.lat, stop.lng);
      if (d < bestDist) {
        bestDist = d;
        best = stop;
      }
    }
    return { shippingCents: best.cents, busStopName: best.name };
  }

  // PER_KM (défaut)
  const billedKm = Math.ceil(Math.max(0.5, distanceKm));
  return {
    shippingCents: rate.baseCents + billedKm * rate.ratePerKmCents,
    busStopName: null,
  };
}

export async function quoteShipping(
  input: ShippingQuoteInput,
): Promise<ShippingQuote> {
  const shop = await withDbRetry(() =>
    prisma.shop.findUnique({ where: { id: input.shopId } }),
  );
  if (!shop) throw new Error("Boutique introuvable");

  const city = input.city?.trim() || "Kinshasa";
  if (!isKinshasaCity(city)) {
    throw new Error("Livraison disponible uniquement à Kinshasa pour V1");
  }

  const commune = input.commune?.trim() || "Gombe";

  let zone = await withDbRetry(() =>
    prisma.deliveryZone.findFirst({
      where: {
        isActive: true,
        commune: { equals: commune, mode: "insensitive" },
      },
    }),
  );
  if (!zone) {
    zone = await withDbRetry(() =>
      prisma.deliveryZone.findFirst({
        where: { isActive: true, commune: "Gombe" },
      }),
    );
    if (!zone) throw new Error(`Commune non desservie: ${commune}`);
  }

  const overrides = await withDbRetry(() =>
    prisma.shopDeliveryRate.findMany({
      where: {
        shopId: input.shopId,
        OR: [{ zoneId: zone!.id }, { zoneId: null }],
      },
    }),
  );
  const zoneOverride = overrides.find((r) => r.zoneId === zone!.id) ?? null;
  const shopDefault = overrides.find((r) => r.zoneId == null) ?? null;
  const rate = applyShopOverride(zone, zoneOverride ?? shopDefault);

  return quoteFromZone(shop, zone, rate, input.lat, input.lng, input.busStopName);
}

async function quoteFromZone(
  shop: { lat: number; lng: number },
  zone: {
    id: string;
    commune: string;
    kind: "CENTER" | "REMOTE";
    centerLat: number;
    centerLng: number;
  },
  rate: RateFields,
  lat?: number | null,
  lng?: number | null,
  busStopName?: string | null,
): Promise<ShippingQuote> {
  const destLat = lat ?? zone.centerLat;
  const destLng = lng ?? zone.centerLng;
  const distanceKm = Math.max(
    0.5,
    haversineKm(shop.lat, shop.lng, destLat, destLng),
  );
  const { shippingCents, busStopName: matchedStop } = computeShippingCents(
    rate,
    distanceKm,
    destLat,
    destLng,
    busStopName,
  );

  return {
    zoneId: zone.id,
    commune: zone.commune,
    kind: zone.kind,
    pricingMode: rate.pricingMode,
    distanceKm: Math.round(distanceKm * 10) / 10,
    baseCents: rate.baseCents,
    ratePerKmCents: rate.ratePerKmCents,
    flatCents: rate.flatCents,
    shippingCents,
    busStopName: matchedStop,
    shopLat: shop.lat,
    shopLng: shop.lng,
    destLat,
    destLng,
  };
}

export function generatePickupCode() {
  const part = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CS-${part}`;
}
