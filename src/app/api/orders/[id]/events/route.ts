import { NextResponse } from "next/server";
import { z } from "zod";
import type { OrderStatus } from "@/generated/prisma/client";
import { notifyOrderEvent } from "@/lib/messaging/notify";
import type { DeliveryEventKey } from "@/lib/messaging/templates";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const schema = z.object({
  status: z.enum([
    "ASSIGNED",
    "FULFILLING",
    "OUT_FOR_DELIVERY",
    "READY_FOR_PICKUP",
    "PICKED_UP",
    "DELIVERED",
    "FAILED",
  ]),
  note: z.string().max(300).optional(),
  courierId: z.string().optional(),
  pickupCode: z.string().optional(),
});

async function assertShopMember(userId: string, shopId: string) {
  const shop = await withDbRetry(() =>
    prisma.shop.findUnique({ where: { id: shopId } }),
  );
  if (!shop) return false;
  const member = await withDbRetry(() =>
    prisma.member.findFirst({
      where: { userId, organizationId: shop.organizationId },
    }),
  );
  return Boolean(member);
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
    const body = schema.parse(await req.json());

    const order = await withDbRetry(() =>
      prisma.order.findUnique({
        where: { id },
        include: { pickupReceipt: true },
      }),
    );
    if (!order) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    }

    const isBuyer = order.buyerId === session.user.id;
    const isVendor = await assertShopMember(session.user.id, order.shopId);

    if (body.status === "DELIVERED" || body.status === "PICKED_UP") {
      if (!isBuyer && !isVendor) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    } else if (!isVendor) {
      return NextResponse.json({ error: "Accès vendeur requis" }, { status: 403 });
    }

    // Remise finale : uniquement vendeur + code/QR (pas le client)
    if (body.status === "PICKED_UP" || body.status === "DELIVERED") {
      if (!isVendor) {
        return NextResponse.json(
          {
            error:
              "Seul le vendeur / livreur boutique peut confirmer la remise (scan QR ou code)",
          },
          { status: 403 },
        );
      }
      if (!order.pickupReceipt) {
        return NextResponse.json(
          { error: "Pas de reçu QR — utilisez /api/orders/confirm-handover" },
          { status: 400 },
        );
      }
      if (order.pickupReceipt.redeemedAt) {
        return NextResponse.json(
          { error: "Remise déjà confirmée" },
          { status: 409 },
        );
      }
      if (!body.pickupCode) {
        return NextResponse.json(
          {
            error:
              "Code reçu ou scan QR requis pour confirmer la remise (remboursement client se ferme ensuite)",
          },
          { status: 400 },
        );
      }
      if (body.pickupCode.toUpperCase() !== order.pickupReceipt.code) {
        return NextResponse.json({ error: "Code reçu invalide" }, { status: 400 });
      }
    }

    const updated = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const data: {
          status: OrderStatus;
          courierId?: string;
        } = { status: body.status as OrderStatus };

        if (body.courierId) {
          data.courierId = body.courierId;
        }

        const next = await tx.order.update({
          where: { id },
          data,
          include: {
            courier: true,
            pickupReceipt: true,
            product: { select: { title: true, images: true } },
            shop: { select: { id: true, name: true } },
          },
        });

        if (
          (body.status === "PICKED_UP" || body.status === "DELIVERED") &&
          order.pickupReceipt &&
          !order.pickupReceipt.redeemedAt
        ) {
          await tx.pickupReceipt.update({
            where: { id: order.pickupReceipt.id },
            data: { redeemedAt: new Date() },
          });
        }

        await tx.deliveryEvent.create({
          data: {
            orderId: id,
            status: body.status as OrderStatus,
            note: body.note ?? `Statut → ${body.status}`,
            actorUserId: session.user.id,
          },
        });

        return next;
      }),
    );

    const notifyMap: Partial<Record<string, DeliveryEventKey>> = {
      OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
      DELIVERED: "DELIVERED",
      PICKED_UP: "PICKED_UP",
      READY_FOR_PICKUP: "PICKUP_READY",
    };
    const eventKey = notifyMap[body.status];
    if (eventKey) {
      void notifyOrderEvent(id, eventKey).catch(console.error);
    }

    return NextResponse.json({ order: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mise à jour impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
