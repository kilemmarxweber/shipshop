import { estimateCourierEta, type EtaResult } from "@/lib/delivery-eta";
import { prisma, withDbRetry } from "@/lib/prisma";
import { haversineKm } from "@/lib/shipping";

const BUSY_STATUSES = ["ASSIGNED", "FULFILLING", "OUT_FOR_DELIVERY"] as const;

export type CourierProposal = {
  courier: {
    id: string;
    name: string;
    phone: string;
    address: string | null;
    lat: number;
    lng: number;
    zoneId: string | null;
    shopId: string | null;
  };
  reason: "FREE" | "SAME_AREA" | "NEAREST_BUSY";
  activeOrders: number;
  sameCommuneOrders: number;
  eta: EtaResult;
  score: number;
};

/**
 * Propose un livreur selon position GPS + disponibilité :
 * 1) dispo sans course active, le plus proche de la destination
 * 2) sinon course vers la même commune (groupage)
 * 3) sinon le moins chargé / plus proche
 *
 * Scope : livreurs de la boutique + livreurs plateforme (shopId null).
 */
export async function proposeCouriers(input: {
  destLat: number;
  destLng: number;
  commune?: string | null;
  remoteZone?: boolean;
  shopId?: string | null;
  zoneId?: string | null;
  limit?: number;
}): Promise<CourierProposal[]> {
  const couriers = await withDbRetry(() =>
    prisma.courier.findMany({
      where: {
        isAvailable: true,
        ...(input.shopId
          ? { OR: [{ shopId: input.shopId }, { shopId: null }] }
          : {}),
      },
    }),
  );
  if (couriers.length === 0) return [];

  const activeOrders = await withDbRetry(() =>
    prisma.order.findMany({
      where: {
        fulfillmentType: "DELIVERY",
        status: { in: [...BUSY_STATUSES] },
        courierId: { not: null },
      },
      select: {
        courierId: true,
        deliveryCommune: true,
        deliveryLat: true,
        deliveryLng: true,
      },
    }),
  );

  const byCourier = new Map<
    string,
    { count: number; communes: string[]; dests: { lat: number; lng: number }[] }
  >();
  for (const o of activeOrders) {
    if (!o.courierId) continue;
    const row = byCourier.get(o.courierId) ?? {
      count: 0,
      communes: [],
      dests: [],
    };
    row.count += 1;
    if (o.deliveryCommune) row.communes.push(o.deliveryCommune);
    if (o.deliveryLat != null && o.deliveryLng != null) {
      row.dests.push({ lat: o.deliveryLat, lng: o.deliveryLng });
    }
    byCourier.set(o.courierId, row);
  }

  const commune = input.commune?.trim().toLowerCase() ?? "";
  const proposals: CourierProposal[] = [];

  for (const c of couriers) {
    const lat = c.lastLat ?? c.lat;
    const lng = c.lastLng ?? c.lng;
    const busy = byCourier.get(c.id);
    const activeCount = busy?.count ?? 0;
    const sameCommune = commune
      ? (busy?.communes.filter((x) => x.toLowerCase() === commune).length ?? 0)
      : 0;

    let fromLat = lat;
    let fromLng = lng;
    let reason: CourierProposal["reason"] = "FREE";
    if (activeCount === 0) {
      reason = "FREE";
    } else if (sameCommune > 0) {
      reason = "SAME_AREA";
      const near = busy?.dests[0];
      if (near) {
        fromLat = near.lat;
        fromLng = near.lng;
      }
    } else {
      reason = "NEAREST_BUSY";
    }

    const eta = estimateCourierEta(fromLat, fromLng, input.destLat, input.destLng, {
      remoteZone: input.remoteZone,
    });

    // Score plus bas = meilleur (distance + charge)
    let score = eta.distanceKm + eta.etaMinutes / 10;
    if (reason === "FREE") score -= 50;
    if (reason === "SAME_AREA") score -= 30;
    score += activeCount * 8;
    // Priorité livreurs rattachés à la boutique
    if (input.shopId && c.shopId === input.shopId) score -= 15;
    // Même zone catalogue
    if (input.zoneId && c.zoneId === input.zoneId) score -= 10;

    proposals.push({
      courier: {
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address ?? null,
        lat,
        lng,
        zoneId: c.zoneId,
        shopId: c.shopId,
      },
      reason,
      activeOrders: activeCount,
      sameCommuneOrders: sameCommune,
      eta,
      score,
    });
  }

  proposals.sort((a, b) => a.score - b.score);
  return proposals.slice(0, input.limit ?? 5);
}

export async function findBestCourier(input: {
  destLat: number;
  destLng: number;
  commune?: string | null;
  remoteZone?: boolean;
  shopId?: string | null;
  zoneId?: string | null;
}) {
  const list = await proposeCouriers({ ...input, limit: 1 });
  return list[0] ?? null;
}

/** @deprecated — use findBestCourier */
export async function findNearestCourier(lat: number, lng: number) {
  const best = await findBestCourier({ destLat: lat, destLng: lng });
  if (!best) return null;
  const c = await prisma.courier.findUnique({ where: { id: best.courier.id } });
  return c;
}

export function courierDistanceKm(
  courierLat: number,
  courierLng: number,
  destLat: number,
  destLng: number,
) {
  return Math.round(haversineKm(courierLat, courierLng, destLat, destLng) * 10) / 10;
}

export function formatCourierAssignNote(
  courier: { name: string; address?: string | null },
  eta: { distanceKm: number; etaText?: string; etaMinutes?: number },
  reason?: string,
) {
  const addr = courier.address?.trim();
  const etaPart =
    eta.etaText ??
    (eta.etaMinutes != null ? `~${eta.etaMinutes} min` : null);
  return [
    `Livreur auto: ${courier.name}`,
    addr ? `base ${addr}` : null,
    `${eta.distanceKm} km`,
    etaPart ? `ETA ${etaPart}` : null,
    reason ? `(${reason})` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
