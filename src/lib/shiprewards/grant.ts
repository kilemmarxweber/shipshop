import type { Prisma } from "@/generated/prisma/client";
import { lockWallet } from "@/lib/payments/ledger";
import {
  applyBucketDelta,
} from "@/lib/wallet-buckets";
import { parseCurrency, walletCents } from "@/lib/money";
import {
  FLASH_WEEKLY_CAP,
  FLAG_PERCENT,
  MIN_REWARD_PERCENT,
  PLATINUM_COMMISSION_BPS_OFF,
  PRICE_HOLD_DAYS,
  SELLER_BADGE_KIND,
  STANDARD_COMMISSION_BPS_OFF,
  STANDARD_COMMISSION_SALES,
  boostHoursForPercent,
  clampPercent,
  discountedPriceCents,
  pointsForPercent,
  promoTierForPercent,
  sellerTierForPoints,
  shipCashCents,
  utcMonthKey,
  utcWeekStart,
  type PromoTier,
  type SellerTier,
} from "@/lib/shiprewards/tiers";

type Tx = Prisma.TransactionClient;

const BOOST_HOURS = boostHoursForPercent;

export async function resolveCompareAtCents(
  tx: Tx,
  productId: string,
  currentPriceCents: number,
) {
  const cutoff = new Date(Date.now() - PRICE_HOLD_DAYS * 86_400_000);
  const lastSold = await tx.order.findFirst({
    where: {
      productId,
      status: { notIn: ["CANCELLED", "REFUNDED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { productCents: true, compareAtCents: true, createdAt: true },
  });
  const history = await tx.productPriceHistory.findMany({
    where: { productId },
    orderBy: { recordedAt: "desc" },
    take: 40,
  });
  const atCutoff =
    history.find((row) => row.recordedAt <= cutoff)?.priceCents ??
    history.at(-1)?.priceCents ??
    currentPriceCents;
  const inflatedRecently = history.some(
    (row) => row.recordedAt >= cutoff && row.priceCents < currentPriceCents,
  );
  let compareAt = currentPriceCents;
  if (inflatedRecently) {
    compareAt = atCutoff;
  }
  if (lastSold && lastSold.createdAt >= cutoff) {
    compareAt = Math.min(compareAt, lastSold.productCents);
  }
  return Math.max(100, compareAt);
}

async function ensureRewardState(tx: Tx, shopId: string) {
  return tx.shopRewardState.upsert({
    where: { shopId },
    create: { shopId },
    update: {},
  });
}

async function applyPoints(
  tx: Tx,
  input: {
    shopId: string;
    delta: number;
    reason: string;
    promoId?: string | null;
    orderId?: string | null;
    ownerUserId?: string | null;
  },
) {
  if (input.delta === 0) return;
  const existing = input.orderId
    ? await tx.shipPointLedger.findFirst({
        where: { orderId: input.orderId, reason: input.reason },
      })
    : input.promoId
      ? await tx.shipPointLedger.findFirst({
          where: { promoId: input.promoId, reason: input.reason },
        })
      : null;
  if (existing) return;
  await tx.shipPointLedger.create({
    data: {
      shopId: input.shopId,
      delta: input.delta,
      reason: input.reason,
      promoId: input.promoId ?? null,
      orderId: input.orderId ?? null,
    },
  });
  const state = await ensureRewardState(tx, input.shopId);
  const pointsBalance = Math.max(0, state.pointsBalance + input.delta);
  const sellerTier = sellerTierForPoints(pointsBalance);
  const commissionBpsOff =
    sellerTier === "PLATINUM" || sellerTier === "LEGEND"
      ? PLATINUM_COMMISSION_BPS_OFF
      : 0;
  await tx.shopRewardState.update({
    where: { shopId: input.shopId },
    data: { pointsBalance, sellerTier, commissionBpsOff },
  });
  if (input.ownerUserId && input.delta > 0) {
    await syncSellerBadge(tx, input.ownerUserId, sellerTier);
  }
}

async function syncSellerBadge(tx: Tx, userId: string, tier: SellerTier) {
  const kinds = Object.values(SELLER_BADGE_KIND);
  const rows = await tx.accountBadge.findMany({
    where: { userId, kind: { in: kinds } },
  });
  const want =
    tier === "BRONZE" ? null : SELLER_BADGE_KIND[tier as Exclude<SellerTier, "BRONZE">];
  for (const kind of kinds) {
    const existing = rows.find((r) => r.kind === kind);
    const active = kind === want;
    if (active && !existing) {
      await tx.accountBadge.create({
        data: {
          userId,
          kind,
          active: true,
          cycleKey: "shiprewards",
          earnedAt: new Date(),
        },
      });
    } else if (existing && existing.active !== active) {
      await tx.accountBadge.update({
        where: { id: existing.id },
        data: active
          ? { active: true, lostAt: null, earnedAt: new Date() }
          : { active: false, lostAt: new Date() },
      });
    }
  }
}

async function grantBoost(
  tx: Tx,
  input: {
    shopId: string;
    productId: string;
    hours: number;
    source: string;
  },
) {
  if (input.hours <= 0) return;
  const now = new Date();
  const endsAt = new Date(now.getTime() + input.hours * 3_600_000);
  await tx.shopBoost.create({
    data: {
      shopId: input.shopId,
      productId: input.productId,
      budgetCents: 0,
      days: Math.max(1, Math.ceil(input.hours / 24)),
      startsAt: now,
      endsAt,
      source: input.source,
    },
  });
}

export async function activateProductPromo(
  tx: Tx,
  input: {
    shopId: string;
    productId: string;
    percent: number;
    startsAt: Date;
    endsAt: Date | null;
    clientIdempotencyKey?: string | null;
    ownerUserId?: string | null;
  },
) {
  const percent = clampPercent(input.percent);
  const product = await tx.product.findUnique({
    where: { id: input.productId },
  });
  if (!product || product.shopId !== input.shopId) {
    throw new Error("Produit introuvable");
  }
  if (product.activePromoId) {
    throw new Error("Une promo est déjà active sur ce produit");
  }
  if (input.endsAt && input.endsAt.getTime() - input.startsAt.getTime() < 3_600_000) {
    throw new Error("Durée minimale : 1 heure");
  }

  const compareAt = await resolveCompareAtCents(tx, product.id, product.priceCents);
  const priceCents = discountedPriceCents(compareAt, percent);
  const tier = promoTierForPercent(percent);
  const flagged = percent > FLAG_PERCENT;

  if (tier === "FLASH") {
    const weekStart = utcWeekStart();
    const flashCount = await tx.productPromo.count({
      where: {
        shopId: input.shopId,
        tier: "FLASH",
        startsAt: { gte: weekStart },
        status: { in: ["ACTIVE", "ENDED"] },
      },
    });
    if (flashCount >= FLASH_WEEKLY_CAP) {
      throw new Error("Quota Flash atteint (3 / semaine)");
    }
  }

  const promo = await tx.productPromo.create({
    data: {
      shopId: input.shopId,
      productId: product.id,
      percent,
      tier: tier ?? "NONE",
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: flagged ? "FLAGGED" : "ACTIVE",
      compareAtSnapshot: compareAt,
      flagged,
      clientIdempotencyKey: input.clientIdempotencyKey || null,
    },
  });

  await tx.product.update({
    where: { id: product.id },
    data: {
      priceCents,
      compareAtCents: compareAt,
      promoPercent: percent,
      promoTier: tier,
      activePromoId: promo.id,
    },
  });
  await tx.productPriceHistory.create({
    data: {
      productId: product.id,
      shopId: input.shopId,
      priceCents,
    },
  });

  if (!flagged && percent >= MIN_REWARD_PERCENT && tier) {
    await applyPoints(tx, {
      shopId: input.shopId,
      delta: pointsForPercent(percent),
      reason: "PROMO_ACTIVATE",
      promoId: promo.id,
      ownerUserId: input.ownerUserId,
    });
    await grantBoost(tx, {
      shopId: input.shopId,
      productId: product.id,
      hours: BOOST_HOURS(percent),
      source: "SHIPREWARDS",
    });
    if (tier === "STANDARD") {
      const state = await ensureRewardState(tx, input.shopId);
      await tx.shopRewardState.update({
        where: { shopId: input.shopId },
        data: {
          commissionGrantRemaining:
            state.commissionGrantRemaining + STANDARD_COMMISSION_SALES,
        },
      });
    }
  }

  return { promo, priceCents, compareAt, tier, flagged };
}

export async function endProductPromo(
  tx: Tx,
  productId: string,
  restorePrice = true,
) {
  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product?.activePromoId) return null;
  const promo = await tx.productPromo.findUnique({
    where: { id: product.activePromoId },
  });
  if (promo && promo.status === "ACTIVE") {
    await tx.productPromo.update({
      where: { id: promo.id },
      data: { status: "ENDED", endsAt: new Date() },
    });
  }
  const nextPrice = restorePrice
    ? (promo?.compareAtSnapshot ?? product.compareAtCents ?? product.priceCents)
    : product.priceCents;
  await tx.product.update({
    where: { id: productId },
    data: {
      priceCents: nextPrice,
      compareAtCents: null,
      promoPercent: null,
      promoTier: null,
      activePromoId: null,
    },
  });
  if (nextPrice !== product.priceCents) {
    await tx.productPriceHistory.create({
      data: {
        productId,
        shopId: product.shopId,
        priceCents: nextPrice,
      },
    });
  }
  return promo;
}

export async function expireDuePromos(tx: Tx) {
  const due = await tx.productPromo.findMany({
    where: {
      status: "ACTIVE",
      endsAt: { lte: new Date() },
    },
    take: 50,
  });
  for (const promo of due) {
    const product = await tx.product.findUnique({
      where: { id: promo.productId },
    });
    if (product?.activePromoId === promo.id) {
      await endProductPromo(tx, promo.productId, true);
    } else {
      await tx.productPromo.update({
        where: { id: promo.id },
        data: { status: "ENDED" },
      });
    }
  }
}

export function rewardFeeBps(
  volumeBps: number,
  state: {
    commissionBpsOff: number;
    commissionGrantRemaining: number;
  } | null,
  promoTier: string | null | undefined,
) {
  let bps = volumeBps - (state?.commissionBpsOff ?? 0);
  let consumeGrant = false;
  if (
    promoTier === "STANDARD" &&
    (state?.commissionGrantRemaining ?? 0) > 0
  ) {
    bps -= STANDARD_COMMISSION_BPS_OFF;
    consumeGrant = true;
  }
  return { feeBps: Math.max(0, bps), consumeGrant };
}

export async function grantShipCashOnEscrow(
  tx: Tx,
  order: {
    id: string;
    shopId: string;
    buyerId: string;
    productCents: number;
    compareAtCents: number | null;
    promoPercent: number;
    promoId: string | null;
    promoTier: string | null;
  },
  seller: { userId: string; currency: string },
) {
  if (!order.compareAtCents || order.promoPercent < MIN_REWARD_PERCENT) {
    return 0;
  }
  if (order.buyerId === seller.userId) return 0;
  const cash = shipCashCents(order.compareAtCents, order.productCents);
  if (cash <= 0) return 0;

  const already = await tx.shipPointLedger.findFirst({
    where: { orderId: order.id, reason: "SHIPCASH_SALE" },
  });
  if (already) return 0;
  await tx.shipPointLedger.create({
    data: {
      shopId: order.shopId,
      delta: cash,
      reason: "SHIPCASH_SALE",
      promoId: order.promoId,
      orderId: order.id,
    },
  });

  const wallet = await tx.wallet.upsert({
    where: { userId: seller.userId },
    create: { userId: seller.userId, balanceCents: 0, currency: "USD" },
    update: {},
  });
  await lockWallet(tx, wallet.id);
  const locked = await tx.wallet.findUnique({ where: { id: wallet.id } });
  if (!locked) return 0;
  const currency = parseCurrency(seller.currency);
  const newBalance = walletCents(locked, currency) + cash;
  await tx.walletTransaction.create({
    data: {
      walletId: locked.id,
      type: "SHIPCASH_REWARD",
      amountCents: cash,
      currency,
      balanceAfterCents: newBalance,
      provider: "INTERNAL",
      status: "SUCCESS",
      reference: `SRC-${order.id.slice(0, 8)}`,
      metadata: {
        orderId: order.id,
        shopId: order.shopId,
        promoId: order.promoId,
        label: "ShipCash",
      },
    },
  });
  await tx.wallet.update({
    where: { id: locked.id },
    data: applyBucketDelta(locked, currency, cash, "VENDOR"),
  });

  const monthKey = utcMonthKey();
  const state = await ensureRewardState(tx, order.shopId);
  const shipCashMonthCents =
    state.shipCashMonthKey === monthKey ? state.shipCashMonthCents + cash : cash;
  await tx.shopRewardState.update({
    where: { shopId: order.shopId },
    data: { shipCashMonthCents, shipCashMonthKey: monthKey },
  });
  return cash;
}

export async function clawbackShipRewards(
  tx: Tx,
  order: {
    id: string;
    shopId: string;
    productCents: number;
    compareAtCents: number | null;
    promoPercent: number;
    promoId: string | null;
  },
  sellerUserId: string,
  currency: string,
) {
  if (!order.compareAtCents || order.promoPercent < MIN_REWARD_PERCENT) return;
  const done = await tx.shipPointLedger.findFirst({
    where: { orderId: order.id, reason: "SHIPCASH_CLAWBACK" },
  });
  if (done) return;
  await tx.shipPointLedger.create({
    data: {
      shopId: order.shopId,
      delta: 0,
      reason: "SHIPCASH_CLAWBACK",
      promoId: order.promoId,
      orderId: order.id,
    },
  });
  const cash = shipCashCents(order.compareAtCents, order.productCents);
  const points = pointsForPercent(order.promoPercent);
  const credited = await tx.shipPointLedger.findFirst({
    where: { orderId: order.id, reason: "SHIPCASH_SALE" },
  });

  if (cash > 0 && credited) {
    const vendorWallet = await tx.wallet.findUnique({
      where: { userId: sellerUserId },
    });
    if (vendorWallet) {
      const code = parseCurrency(currency);
      await tx.wallet.update({
        where: { id: vendorWallet.id },
        data: applyBucketDelta(vendorWallet, code, -cash, "VENDOR"),
      });
      await tx.walletTransaction.create({
        data: {
          walletId: vendorWallet.id,
          type: "SHIPCASH_CLAWBACK",
          amountCents: -cash,
          currency: code,
          balanceAfterCents: walletCents(vendorWallet, code) - cash,
          provider: "INTERNAL",
          status: "SUCCESS",
          reference: `SCC-${order.id.slice(0, 8)}`,
          metadata: { orderId: order.id, clawback: true, label: "ShipCash" },
        },
      });
    }
  }
  if (points > 0) {
    await applyPoints(tx, {
      shopId: order.shopId,
      delta: -points,
      reason: "POINTS_CLAWBACK",
      promoId: order.promoId,
      orderId: order.id,
    });
  }
}

export type { PromoTier };
