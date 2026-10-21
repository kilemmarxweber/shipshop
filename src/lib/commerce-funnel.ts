import type { Prisma } from "@/generated/prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | typeof prisma;

export type FunnelKind = "FEED" | "PRODUCT" | "PURCHASE";

export async function recordFunnelEvent(
  db: Tx,
  input: {
    kind: FunnelKind;
    productId?: string | null;
    userId?: string | null;
    wantedId?: string | null;
    source?: string | null;
  },
) {
  try {
    await db.commerceFunnelEvent.create({
      data: {
        kind: input.kind,
        productId: input.productId ?? null,
        userId: input.userId ?? null,
        wantedId: input.wantedId ?? null,
        source: input.source ?? null,
      },
    });
  } catch {
    /* analytics never blocks checkout */
  }
}

export async function loadFunnelSummary(shopIds: string[], from: Date | null) {
  if (shopIds.length === 0) {
    return { feed: 0, product: 0, purchase: 0, cardToBuyBps: 0, feedToCardBps: 0 };
  }
  const products = await withDbRetry(() =>
    prisma.product.findMany({
      where: { shopId: { in: shopIds } },
      select: { id: true },
    }),
  );
  const productIds = products.map((p) => p.id);
  if (productIds.length === 0) {
    return { feed: 0, product: 0, purchase: 0, cardToBuyBps: 0, feedToCardBps: 0 };
  }
  const grouped = await withDbRetry(() =>
    prisma.commerceFunnelEvent.groupBy({
      by: ["kind"],
      where: {
        productId: { in: productIds },
        ...(from ? { createdAt: { gte: from } } : {}),
      },
      _count: { _all: true },
    }),
  );
  const count = (kind: string) =>
    grouped.find((g) => g.kind === kind)?._count._all ?? 0;
  const feed = count("FEED");
  const product = count("PRODUCT");
  const purchase = count("PURCHASE");
  return {
    feed,
    product,
    purchase,
    feedToCardBps: feed > 0 ? Math.round((product * 10_000) / feed) : 0,
    cardToBuyBps: product > 0 ? Math.round((purchase * 10_000) / product) : 0,
  };
}

export async function loadWantedIntent(from: Date | null) {
  const rows = await withDbRetry(() =>
    prisma.wantedRequest.groupBy({
      by: ["category"],
      where: from ? { createdAt: { gte: from } } : {},
      _count: { _all: true },
      _avg: { budgetCents: true },
    }),
  );
  return rows
    .map((row) => ({
      category: row.category,
      count: row._count._all,
      avgBudgetCents: Math.round(row._avg.budgetCents ?? 0),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}
