import { NextResponse } from "next/server";
import { z } from "zod";
import { findBestCourier, proposeCouriers } from "@/lib/courier-match";
import { notifyOrderEvent } from "@/lib/messaging/notify";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const schema = z.object({
  courierId: z.string().min(1).optional(),
  /** Si true, recalcule la meilleure proposition */
  auto: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const order = await withDbRetry(() =>
    prisma.order.findUnique({
      where: { id },
      include: { shop: true, zone: true },
    }),
  );
  if (!order || order.fulfillmentType !== "DELIVERY") {
    return NextResponse.json({ error: "Commande livraison introuvable" }, { status: 404 });
  }
  if (order.deliveryLat == null || order.deliveryLng == null) {
    return NextResponse.json({ error: "Coordonnées livraison manquantes" }, { status: 400 });
  }

  const proposals = await proposeCouriers({
    destLat: order.deliveryLat,
    destLng: order.deliveryLng,
    commune: order.deliveryCommune,
    remoteZone: order.zone?.kind === "REMOTE",
    limit: 5,
  });

  return NextResponse.json({ proposals });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = schema.parse(await req.json().catch(() => ({})));

    const order = await withDbRetry(() =>
      prisma.order.findUnique({
        where: { id },
        include: { shop: true, zone: true },
      }),
    );
    if (!order) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    }
    if (order.fulfillmentType !== "DELIVERY") {
      return NextResponse.json({ error: "Commande sans livraison" }, { status: 400 });
    }

    const member = await withDbRetry(() =>
      prisma.member.findFirst({
        where: {
          userId: session.user.id,
          organizationId: order.shop.organizationId,
        },
      }),
    );
    if (!member) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (order.deliveryLat == null || order.deliveryLng == null) {
      return NextResponse.json(
        { error: "Coordonnées livraison manquantes" },
        { status: 400 },
      );
    }

    let courierId = body.courierId;
    let eta = null as
      | {
          distanceKm: number;
          etaMinutes: number;
          etaAt: Date;
          etaText: string;
        }
      | null;
    let reason = "";

    if (body.auto || !courierId) {
      const best = await findBestCourier({
        destLat: order.deliveryLat,
        destLng: order.deliveryLng,
        commune: order.deliveryCommune,
        remoteZone: order.zone?.kind === "REMOTE",
      });
      if (!best) {
        return NextResponse.json({ error: "Aucun livreur disponible" }, { status: 400 });
      }
      courierId = best.courier.id;
      eta = best.eta;
      reason = best.reason;
    } else {
      const courier = await withDbRetry(() =>
        prisma.courier.findUnique({ where: { id: courierId! } }),
      );
      if (!courier || !courier.isAvailable) {
        return NextResponse.json({ error: "Livreur indisponible" }, { status: 400 });
      }
      const { estimateCourierEta } = await import("@/lib/delivery-eta");
      eta = estimateCourierEta(
        courier.lastLat ?? courier.lat,
        courier.lastLng ?? courier.lng,
        order.deliveryLat,
        order.deliveryLng,
        { remoteZone: order.zone?.kind === "REMOTE" },
      );
    }

    const updated = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const next = await tx.order.update({
          where: { id },
          data: {
            courierId,
            status: "ASSIGNED",
            courierDistanceKm: eta!.distanceKm,
            etaMinutes: eta!.etaMinutes,
            etaAt: eta!.etaAt,
          },
          include: { courier: true, product: true, shop: true },
        });
        await tx.deliveryEvent.create({
          data: {
            orderId: id,
            status: "ASSIGNED",
            note: `Livreur ${next.courier?.name} · ${eta!.distanceKm} km · ETA ~${eta!.etaText}${reason ? ` (${reason})` : ""}`,
            actorUserId: session.user.id,
          },
        });
        return next;
      }),
    );

    void notifyOrderEvent(id, "COURIER_ASSIGNED").catch(console.error);

    return NextResponse.json({ order: updated, eta });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Assignation impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
