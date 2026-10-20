import type { Prisma, FulfillmentType } from "@/generated/prisma/client";
import { composeAddress } from "@/lib/address";
import {
  findBestCourier,
  formatCourierAssignNote,
} from "@/lib/courier-match";
import { buildHandoverQrPayload } from "@/lib/handover";
import {
  createShopHandover,
  maybeCompleteShopHandover,
} from "@/lib/shop-handover";
import {
  buildVendorCancelMessage,
  CANCEL_REASONS,
  type CancelReasonCode,
  isOrderCancellable,
} from "@/lib/order-cancel";
import { quoteShipping } from "@/lib/shipping";
import { lockWallet } from "@/lib/payments/ledger";
import {
  APP_CURRENCIES,
  fromUsdCents,
  parseCurrency,
  shopFxRates,
  toUsdCents,
  usdCentsNeeded,
  walletCents,
  walletEquivalentCents,
  type AppCurrency,
} from "@/lib/money";
import {
  courierNetCents,
  refundProductCents,
  saleFeeCents,
  shippingFeeCents,
  shouldRefundShipping,
  vendorNetCents,
} from "@/lib/platform-fees";
import { creditTreasury, reverseSaleFee } from "@/lib/platform-ledger";
import {
  applyBucketDelta,
  drainBucketsData,
} from "@/lib/wallet-buckets";

type Tx = Prisma.TransactionClient;

export type InsufficientFundsError = Error & {
  code: "INSUFFICIENT_FUNDS";
  needed: number;
  balance: number;
};

export function isInsufficientFunds(
  error: unknown,
): error is InsufficientFundsError {
  if (!(error instanceof Error)) return false;
  if ((error as InsufficientFundsError).code === "INSUFFICIENT_FUNDS") {
    return true;
  }
  return /solde insuffisant/i.test(error.message);
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
  optionColor?: string | null;
  optionSize?: string | null;
};

export type PurchaseOpts = {
  handoverId?: string;
  skipShippingQuote?: boolean;
  shippingCents?: number;
};

/** Charge wallet (product + shipping) and create order with fulfillment. */
export async function purchaseProduct(
  tx: Tx,
  buyerId: string,
  productId: string,
  fulfillment: PurchaseFulfillment,
  opts?: PurchaseOpts,
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
  let autoCourierNote: string | null = null;

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
    if (opts?.skipShippingQuote) {
      shippingCents = opts.shippingCents ?? 0;
    } else {
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

    // Auto-livreur : plus proche + disponible (boutique / plateforme)
    const proposal = await findBestCourier({
      destLat: deliveryLat,
      destLng: deliveryLng,
      commune: deliveryCommune,
      remoteZone: quote.kind === "REMOTE",
      shopId: product.shopId,
      zoneId: quote.zoneId,
    });
    if (proposal) {
      courierId = proposal.courier.id;
      courierDistanceKm = proposal.eta.distanceKm;
      etaMinutes = proposal.eta.etaMinutes;
      etaAt = proposal.eta.etaAt;
      initialStatus = "ASSIGNED";
      autoCourierNote = formatCourierAssignNote(
        proposal.courier,
        proposal.eta,
        proposal.reason,
      );
    }
    }
  } else {
    initialStatus = "READY_FOR_PICKUP";
  }

  const productCents = product.priceCents;
  const totalCents = productCents + shippingCents;
  const currency = parseCurrency(product.currency);
  const shopFx = shopFxRates(product.shop);

  const walletRow = await tx.wallet.findUnique({
    where: { userId: buyerId },
  });
  if (!walletRow) throw new Error("Portefeuille introuvable");
  await lockWallet(tx, walletRow.id);
  const wallet = await tx.wallet.findUnique({ where: { id: walletRow.id } });
  if (!wallet) throw new Error("Portefeuille introuvable");

  const equivalent = walletEquivalentCents(wallet, currency, shopFx);
  if (equivalent < totalCents) {
    const err = new Error("Solde insuffisant") as InsufficientFundsError;
    err.code = "INSUFFICIENT_FUNDS";
    err.needed = totalCents;
    err.balance = equivalent;
    throw err;
  }

  const pockets: Record<AppCurrency, number> = {
    USD: walletCents(wallet, "USD"),
    CDF: walletCents(wallet, "CDF"),
    KW: walletCents(wallet, "KW"),
  };
  const conversions: {
    from: AppCurrency;
    fromCents: number;
    to: AppCurrency;
    toCents: number;
    usdCents: number;
  }[] = [];

  let remaining = Math.max(0, totalCents - pockets[currency]);
  if (remaining > 0) {
    const sources = APP_CURRENCIES.filter((code) => code !== currency);
    for (const src of sources) {
      if (remaining <= 0) break;
      const have = pockets[src];
      if (have <= 0) continue;
      const needUsd = usdCentsNeeded(remaining, currency, shopFx);
      const haveUsd = toUsdCents(have, src, shopFx);
      const takeUsd = Math.min(needUsd, haveUsd);
      if (takeUsd <= 0) continue;
      const fromCents = fromUsdCents(takeUsd, src, shopFx);
      const toCents = fromUsdCents(takeUsd, currency, shopFx);
      if (fromCents <= 0 || toCents <= 0) continue;
      pockets[src] -= fromCents;
      pockets[currency] += toCents;
      remaining = Math.max(0, remaining - toCents);
      conversions.push({
        from: src,
        fromCents,
        to: currency,
        toCents,
        usdCents: takeUsd,
      });
    }
  }

  if (pockets[currency] < totalCents) {
    const err = new Error("Solde insuffisant") as InsufficientFundsError;
    err.code = "INSUFFICIENT_FUNDS";
    err.needed = totalCents;
    err.balance = walletEquivalentCents(wallet, currency, shopFx);
    throw err;
  }

  for (const fx of conversions) {
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "ADJUSTMENT",
        amountCents: -fx.fromCents,
        currency: fx.from,
        balanceAfterCents: pockets[fx.from],
        provider: "INTERNAL",
        status: "SUCCESS",
        reference: `FX-${product.id.slice(0, 8)}`,
        metadata: {
          fx: true,
          from: fx.from,
          to: fx.to,
          fromCents: fx.fromCents,
          toCents: fx.toCents,
          usdCents: fx.usdCents,
          cdfPerUsd: shopFx.cdfPerUsd,
          kwPerUsd: shopFx.kwPerUsd,
        },
      },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "ADJUSTMENT",
        amountCents: fx.toCents,
        currency: fx.to,
        balanceAfterCents: pockets[fx.to],
        provider: "INTERNAL",
        status: "SUCCESS",
        reference: `FX-${product.id.slice(0, 8)}`,
        metadata: {
          fx: true,
          from: fx.from,
          to: fx.to,
          fromCents: fx.fromCents,
          toCents: fx.toCents,
          usdCents: fx.usdCents,
          cdfPerUsd: shopFx.cdfPerUsd,
          kwPerUsd: shopFx.kwPerUsd,
        },
      },
    });
  }

  pockets[currency] -= totalCents;
  const newBalance = pockets[currency];

  const originalPockets: Record<AppCurrency, number> = {
    USD: walletCents(wallet, "USD"),
    CDF: walletCents(wallet, "CDF"),
    KW: walletCents(wallet, "KW"),
  };
  let bucketData: Record<string, number> = {};
  let working = { ...wallet };
  for (const code of APP_CURRENCIES) {
    const delta = originalPockets[code] - pockets[code];
    if (delta > 0) {
      bucketData = {
        ...bucketData,
        ...drainBucketsData(working, code, delta),
      };
      working = { ...working, ...bucketData };
    } else if (delta < 0) {
      const credit = applyBucketDelta(working, code, -delta, "BUYER");
      bucketData = {
        ...bucketData,
        ...Object.fromEntries(
          Object.entries(credit).filter(([, value]) => typeof value === "number"),
        ) as Record<string, number>,
      };
      working = { ...working, ...bucketData };
    }
  }

  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      usdCents: pockets.USD,
      cdfCents: pockets.CDF,
      kwCents: pockets.KW,
      balanceCents: pockets.USD,
      ...bucketData,
    },
  });

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "PURCHASE",
      amountCents: -totalCents,
      currency,
      balanceAfterCents: newBalance,
      provider: "INTERNAL",
      status: "SUCCESS",
      reference: `ORD-${product.id.slice(0, 8)}`,
      metadata: {
        productId: product.id,
        shopId: product.shopId,
        productCents,
        shippingCents,
        currency,
        fulfillmentType: fulfillment.fulfillmentType,
        escrow: true,
        optionColor: fulfillment.optionColor ?? null,
        optionSize: fulfillment.optionSize ?? null,
        fx: conversions,
        cdfPerUsd: shopFx.cdfPerUsd,
        kwPerUsd: shopFx.kwPerUsd,
      },
    },
  });

  const handover =
    opts?.handoverId
      ? await tx.shopHandover.findUnique({ where: { id: opts.handoverId } })
      : await createShopHandover(tx, buyerId, product.shopId);
  if (!handover || handover.shopId !== product.shopId) {
    throw new Error("QR boutique introuvable");
  }

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
      optionColor: fulfillment.optionColor?.trim() || null,
      optionSize: fulfillment.optionSize?.trim() || null,
      handoverId: handover.id,
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
          ? "Payé et bloqué — prêt pour retrait. Le vendeur est payé à la réception."
          : autoCourierNote
            ? `${autoCourierNote} · argent bloqué jusqu’à réception`
            : "Payé et bloqué — en attente d'un livreur",
      actorUserId: buyerId,
    },
  });

  // QR unique par article : la remise et le paiement ne concernent que ce produit.
  {
    const itemCode = `${handover.code}-${order.id.slice(-4).toUpperCase()}`;
    await tx.pickupReceipt.create({
      data: {
        orderId: order.id,
        code: itemCode,
        qrPayload: buildHandoverQrPayload({
          orderId: order.id,
          code: itemCode,
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
      handover: true,
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
  if (order.status === "CANCELLED" || order.status === "REFUNDED") {
    throw new Error("Commande déjà remboursée");
  }
  const cancellable = isOrderCancellable(
    order.status,
    order.pickupReceipt?.redeemedAt,
    order.pickupReceipt?.scannedAt,
  );
  if (!cancellable && !order.escrowReleasedAt) {
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

  const currency = parseCurrency(order.product.currency);
  const shopFx = shopFxRates();
  const productRefund = refundProductCents(order);
  const shipRefund = shouldRefundShipping(order) ? order.shippingCents : 0;
  const refundCents = productRefund + shipRefund;

  if (order.escrowReleasedAt && productRefund > 0) {
    const shop = await tx.shop.findUnique({
      where: { id: order.shopId },
      select: { ownerUserId: true },
    });
    const sellerId = shop?.ownerUserId;
    if (sellerId) {
      const vendorWallet = await tx.wallet.findUnique({
        where: { userId: sellerId },
      });
      if (vendorWallet) {
        const net = vendorNetCents(order.productCents, currency, shopFx);
        await tx.wallet.update({
          where: { id: vendorWallet.id },
          data: applyBucketDelta(vendorWallet, currency, -net, "VENDOR"),
        });
        await tx.walletTransaction.create({
          data: {
            walletId: vendorWallet.id,
            type: "ADJUSTMENT",
            amountCents: -net,
            currency,
            balanceAfterCents: walletCents(vendorWallet, currency) - net,
            provider: "INTERNAL",
            status: "SUCCESS",
            reference: `CLW-${order.id.slice(0, 8)}`,
            metadata: { orderId: order.id, clawback: true },
          },
        });
      }
    }
    await reverseSaleFee(tx, order.id);
  }

  const wallet = await tx.wallet.findUnique({
    where: { userId: opts.buyerId },
  });
  if (!wallet) throw new Error("Portefeuille introuvable");

  const newBalance = walletCents(wallet, currency) + refundCents;

  await tx.wallet.update({
    where: { id: wallet.id },
    data: applyBucketDelta(wallet, currency, refundCents, "BUYER"),
  });

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "REFUND",
      amountCents: refundCents,
      currency,
      balanceAfterCents: newBalance,
      provider: "INTERNAL",
      status: "SUCCESS",
      reference: `REF-${order.id.slice(0, 8)}`,
      metadata: {
        orderId: order.id,
        productId: order.productId,
        toStatus: opts.toStatus,
        productRefund,
        shippingRefund: shipRefund,
        fee: 0,
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

  await maybeCompleteShopHandover(tx, order.handoverId);

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

/** Crédite le livreur (transport − 0,50 $US) — idempotent par commande. */
export async function releaseShippingToCourier(tx: Tx, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      product: { select: { currency: true } },
      shop: { select: { fxCdfPerUsd: true, fxKwPerUsd: true } },
      courier: { select: { id: true, userId: true } },
    },
  });
  if (!order || order.shippingCents <= 0) return null;
  const existing = await tx.platformFee.findUnique({
    where: { orderId_kind: { orderId: order.id, kind: "SHIPPING" } },
  });
  if (existing && !existing.reversedAt) return null;

  const currency = parseCurrency(order.product.currency);
  const fx = shopFxRates(order.shop);
  const fee = shippingFeeCents(order.shippingCents, currency, fx);
  const net = courierNetCents(order.shippingCents, currency, fx);

  if (!order.courier?.userId) {
    await tx.order.update({
      where: { id: order.id },
      data: { shippingFeePending: true, shippingFeeCents: fee },
    });
    return { pending: true, fee };
  }

  const wallet = await tx.wallet.upsert({
    where: { userId: order.courier.userId },
    create: { userId: order.courier.userId, balanceCents: 0, currency: "USD" },
    update: {},
  });
  await lockWallet(tx, wallet.id);
  const locked = await tx.wallet.findUnique({ where: { id: wallet.id } });
  if (!locked) throw new Error("Portefeuille livreur introuvable");

  if (net > 0) {
    const newBalance = walletCents(locked, currency) + net;
    await tx.wallet.update({
      where: { id: locked.id },
      data: applyBucketDelta(locked, currency, net, "COURIER"),
    });
    await tx.walletTransaction.create({
      data: {
        walletId: locked.id,
        type: "COURIER_PAYOUT",
        amountCents: net,
        currency,
        balanceAfterCents: newBalance,
        provider: "INTERNAL",
        status: "SUCCESS",
        reference: `CRR-${order.id.slice(0, 8)}`,
        metadata: {
          orderId: order.id,
          gross: order.shippingCents,
          fee,
          net,
        },
      },
    });
  }

  if (fee > 0) {
    await creditTreasury(tx, {
      amountCents: fee,
      currency,
      kind: "SHIPPING",
      orderId: order.id,
      shopId: order.shopId,
      courierId: order.courierId,
      fx,
    });
  }

  await tx.order.update({
    where: { id: order.id },
    data: {
      shippingFeeCents: fee,
      shippingFeePending: false,
    },
  });
  return { net, fee };
}

/** Crédite le vendeur (prix − 0,50 $US) une fois la réception confirmée. */
export async function releaseEscrowToSeller(tx: Tx, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      shop: {
        select: {
          ownerUserId: true,
          fxCdfPerUsd: true,
          fxKwPerUsd: true,
        },
      },
      product: { select: { currency: true } },
    },
  });
  if (!order || order.escrowReleasedAt) return null;
  const sellerId = order.shop.ownerUserId;
  if (!sellerId) return null;

  const currency = parseCurrency(order.product.currency);
  const fx = shopFxRates(order.shop);
  const fee = saleFeeCents(order.productCents, currency, fx);
  const creditCents = vendorNetCents(order.productCents, currency, fx);

  if (order.productCents <= 0) {
    await tx.order.update({
      where: { id: order.id },
      data: { escrowReleasedAt: new Date(), saleFeeCents: 0 },
    });
    await releaseShippingToCourier(tx, order.id);
    return { credited: 0 };
  }

  const wallet = await tx.wallet.upsert({
    where: { userId: sellerId },
    create: { userId: sellerId, balanceCents: 0, currency: "USD" },
    update: {},
  });
  await lockWallet(tx, wallet.id);
  const locked = await tx.wallet.findUnique({ where: { id: wallet.id } });
  if (!locked) throw new Error("Portefeuille vendeur introuvable");

  const newBalance = walletCents(locked, currency) + creditCents;
  await tx.wallet.update({
    where: { id: locked.id },
    data: applyBucketDelta(locked, currency, creditCents, "VENDOR"),
  });
  await tx.walletTransaction.create({
    data: {
      walletId: locked.id,
      type: "ESCROW_RELEASE",
      amountCents: creditCents,
      currency,
      balanceAfterCents: newBalance,
      provider: "INTERNAL",
      status: "SUCCESS",
      reference: `ESC-${order.id.slice(0, 8)}`,
      metadata: {
        orderId: order.id,
        productId: order.productId,
        shopId: order.shopId,
        buyerId: order.buyerId,
        gross: order.productCents,
        fee,
        net: creditCents,
      },
    },
  });

  if (fee > 0) {
    await creditTreasury(tx, {
      amountCents: fee,
      currency,
      kind: "SALE",
      orderId: order.id,
      shopId: order.shopId,
      fx,
    });
  }

  await tx.order.update({
    where: { id: order.id },
    data: { escrowReleasedAt: new Date(), saleFeeCents: fee },
  });
  await releaseShippingToCourier(tx, order.id);
  await maybeCompleteShopHandover(tx, order.handoverId);
  return { credited: creditCents, sellerBalance: newBalance, currency, fee };
}
