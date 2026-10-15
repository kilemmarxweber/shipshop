import type { Prisma, FulfillmentType } from "@/generated/prisma/client";
import { composeAddress } from "@/lib/address";
import { findBestCourier } from "@/lib/courier-match";
import { buildHandoverQrPayload } from "@/lib/handover";
import {
  buildVendorCancelMessage,
  CANCEL_REASONS,
  type CancelReasonCode,
  isOrderCancellable,
} from "@/lib/order-cancel";
import { generatePickupCode, quoteShipping } from "@/lib/shipping";

type Tx = Prisma.TransactionClient;

export type InsufficientFundsError = Error & {
  code: "INSUFFICIENT_FUNDS";
  needed: number;
  balance: number;
};

export function isInsufficientFunds(
  error: unknown,
): error is InsufficientFundsError {
  return (
    error instanceof Error &&
    (error as InsufficientFundsError).code === "INSUFFICIENT_FUNDS"
  );
}

export type PurchaseFulfillment = {
  fulfillmentType: FulfillmentType;
  deliveryCity?: string | null;
  deliveryAddress?: string | null;
  deliveryCommune?: string | null;
  deliveryQuartier?: string | null;
  deliveryAvenue?: string | null;
  deliveryParcelle?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  contactPhone?: string | null;
};

/** Charge wallet (product + shipping) and create order with fulfillment. */
export async function purchaseProduct(
  tx: Tx,
  buyerId: string,
  productId: string,
  fulfillment: PurchaseFulfillment,
) {
  const product = await tx.product.findUnique({
    where: { id: productId },
    include: { shop: true },
  });
  if (!product) {
    throw new Error("Produit indisponible");
  }

  if (!fulfillment.contactPhone?.trim()) {
    throw new Error("Numéro de contact obligatoire");
  }

  if (product.quantity < 1 || product.status !== "ACTIVE") {
    throw new Error("Produit indisponible");
  }

  let shippingCents = 0;
  let distanceKm: number | null = null;
  let zoneId: string | null = null;
  let deliveryLat = fulfillment.deliveryLat ?? null;
  let deliveryLng = fulfillment.deliveryLng ?? null;
  let courierId: string | null = null;
  let courierDistanceKm: number | null = null;
  let etaMinutes: number | null = null;
  let etaAt: Date | null = null;
  let initialStatus: "PAID" | "ASSIGNED" | "READY_FOR_PICKUP" = "PAID";
  let deliveryCity = fulfillment.deliveryCity?.trim() || null;
  let deliveryAddress = fulfillment.deliveryAddress?.trim() || null;
  let deliveryCommune = fulfillment.deliveryCommune?.trim() || null;
  let deliveryQuartier = fulfillment.deliveryQuartier?.trim() || null;
  let deliveryAvenue = fulfillment.deliveryAvenue?.trim() || null;
  let deliveryParcelle = fulfillment.deliveryParcelle?.trim() || null;

  if (fulfillment.fulfillmentType === "DELIVERY") {
    if (!deliveryCity) {
      throw new Error("Ville de livraison obligatoire");
    }
    deliveryAddress = composeAddress({
      city: deliveryCity,
      commune: deliveryCommune,
      quartier: deliveryQuartier,
      avenue: deliveryAvenue,
      parcelle: deliveryParcelle,
    });
    const quote = await quoteShipping({
      shopId: product.shopId,
      city: deliveryCity,
      commune: deliveryCommune,
      lat: fulfillment.deliveryLat,
      lng: fulfillment.deliveryLng,
    });
    shippingCents = quote.shippingCents;
    distanceKm = quote.distanceKm;
    zoneId = quote.zoneId;
    deliveryLat = quote.destLat;
    deliveryLng = quote.destLng;
    if (!deliveryCommune && quote.commune) {
      deliveryCommune = quote.commune;
    }

    const proposal = await findBestCourier({
      destLat: deliveryLat,
      destLng: deliveryLng,
      commune: deliveryCommune,
      remoteZone: quote.kind === "REMOTE",
    });
    if (proposal) {
      courierId = proposal.courier.id;
      courierDistanceKm = proposal.eta.distanceKm;
      etaMinutes = proposal.eta.etaMinutes;
      etaAt = proposal.eta.etaAt;
      initialStatus = "ASSIGNED";
    }
  } else {
    initialStatus = "READY_FOR_PICKUP";
  }

  const productCents = product.priceCents;
  const totalCents = productCents + shippingCents;

  const wallet = await tx.wallet.findUnique({
    where: { userId: buyerId },
  });
  if (!wallet) throw new Error("Portefeuille introuvable");

  if (wallet.balanceCents < totalCents) {
    const err = new Error("Solde insuffisant") as InsufficientFundsError;
    err.code = "INSUFFICIENT_FUNDS";
    err.needed = totalCents;
    err.balance = wallet.balanceCents;
    throw err;
  }

  const newBalance = wallet.balanceCents - totalCents;

  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balanceCents: newBalance },
  });

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "PURCHASE",
      amountCents: -totalCents,
      balanceAfterCents: newBalance,
      provider: "INTERNAL",
      status: "SUCCESS",
      reference: `ORD-${product.id.slice(0, 8)}`,
      metadata: {
        productId: product.id,
        shopId: product.shopId,
        productCents,
        shippingCents,
        fulfillmentType: fulfillment.fulfillmentType,
      },
    },
  });

  const order = await tx.order.create({
    data: {
      buyerId,
      shopId: product.shopId,
      productId: product.id,
      productCents,
      shippingCents,
      totalCents,
      amountCents: totalCents,
      fulfillmentType: fulfillment.fulfillmentType,
      deliveryCity,
      deliveryAddress,
      deliveryCommune,
      deliveryQuartier,
      deliveryAvenue,
      deliveryParcelle,
      deliveryLat,
      deliveryLng,
      contactPhone: fulfillment.contactPhone.trim(),
      zoneId,
      courierId,
      distanceKm,
      courierDistanceKm,
      etaMinutes,
      etaAt,
      status: initialStatus,
      paidAt: new Date(),
    },
    include: {
      product: true,
      shop: { select: { id: true, name: true, slug: true } },
      courier: true,
      pickupReceipt: true,
    },
  });

  await tx.deliveryEvent.create({
    data: {
      orderId: order.id,
      status: initialStatus,
      note:
        fulfillment.fulfillmentType === "PICKUP"
          ? "Paiement reçu — prêt pour retrait boutique"
          : courierId
            ? `Livreur auto-assigné · ${courierDistanceKm} km · ETA ~${etaMinutes} min (trafic inclus)`
            : "Paiement reçu — en attente d'un livreur",
      actorUserId: buyerId,
    },
  });

  // QR de remise pour retrait boutique ET livraison (scan vendeur / livreur)
  {
    const code = generatePickupCode();
    await tx.pickupReceipt.create({
      data: {
        orderId: order.id,
        code,
        qrPayload: buildHandoverQrPayload({
          orderId: order.id,
          code,
          shopId: product.shopId,
        }),
      },
    });
  }

  const nextQty = product.quantity - 1;
  await tx.product.update({
    where: { id: product.id },
    data: {
      quantity: Math.max(0, nextQty),
      status: nextQty <= 0 ? "SOLD" : "ACTIVE",
    },
  });

  if (nextQty <= 0) {
    await tx.cartItem.deleteMany({
      where: { productId: product.id },
    });
  } else {
    await tx.cartItem.deleteMany({
      where: { productId: product.id, userId: buyerId },
    });
  }

  const full = await tx.order.findUnique({
    where: { id: order.id },
    include: {
      product: true,
      shop: { select: { id: true, name: true, slug: true } },
      courier: true,
      pickupReceipt: true,
      deliveryEvents: { orderBy: { createdAt: "asc" } },
    },
  });

  return { order: full!, balanceCents: newBalance };
}

async function refundOrderInternal(
  tx: Tx,
  orderId: string,
  opts: {
    buyerId: string;
    actorUserId: string;
    toStatus: "CANCELLED" | "REFUNDED";
    note: string;
    /** Remettre le produit en stock (défaut: true). */
    restoreStock?: boolean;
  },
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      product: true,
      shop: { select: { id: true, name: true, slug: true, organizationId: true } },
      pickupReceipt: true,
    },
  });
  if (!order || order.buyerId !== opts.buyerId) {
    throw new Error("Commande introuvable");
  }
  if (
    !isOrderCancellable(
      order.status,
      order.pickupReceipt?.redeemedAt,
      order.pickupReceipt?.scannedAt,
    )
  ) {
    if (order.status === "DELIVERED" || order.status === "PICKED_UP") {
      throw new Error("Commande déjà livrée — annulation impossible");
    }
    if (
      order.pickupReceipt?.redeemedAt ||
      order.pickupReceipt?.scannedAt ||
      order.status === "AWAITING_CONFIRM"
    ) {
      throw new Error(
        "QR déjà scanné / réception en confirmation — annulation impossible",
      );
    }
    throw new Error("Commande non annulable / déjà remboursée");
  }

  const refundCents = order.totalCents || order.amountCents;
  const wallet = await tx.wallet.findUnique({
    where: { userId: opts.buyerId },
  });
  if (!wallet) throw new Error("Portefeuille introuvable");

  const newBalance = wallet.balanceCents + refundCents;

  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balanceCents: newBalance },
  });

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "REFUND",
      amountCents: refundCents,
      balanceAfterCents: newBalance,
      provider: "INTERNAL",
      status: "SUCCESS",
      reference: `REF-${order.id.slice(0, 8)}`,
      metadata: {
        orderId: order.id,
        productId: order.productId,
        toStatus: opts.toStatus,
      },
    },
  });

  const updated = await tx.order.update({
    where: { id: order.id },
    data: { status: opts.toStatus },
    include: {
      product: true,
      shop: { select: { id: true, name: true, slug: true } },
      pickupReceipt: true,
      courier: true,
    },
  });

  await tx.deliveryEvent.create({
    data: {
      orderId: order.id,
      status: opts.toStatus,
      note: opts.note,
      actorUserId: opts.actorUserId,
    },
  });

  if (opts.restoreStock !== false) {
    await tx.product.update({
      where: { id: order.productId },
      data: {
        quantity: { increment: 1 },
        status: "ACTIVE",
      },
    });
  } else {
    // Stock épuisé / défectueux : ne pas remettre en vente
    await tx.product.update({
      where: { id: order.productId },
      data: { status: "HIDDEN" },
    });
  }

  return {
    order: updated,
    balanceCents: newBalance,
    refundCents,
    shop: order.shop,
  };
}

/** Annulation client : remboursement + restore stock. */
export async function cancelOrder(tx: Tx, buyerId: string, orderId: string) {
  return refundOrderInternal(tx, orderId, {
    buyerId,
    actorUserId: buyerId,
    toStatus: "CANCELLED",
    note: "Commande annulée par le client — remboursement effectué",
    restoreStock: true,
  });
}

/** Remboursement client (colis non livré). */
export async function refundUndeliveredOrder(
  tx: Tx,
  buyerId: string,
  orderId: string,
) {
  return refundOrderInternal(tx, orderId, {
    buyerId,
    actorUserId: buyerId,
    toStatus: "REFUNDED",
    note: "Remboursement — colis non livré",
    restoreStock: true,
  });
}

/**
 * Annulation vendeur : remboursement client + message d'excuse avec motif.
 */
export async function cancelOrderByVendor(
  tx: Tx,
  vendorUserId: string,
  orderId: string,
  reason: CancelReasonCode,
  extraNote?: string,
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      shop: { select: { organizationId: true, name: true } },
      product: { select: { title: true } },
      pickupReceipt: true,
    },
  });
  if (!order) throw new Error("Commande introuvable");

  const member = await tx.member.findFirst({
    where: {
      userId: vendorUserId,
      organizationId: order.shop.organizationId,
    },
  });
  if (!member) {
    throw new Error("Réservé au vendeur de la boutique");
  }

  const meta = CANCEL_REASONS[reason];
  const result = await refundOrderInternal(tx, orderId, {
    buyerId: order.buyerId,
    actorUserId: vendorUserId,
    toStatus: "CANCELLED",
    note: `Annulation vendeur — ${meta.label}${extraNote ? `: ${extraNote}` : ""}`,
    restoreStock: meta.restoreStock,
  });

  let conversation = await tx.conversation.findUnique({
    where: {
      buyerId_shopId: {
        buyerId: order.buyerId,
        shopId: order.shopId,
      },
    },
  });
  if (!conversation) {
    conversation = await tx.conversation.create({
      data: {
        buyerId: order.buyerId,
        shopId: order.shopId,
        productId: order.productId,
      },
    });
  }

  const body = buildVendorCancelMessage({
    shopName: result.shop.name,
    productTitle: order.product.title,
    reason,
    extraNote,
    refundCents: result.refundCents,
  });

  await tx.message.create({
    data: {
      conversationId: conversation.id,
      senderId: vendorUserId,
      body,
      kind: "ORDER_CANCELLED",
    },
  });
  await tx.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  return {
    ...result,
    conversationId: conversation.id,
    reason,
    reasonLabel: meta.label,
  };
}
