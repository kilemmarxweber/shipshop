import { NextResponse } from "next/server";
import { releaseEscrowToSeller } from "@/lib/checkout";
import { notifyOrderEvent } from "@/lib/messaging/notify";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * Étape 2 — le client confirme la réception dans Chip Shop.
 * C’est seulement ici que le statut passe à DELIVERED / PICKED_UP.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const order = await withDbRetry(() =>
      prisma.order.findUnique({
        where: { id },
        include: { pickupReceipt: true },
      }),
    );
    if (!order || !order.pickupReceipt) {
      return NextResponse.json(
        { error: "Commande ou reçu introuvable" },
        { status: 404 },
      );
    }
    if (order.buyerId !== session.user.id) {
      return NextResponse.json(
        { error: "Seul l’acheteur peut confirmer la réception" },
        { status: 403 },
      );
    }
    if (order.pickupReceipt.redeemedAt) {
      return NextResponse.json(
        { error: "Réception déjà confirmée", alreadyRedeemed: true },
        { status: 409 },
      );
    }
    if (!order.pickupReceipt.scannedAt && order.status !== "AWAITING_CONFIRM") {
      return NextResponse.json(
        {
          error:
            "Le vendeur doit d’abord scanner votre QR. Présentez-le, puis confirmez ici.",
        },
        { status: 400 },
      );
    }
    if (
      order.status === "CANCELLED" ||
      order.status === "REFUNDED" ||
      order.status === "FAILED"
    ) {
      return NextResponse.json(
        { error: `Commande non confirmable (${order.status})` },
        { status: 400 },
      );
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
          },
        });

        await tx.deliveryEvent.create({
          data: {
            orderId: order.id,
            status: nextStatus,
            note: "Réception confirmée — vendeur payé",
            actorUserId: session.user.id,
          },
        });

        await releaseEscrowToSeller(tx, order.id);

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
      message:
        nextStatus === "PICKED_UP"
          ? "Retrait confirmé — le vendeur est payé"
          : "Livraison confirmée — le vendeur est payé",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Confirmation impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
