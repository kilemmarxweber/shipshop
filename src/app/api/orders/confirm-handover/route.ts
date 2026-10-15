import { NextResponse } from "next/server";
import { z } from "zod";
import { parseHandoverQrPayload } from "@/lib/handover";
import { notifyOrderEvent } from "@/lib/messaging/notify";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const schema = z.object({
  orderId: z.string().optional(),
  code: z.string().optional(),
  qrPayload: z.string().optional(),
  note: z.string().max(300).optional(),
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

/**
 * Valide la remise (retrait ou livraison) par scan QR ou saisie manuelle du code.
 * Réservé au vendeur (membre org boutique).
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

    if (body.qrPayload) {
      const parsed = parseHandoverQrPayload(body.qrPayload);
      if (!parsed) {
        return NextResponse.json(
          { error: "QR invalide — ce n'est pas un reçu Chip Shop" },
          { status: 400 },
        );
      }
      orderId = parsed.o;
      code = parsed.c;
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
        include: {
          pickupReceipt: true,
          product: { select: { title: true } },
          shop: { select: { id: true, name: true, organizationId: true } },
        },
      }),
    );
    if (!order || !order.pickupReceipt) {
      return NextResponse.json(
        { error: "Commande ou reçu introuvable" },
        { status: 404 },
      );
    }

    const isVendor = await assertShopMember(session.user.id, order.shopId);
    if (!isVendor) {
      return NextResponse.json(
        { error: "Seul le vendeur / boutique peut valider la remise" },
        { status: 403 },
      );
    }

    if (order.pickupReceipt.redeemedAt) {
      return NextResponse.json(
        { error: "Remise déjà confirmée", alreadyRedeemed: true },
        { status: 409 },
      );
    }

    if (
      order.status === "DELIVERED" ||
      order.status === "PICKED_UP" ||
      order.status === "CANCELLED" ||
      order.status === "REFUNDED"
    ) {
      return NextResponse.json(
        { error: `Commande déjà clôturée (${order.status})` },
        { status: 400 },
      );
    }

    if (code !== order.pickupReceipt.code.toUpperCase()) {
      return NextResponse.json({ error: "Code QR / reçu invalide" }, { status: 400 });
    }

    const nextStatus =
      order.fulfillmentType === "PICKUP" ? "PICKED_UP" : "DELIVERED";

    const updated = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        await tx.pickupReceipt.update({
          where: { id: order.pickupReceipt!.id },
          data: { redeemedAt: new Date() },
        });

        const next = await tx.order.update({
          where: { id: order.id },
          data: { status: nextStatus },
          include: {
            pickupReceipt: true,
            product: { select: { title: true, images: true } },
            shop: { select: { id: true, name: true } },
            buyer: { select: { id: true, name: true } },
          },
        });

        await tx.deliveryEvent.create({
          data: {
            orderId: order.id,
            status: nextStatus,
            note:
              body.note ??
              (body.qrPayload
                ? "Remise confirmée par scan QR"
                : "Remise confirmée manuellement (code)"),
            actorUserId: session.user.id,
          },
        });

        return next;
      }),
    );

    void notifyOrderEvent(
      order.id,
      nextStatus === "PICKED_UP" ? "PICKED_UP" : "DELIVERED",
    ).catch(console.error);

    return NextResponse.json({
      order: updated,
      status: nextStatus,
      message: "Remise confirmée — remboursement client désactivé",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Validation impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
