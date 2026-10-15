import { NextResponse } from "next/server";
import { z } from "zod";
import { metersBetween, estimateCourierEta } from "@/lib/delivery-eta";
import { notifyOrderEvent } from "@/lib/messaging/notify";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const PROXIMITY_METERS = 100;

/**
 * MAJ GPS livreur → recalcule ETA des courses actives
 * + notifie le client si ≤ 100 m (une seule fois).
 */
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
    const body = schema.parse(await req.json());

    const courier = await withDbRetry(() =>
      prisma.courier.findUnique({ where: { id } }),
    );
    if (!courier) {
      return NextResponse.json({ error: "Livreur introuvable" }, { status: 404 });
    }

    await withDbRetry(() =>
      prisma.courier.update({
        where: { id },
        data: {
          lat: body.lat,
          lng: body.lng,
          lastLat: body.lat,
          lastLng: body.lng,
          lastSeenAt: new Date(),
        },
      }),
    );

    const activeOrders = await withDbRetry(() =>
      prisma.order.findMany({
        where: {
          courierId: id,
          status: { in: ["ASSIGNED", "FULFILLING", "OUT_FOR_DELIVERY"] },
          fulfillmentType: "DELIVERY",
        },
        include: { zone: true },
      }),
    );

    const updates: {
      orderId: string;
      distanceM: number;
      etaMinutes: number;
      proximity: boolean;
    }[] = [];

    for (const order of activeOrders) {
      if (order.deliveryLat == null || order.deliveryLng == null) continue;

      const distanceM = metersBetween(
        body.lat,
        body.lng,
        order.deliveryLat,
        order.deliveryLng,
      );
      const eta = estimateCourierEta(
        body.lat,
        body.lng,
        order.deliveryLat,
        order.deliveryLng,
        { remoteZone: order.zone?.kind === "REMOTE" },
      );

      await withDbRetry(() =>
        prisma.order.update({
          where: { id: order.id },
          data: {
            courierDistanceKm: eta.distanceKm,
            etaMinutes: eta.etaMinutes,
            etaAt: eta.etaAt,
          },
        }),
      );

      let proximity = false;
      if (
        distanceM <= PROXIMITY_METERS &&
        !order.proximityNotifiedAt &&
        order.status === "OUT_FOR_DELIVERY"
      ) {
        await withDbRetry(() =>
          prisma.order.update({
            where: { id: order.id },
            data: { proximityNotifiedAt: new Date() },
          }),
        );
        await withDbRetry(() =>
          prisma.deliveryEvent.create({
            data: {
              orderId: order.id,
              status: "OUT_FOR_DELIVERY",
              note: `Livreur à ~${Math.round(distanceM)} m du client`,
              actorUserId: session.user.id,
            },
          }),
        );
        void notifyOrderEvent(order.id, "COURIER_NEAR_100M").catch(console.error);
        proximity = true;
      }

      updates.push({
        orderId: order.id,
        distanceM: Math.round(distanceM),
        etaMinutes: eta.etaMinutes,
        proximity,
      });
    }

    return NextResponse.json({ ok: true, updates });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "MAJ position impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
