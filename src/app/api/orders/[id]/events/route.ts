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

    const isVendor = await assertShopMember(session.user.id, order.shopId);
    if (!isVendor) {
      return NextResponse.json({ error: "Accès vendeur requis" }, { status: 403 });
    }

    if (order.status === "AWAITING_CONFIRM") {
      return NextResponse.json(
        {
          error:
            "QR déjà scanné — attendez la confirmation du client dans Chip Shop",
        },
        { status: 409 },
      );
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
