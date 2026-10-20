import { NextResponse } from "next/server";
import { z } from "zod";
import {
  HANDOVER_CLOSED_STATUSES,
  parseHandoverQrPayload,
} from "@/lib/handover";
import {
  notifyBuyerConfirmInApp,
  notifyOrderEvent,
} from "@/lib/messaging/notify";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canStaffShop } from "@/lib/shop-access";

const schema = z.object({
  orderId: z.string().optional(),
  code: z.string().optional(),
  qrPayload: z.string().optional(),
  note: z.string().max(300).optional(),
});

async function assertCanScanHandover(
  userId: string,
  shopId: string,
  courierUserId?: string | null,
) {
  if (courierUserId && courierUserId === userId) return true;
  return canStaffShop(userId, shopId);
}

function isClosed(status: string) {
  return (HANDOVER_CLOSED_STATUSES as readonly string[]).includes(status);
}

type PendingOrder = {
  id: string;
  status: string;
  product: { title: string; images: string[] };
  pickupReceipt: { scannedAt: Date | null; redeemedAt: Date | null } | null;
};

function pendingItems(orders: PendingOrder[]) {
  return orders.filter(
    (o) =>
      !isClosed(o.status) &&
      !o.pickupReceipt?.redeemedAt &&
      !o.pickupReceipt?.scannedAt,
  );
}

async function scanOrder(input: {
  orderId: string;
  userId: string;
  note?: string;
  fromQr: boolean;
}) {
  const order = await withDbRetry(() =>
    prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        pickupReceipt: true,
        product: { select: { title: true, images: true } },
        shop: { select: { id: true, name: true } },
        buyer: { select: { id: true, name: true } },
        courier: { select: { userId: true } },
        handover: true,
      },
    }),
  );
  if (!order || !order.pickupReceipt) {
    return NextResponse.json(
      { error: "Commande ou reçu introuvable" },
      { status: 404 },
    );
  }

  const canScan = await assertCanScanHandover(
    input.userId,
    order.shopId,
    order.courier?.userId,
  );
  if (!canScan) {
    return NextResponse.json(
      { error: "Seul le vendeur ou le livreur assigné peut scanner la remise" },
      { status: 403 },
    );
  }

  if (order.pickupReceipt.redeemedAt) {
    return NextResponse.json(
      { error: "Livraison déjà confirmée par le client", alreadyRedeemed: true },
      { status: 409 },
    );
  }

  if (isClosed(order.status)) {
    return NextResponse.json(
      { error: `Commande déjà clôturée (${order.status})` },
      { status: 400 },
    );
  }

  if (order.pickupReceipt.scannedAt || order.status === "AWAITING_CONFIRM") {
    return NextResponse.json({
      status: "AWAITING_CONFIRM",
      order,
      message:
        "Article déjà scanné — en attente de confirmation du client dans Chip Shop",
    });
  }

  const updated = await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      await tx.pickupReceipt.update({
        where: { id: order.pickupReceipt!.id },
        data: { scannedAt: new Date() },
      });

      const next = await tx.order.update({
        where: { id: order.id },
        data: { status: "AWAITING_CONFIRM" },
        include: {
          pickupReceipt: true,
          product: { select: { title: true, images: true } },
          shop: { select: { id: true, name: true } },
          buyer: { select: { id: true, name: true } },
          handover: true,
        },
      });

      await tx.deliveryEvent.create({
        data: {
          orderId: order.id,
          status: "AWAITING_CONFIRM",
          note:
            input.note ??
            (input.fromQr
              ? "QR boutique — article déduit, en attente confirmation client"
              : "Code saisi — en attente confirmation client"),
          actorUserId: input.userId,
        },
      });

      return next;
    }),
  );

  void Promise.allSettled([
    notifyOrderEvent(order.id, "HANDOVER_SCANNED"),
    notifyBuyerConfirmInApp(order.id),
  ]);

  const siblings = order.handoverId
    ? await withDbRetry(() =>
        prisma.order.findMany({
          where: { handoverId: order.handoverId },
          include: {
            product: { select: { title: true, images: true } },
            pickupReceipt: true,
          },
        }),
      )
    : [updated];

  const remaining = siblings.filter(
    (o) => !isClosed(o.status) && !o.pickupReceipt?.redeemedAt,
  ).length;

  return NextResponse.json({
    order: updated,
    status: "AWAITING_CONFIRM",
    remaining,
    handoverCompleted: remaining === 0,
    message:
      remaining > 1
        ? `Article « ${updated.product.title} » déduit. ${remaining - 1} autre(s) à remettre avec le même QR.`
        : remaining === 1
          ? `Article « ${updated.product.title} » déduit. Dernier article : le client confirme, puis le QR se termine.`
          : "Dernier article remis — QR boutique terminé après confirmation client.",
  });
}

/**
 * Étape 1 — le vendeur scanne le QR boutique / saisit le code.
 * Un article est déduit. Le QR reste actif jusqu’au dernier remis ou annulé.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());
    let orderId = body.orderId;
    let code = body.code?.trim().toUpperCase();
    let handoverId: string | undefined;
    const parsed = body.qrPayload
      ? parseHandoverQrPayload(body.qrPayload)
      : null;

    if (parsed) {
      code = parsed.c;
      if (parsed.v === 2) handoverId = parsed.g;
      else orderId = parsed.o;
    }

    if (handoverId && code) {
      const handover = await withDbRetry(() =>
        prisma.shopHandover.findUnique({
          where: { id: handoverId },
          include: {
            shop: { select: { id: true, name: true } },
            orders: {
              include: {
                product: { select: { title: true, images: true } },
                pickupReceipt: true,
              },
            },
          },
        }),
      );
      if (!handover || handover.code.toUpperCase() !== code) {
        return NextResponse.json(
          { error: "QR boutique invalide" },
          { status: 400 },
        );
      }
      if (parsed && parsed.s !== handover.shopId) {
        return NextResponse.json(
          { error: "QR d’une autre boutique" },
          { status: 403 },
        );
      }
      const isVendor = await canStaffShop(session.user.id, handover.shopId);
      if (!isVendor) {
        return NextResponse.json(
          { error: "Seul le vendeur de cette boutique peut valider ce QR" },
          { status: 403 },
        );
      }
      if (handover.completedAt) {
        return NextResponse.json({
          handoverCompleted: true,
          message: "QR boutique déjà terminé — tous les articles sont remis ou annulés",
        });
      }

      const pending = pendingItems(handover.orders);
      if (pending.length === 0) {
        return NextResponse.json({
          handoverCompleted: true,
          message: "Plus d’article à remettre pour ce QR",
        });
      }

      const chosen =
        orderId && pending.some((o) => o.id === orderId)
          ? orderId
          : pending.length === 1
            ? pending[0].id
            : null;

      if (!chosen) {
        return NextResponse.json({
          needsItem: true,
          handoverId: handover.id,
          shopName: handover.shop.name,
          items: pending.map((o) => ({
            id: o.id,
            title: o.product.title,
            images: o.product.images,
          })),
          message: "Choisis l’article que tu remets maintenant",
        });
      }

      return scanOrder({
        orderId: chosen,
        userId: session.user.id,
        note: body.note,
        fromQr: Boolean(body.qrPayload),
      });
    }

    if (!orderId && code) {
      const byShopCode = await withDbRetry(() =>
        prisma.shopHandover.findUnique({
          where: { code },
          include: {
            shop: { select: { id: true, name: true } },
            orders: {
              include: {
                product: { select: { title: true, images: true } },
                pickupReceipt: true,
              },
            },
          },
        }),
      );
      if (byShopCode) {
        const isVendor = await canStaffShop(
          session.user.id,
          byShopCode.shopId,
        );
        if (!isVendor) {
          return NextResponse.json(
            { error: "Seul le vendeur de cette boutique peut valider ce QR" },
            { status: 403 },
          );
        }
        const pending = pendingItems(byShopCode.orders);
        if (pending.length === 0) {
          return NextResponse.json({
            handoverCompleted: true,
            message: "QR boutique déjà terminé",
          });
        }
        if (pending.length > 1) {
          return NextResponse.json({
            needsItem: true,
            handoverId: byShopCode.id,
            shopName: byShopCode.shop.name,
            items: pending.map((o) => ({
              id: o.id,
              title: o.product.title,
              images: o.product.images,
            })),
            message: "Choisis l’article que tu remets maintenant",
          });
        }
        return scanOrder({
          orderId: pending[0].id,
          userId: session.user.id,
          note: body.note,
          fromQr: false,
        });
      }
    }

    if (!orderId || !code) {
      return NextResponse.json(
        { error: "orderId + code, ou qrPayload requis" },
        { status: 400 },
      );
    }

    const order = await withDbRetry(() =>
      prisma.order.findUnique({
        where: { id: orderId },
        include: { pickupReceipt: true, handover: true },
      }),
    );
    if (!order?.pickupReceipt) {
      return NextResponse.json(
        { error: "Commande ou reçu introuvable" },
        { status: 404 },
      );
    }
    const expected = (
      order.handover?.code ?? order.pickupReceipt.code
    ).toUpperCase();
    const itemCode = order.pickupReceipt.code.toUpperCase();
    if (code !== expected && code !== itemCode) {
      return NextResponse.json({ error: "Code QR / reçu invalide" }, { status: 400 });
    }

    return scanOrder({
      orderId,
      userId: session.user.id,
      note: body.note,
      fromQr: Boolean(body.qrPayload),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Validation impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
