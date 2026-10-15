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
 * Étape 1 — le vendeur scanne le QR / saisit le code.
 * La commande passe en AWAITING_CONFIRM. Le client doit ensuite confirmer.
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
        { error: "Seul le vendeur / boutique peut scanner la remise" },
        { status: 403 },
      );
    }

    if (order.pickupReceipt.redeemedAt) {
      return NextResponse.json(
        { error: "Livraison déjà confirmée par le client", alreadyRedeemed: true },
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

    if (order.pickupReceipt.scannedAt || order.status === "AWAITING_CONFIRM") {
      return NextResponse.json({
        status: "AWAITING_CONFIRM",
        message:
          "QR déjà scanné — en attente de confirmation du client dans Chip Shop",
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
          },
        });

        await tx.deliveryEvent.create({
          data: {
            orderId: order.id,
            status: "AWAITING_CONFIRM",
            note:
              body.note ??
              (body.qrPayload
                ? "QR scanné — en attente confirmation client"
                : "Code saisi — en attente confirmation client"),
            actorUserId: session.user.id,
          },
        });

        return next;
      }),
    );

    void notifyOrderEvent(order.id, "HANDOVER_SCANNED").catch(console.error);

    return NextResponse.json({
      order: updated,
      status: "AWAITING_CONFIRM",
      message:
        "QR validé. Le client doit confirmer la réception dans son compte Chip Shop.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Validation impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
