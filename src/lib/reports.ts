import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { assertChipShopOwner } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";

export type ReportPeriod = "7d" | "30d" | "90d" | "all";

export const COMPLETED: OrderStatus[] = ["DELIVERED", "PICKED_UP"];
export const IN_PROGRESS: OrderStatus[] = [
  "PAID",
  "ASSIGNED",
  "FULFILLING",
  "OUT_FOR_DELIVERY",
  "READY_FOR_PICKUP",
  "AWAITING_CONFIRM",
  "FAILED",
];
export const CLOSED_BAD: OrderStatus[] = ["CANCELLED", "REFUNDED"];

export function parsePeriod(raw: string | null): ReportPeriod {
  if (raw === "7d" || raw === "30d" || raw === "90d" || raw === "all") {
    return raw;
  }
  return "30d";
}

export function periodStart(period: ReportPeriod): Date | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

export function periodLabel(period: ReportPeriod) {
  return (
    {
      "7d": "7 jours",
      "30d": "30 jours",
      "90d": "90 jours",
      all: "Tout",
    } as const
  )[period];
}

/** Boutiques visibles selon le rôle. */
export async function resolveReportScope(userId: string) {
  const { org, isOwner } = await assertChipShopOwner(userId);

  if (isOwner) {
    const shops = await withDbRetry(() =>
      prisma.shop.findMany({
        where: { organizationId: org.id, isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          ownerUserId: true,
          logoUrl: true,
        },
        orderBy: { name: "asc" },
      }),
    );
    return { isOwner: true as const, orgId: org.id, shops };
  }

  // Vendeur : uniquement ses boutiques (pas toutes via membership org).
  const shops = await withDbRetry(() =>
    prisma.shop.findMany({
      where: {
        ownerUserId: userId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerUserId: true,
        logoUrl: true,
      },
      orderBy: { name: "asc" },
    }),
  );

  return { isOwner: false as const, orgId: org.id, shops };
}

export function orderDateFilter(
  from: Date | null,
): Prisma.OrderWhereInput | undefined {
  if (!from) return undefined;
  return { createdAt: { gte: from } };
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export type OrderRow = {
  id: string;
  status: OrderStatus;
  productCents: number;
  shippingCents: number;
  protectionFeeCents: number;
  totalCents: number;
  amountCents: number;
  createdAt: Date;
  shopId: string;
  productId: string;
  product: { title: string; priceCents: number; quantity: number; images: string[] };
  shop: { id: string; name: string; ownerUserId: string | null };
  buyer: { id: string; name: string };
};

export function productRevenue(o: OrderRow) {
  return o.productCents || o.amountCents || 0;
}

export function buildSeries(orders: OrderRow[], from: Date | null, period: ReportPeriod) {
  const completed = orders.filter((o) => COMPLETED.includes(o.status));
  const map = new Map<string, { label: string; revenueCents: number; orders: number }>();

  const start =
    from ??
    (completed.length
      ? new Date(
          Math.min(...completed.map((o) => o.createdAt.getTime())),
        )
      : new Date());
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const cursor = new Date(start);
  const maxDays = period === "all" ? 120 : period === "90d" ? 90 : period === "7d" ? 7 : 30;
  let n = 0;
  while (cursor <= end && n < maxDays) {
    const key = dayKey(cursor);
    map.set(key, {
      label: cursor.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
      }),
      revenueCents: 0,
      orders: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
    n += 1;
  }

  for (const o of completed) {
    const key = dayKey(o.createdAt);
    const row = map.get(key);
    if (!row) continue;
    row.revenueCents += productRevenue(o);
    row.orders += 1;
  }

  return [...map.entries()].map(([date, v]) => ({ date, ...v }));
}

export function buildWeekdayHeat(orders: OrderRow[]) {
  const buckets = Array.from({ length: 7 }, (_, i) => ({
    day: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][i]!,
    index: i,
    revenueCents: 0,
    orders: 0,
  }));
  for (const o of orders.filter((x) => COMPLETED.includes(x.status))) {
    const i = o.createdAt.getDay();
    buckets[i]!.revenueCents += productRevenue(o);
    buckets[i]!.orders += 1;
  }
  // Décaler pour commencer lundi
  return [...buckets.slice(1), buckets[0]!].map(({ day, revenueCents, orders }) => ({
    day,
    revenueCents,
    orders,
  }));
}

export function buildHourHeat(orders: OrderRow[]) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}h`,
    revenueCents: 0,
    orders: 0,
  }));
  for (const o of orders.filter((x) => COMPLETED.includes(x.status))) {
    const h = o.createdAt.getHours();
    buckets[h]!.revenueCents += productRevenue(o);
    buckets[h]!.orders += 1;
  }
  return buckets;
}

export function summarizeOrders(orders: OrderRow[]) {
  let soldCents = 0;
  let shippingCents = 0;
  let protectionCents = 0;
  let refundedCents = 0;
  let cancelledCents = 0;
  let inProgressCents = 0;
  let soldCount = 0;
  let refundedCount = 0;
  let cancelledCount = 0;
  let inProgressCount = 0;

  for (const o of orders) {
    const amount = productRevenue(o);
    if (COMPLETED.includes(o.status)) {
      soldCents += amount;
      shippingCents += o.shippingCents;
      protectionCents += o.protectionFeeCents;
      soldCount += 1;
    } else if (o.status === "REFUNDED") {
      refundedCents += amount;
      refundedCount += 1;
    } else if (o.status === "CANCELLED") {
      cancelledCents += amount;
      cancelledCount += 1;
    } else {
      inProgressCents += amount;
      inProgressCount += 1;
    }
  }

  return {
    soldCents,
    /** Approximation bénéfice vendeur = CA produit (pas de COGS). */
    vendorGainCents: soldCents,
    /** Frais plateforme / protection (vue owner). */
    platformFeeCents: protectionCents,
    shippingCents,
    refundedCents,
    cancelledCents,
    inProgressCents,
    soldCount,
    refundedCount,
    cancelledCount,
    inProgressCount,
    orderCount: orders.length,
  };
}

export async function loadOrdersForShops(
  shopIds: string[],
  from: Date | null,
): Promise<OrderRow[]> {
  if (shopIds.length === 0) return [];
  return withDbRetry(() =>
    prisma.order.findMany({
      where: {
        shopId: { in: shopIds },
        ...(from ? { createdAt: { gte: from } } : {}),
      },
      select: {
        id: true,
        status: true,
        productCents: true,
        shippingCents: true,
        protectionFeeCents: true,
        totalCents: true,
        amountCents: true,
        createdAt: true,
        shopId: true,
        productId: true,
        product: {
          select: {
            title: true,
            priceCents: true,
            quantity: true,
            images: true,
          },
        },
        shop: {
          select: { id: true, name: true, ownerUserId: true },
        },
        buyer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ) as Promise<OrderRow[]>;
}

export async function loadProductStats(shopIds: string[], from: Date | null) {
  if (shopIds.length === 0) return [];

  const products = await withDbRetry(() =>
    prisma.product.findMany({
      where: { shopId: { in: shopIds } },
      select: {
        id: true,
        title: true,
        priceCents: true,
        quantity: true,
        status: true,
        images: true,
        shopId: true,
        shop: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  );

  const soldGroups = await withDbRetry(() =>
    prisma.order.groupBy({
      by: ["productId"],
      where: {
        shopId: { in: shopIds },
        status: { in: COMPLETED },
        ...(from ? { createdAt: { gte: from } } : {}),
      },
      _count: { _all: true },
      _sum: { productCents: true, amountCents: true },
    }),
  );

  const soldMap = new Map(
    soldGroups.map((g) => [
      g.productId,
      {
        soldQty: g._count._all,
        soldCents: g._sum.productCents || g._sum.amountCents || 0,
      },
    ]),
  );

  return products.map((p) => {
    const sold = soldMap.get(p.id) ?? { soldQty: 0, soldCents: 0 };
    const stockQty = Math.max(0, p.quantity);
    const unsoldCents = stockQty * p.priceCents;
    return {
      id: p.id,
      title: p.title,
      shopId: p.shopId,
      shopName: p.shop.name,
      priceCents: p.priceCents,
      stockQty,
      status: p.status,
      image: p.images[0] ?? null,
      soldQty: sold.soldQty,
      soldCents: sold.soldCents,
      unsoldCents,
      /** Potentiel total stock + déjà vendu (période). */
      potentialCents: sold.soldCents + unsoldCents,
    };
  });
}

export async function loadAttentionItems(shopIds: string[], from: Date | null) {
  if (shopIds.length === 0) {
    return {
      cancelled: [] as AttentionOrder[],
      refunded: [] as AttentionOrder[],
      failed: [] as AttentionOrder[],
      openIssues: [] as AttentionIssue[],
    };
  }

  const dateFilter = from ? { createdAt: { gte: from } } : {};

  const [cancelled, refunded, failed, openIssues] = await Promise.all([
    withDbRetry(() =>
      prisma.order.findMany({
        where: { shopId: { in: shopIds }, status: "CANCELLED", ...dateFilter },
        take: 40,
        orderBy: { updatedAt: "desc" },
        select: attentionOrderSelect,
      }),
    ),
    withDbRetry(() =>
      prisma.order.findMany({
        where: { shopId: { in: shopIds }, status: "REFUNDED", ...dateFilter },
        take: 40,
        orderBy: { updatedAt: "desc" },
        select: attentionOrderSelect,
      }),
    ),
    withDbRetry(() =>
      prisma.order.findMany({
        where: { shopId: { in: shopIds }, status: "FAILED", ...dateFilter },
        take: 20,
        orderBy: { updatedAt: "desc" },
        select: attentionOrderSelect,
      }),
    ),
    withDbRetry(() =>
      prisma.orderIssue.findMany({
        where: {
          shopId: { in: shopIds },
          status: { in: ["OPEN", "SELLER_REPLIED"] },
          ...(from ? { createdAt: { gte: from } } : {}),
        },
        take: 30,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderId: true,
          type: true,
          status: true,
          description: true,
          createdAt: true,
          conversationId: true,
          order: {
            select: {
              totalCents: true,
              product: { select: { title: true } },
              shop: { select: { name: true } },
              buyer: { select: { name: true } },
            },
          },
        },
      }),
    ),
  ]);

  return {
    cancelled: cancelled as AttentionOrder[],
    refunded: refunded as AttentionOrder[],
    failed: failed as AttentionOrder[],
    openIssues: openIssues as AttentionIssue[],
  };
}

const attentionOrderSelect = {
  id: true,
  status: true,
  totalCents: true,
  productCents: true,
  createdAt: true,
  updatedAt: true,
  product: { select: { title: true, images: true } },
  shop: { select: { id: true, name: true } },
  buyer: { select: { id: true, name: true } },
  pickupReceipt: { select: { redeemedAt: true } },
} satisfies Prisma.OrderSelect;

export type AttentionOrder = {
  id: string;
  status: OrderStatus;
  totalCents: number;
  productCents: number;
  createdAt: Date;
  updatedAt: Date;
  product: { title: string; images: string[] };
  shop: { id: string; name: string };
  buyer: { id: string; name: string };
  pickupReceipt: { redeemedAt: Date | null } | null;
};

export type AttentionIssue = {
  id: string;
  orderId: string;
  type: string;
  status: string;
  description: string;
  createdAt: Date;
  conversationId: string | null;
  order: {
    totalCents: number;
    product: { title: string };
    shop: { name: string };
    buyer: { name: string };
  };
};

export async function loadVendorBalances(
  shops: { id: string; name: string; ownerUserId: string | null }[],
) {
  const ownerIds = [
    ...new Set(shops.map((s) => s.ownerUserId).filter(Boolean) as string[]),
  ];
  if (ownerIds.length === 0) {
    return shops.map((s) => ({
      shopId: s.id,
      shopName: s.name,
      ownerUserId: s.ownerUserId,
      ownerName: null as string | null,
      balanceCents: 0,
    }));
  }

  const users = await withDbRetry(() =>
    prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: {
        id: true,
        name: true,
        wallet: { select: { balanceCents: true } },
      },
    }),
  );
  const byId = new Map(users.map((u) => [u.id, u]));

  return shops.map((s) => {
    const owner = s.ownerUserId ? byId.get(s.ownerUserId) : null;
    return {
      shopId: s.id,
      shopName: s.name,
      ownerUserId: s.ownerUserId,
      ownerName: owner?.name ?? null,
      balanceCents: owner?.wallet?.balanceCents ?? 0,
    };
  });
}
