import { isKinshasaCity } from "@/lib/kinshasa-geo";
import { prisma, withDbRetry } from "@/lib/prisma";

export type ShippingQuoteInput = {
  shopId: string;
  city?: string | null;
  commune?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type ShippingQuote = {
  zoneId: string;
  commune: string;
  kind: "CENTER" | "REMOTE";
  distanceKm: number;
  baseCents: number;
  ratePerKmCents: number;
  shippingCents: number;
  shopLat: number;
  shopLng: number;
  destLat: number;
  destLng: number;
};

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

  const zone = await withDbRetry(() =>
    prisma.deliveryZone.findFirst({
      where: {
        isActive: true,
        commune: { equals: commune, mode: "insensitive" },
      },
    }),
  );
  if (!zone) {
    // fallback centre ville
    const fallback = await withDbRetry(() =>
      prisma.deliveryZone.findFirst({
        where: { isActive: true, commune: "Gombe" },
      }),
    );
    if (!fallback) throw new Error(`Commune non desservie: ${commune}`);
    return quoteFromZone(shop, fallback, input.lat, input.lng);
  }

  return quoteFromZone(shop, zone, input.lat, input.lng);
}

async function quoteFromZone(
  shop: { lat: number; lng: number },
  zone: {
    id: string;
    commune: string;
    kind: "CENTER" | "REMOTE";
    baseCents: number;
    ratePerKmCents: number;
    centerLat: number;
    centerLng: number;
  },
  lat?: number | null,
  lng?: number | null,
): Promise<ShippingQuote> {
  const destLat = lat ?? zone.centerLat;
  const destLng = lng ?? zone.centerLng;
  const distanceKm = Math.max(
    0.5,
    haversineKm(shop.lat, shop.lng, destLat, destLng),
  );
  const billedKm = Math.ceil(distanceKm);
  const shippingCents = zone.baseCents + billedKm * zone.ratePerKmCents;

  return {
    zoneId: zone.id,
    commune: zone.commune,
    kind: zone.kind,
    distanceKm: Math.round(distanceKm * 10) / 10,
    baseCents: zone.baseCents,
    ratePerKmCents: zone.ratePerKmCents,
    shippingCents,
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
