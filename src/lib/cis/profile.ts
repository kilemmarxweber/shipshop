import { prisma, withDbRetry } from "@/lib/prisma";
import {
  CIS_EVENT_WEIGHTS,
  CIS_HALF_LIFE_HOURS,
  type CisEventType,
} from "@/lib/cis/constants";

export type PreferenceBucket = {
  kind: "category" | "shop";
  key: string;
  score: number;
  factors: Record<string, number>;
};

function decay(occurredAt: Date, now = Date.now()) {
  const ageHours = Math.max(0, (now - occurredAt.getTime()) / 3_600_000);
  return Math.pow(0.5, ageHours / CIS_HALF_LIFE_HOURS);
}

export function accumulatePreferences(
  events: Array<{
    type: string;
    category: string | null;
    shopId: string | null;
    occurredAt: Date;
  }>,
  now = Date.now(),
): PreferenceBucket[] {
  const map = new Map<string, PreferenceBucket>();

  for (const event of events) {
    const weight =
      CIS_EVENT_WEIGHTS[event.type as CisEventType] ?? 0.2;
    const w = weight * decay(event.occurredAt, now);
    if (event.category) {
      const id = `category:${event.category}`;
      const row = map.get(id) ?? {
        kind: "category" as const,
        key: event.category,
        score: 0,
        factors: {},
      };
      row.score += w;
      row.factors[event.type] = (row.factors[event.type] ?? 0) + w;
      map.set(id, row);
    }
    if (event.shopId) {
      const id = `shop:${event.shopId}`;
      const row = map.get(id) ?? {
        kind: "shop" as const,
        key: event.shopId,
        score: 0,
        factors: {},
      };
      row.score += w;
      row.factors[event.type] = (row.factors[event.type] ?? 0) + w;
      map.set(id, row);
    }
  }

  return [...map.values()].sort((a, b) => b.score - a.score);
}

export async function recomputeCisPreferences(userId: string) {
  const since = new Date(Date.now() - 90 * 24 * 3_600_000);
  const events = await withDbRetry(() =>
    prisma.cisEvent.findMany({
      where: { userId, occurredAt: { gte: since } },
      select: {
        type: true,
        category: true,
        shopId: true,
        occurredAt: true,
      },
      take: 2000,
      orderBy: { occurredAt: "desc" },
    }),
  );

  const buckets = accumulatePreferences(events).slice(0, 80);

  await withDbRetry(async () => {
    await prisma.$transaction([
      prisma.cisPreference.deleteMany({ where: { userId } }),
      ...(buckets.length
        ? [
            prisma.cisPreference.createMany({
              data: buckets.map((row) => ({
                userId,
                kind: row.kind,
                key: row.key,
                score: row.score,
                factors: row.factors,
              })),
            }),
          ]
        : []),
    ]);
  });

  return buckets;
}

export async function loadCisPreferenceBoost(userId: string) {
  const rows = await withDbRetry(() =>
    prisma.cisPreference.findMany({
      where: { userId },
      orderBy: { score: "desc" },
      take: 40,
    }),
  );
  const categories = new Map<string, number>();
  const shops = new Map<string, number>();
  for (const row of rows) {
    if (row.kind === "category") categories.set(row.key, row.score);
    if (row.kind === "shop") shops.set(row.key, row.score);
  }
  return { categories, shops };
}

export function cisMatchScore(
  product: { category?: string | null; shopId?: string | null },
  prefs: { categories: Map<string, number>; shops: Map<string, number> },
) {
  let score = 0;
  const reasons: string[] = [];
  if (product.category && prefs.categories.has(product.category)) {
    const raw = prefs.categories.get(product.category) ?? 0;
    const part = Math.min(2.4, Math.log1p(raw) * 0.85);
    score += part;
    reasons.push(`category:${product.category}`);
  }
  if (product.shopId && prefs.shops.has(product.shopId)) {
    const raw = prefs.shops.get(product.shopId) ?? 0;
    const part = Math.min(2.0, Math.log1p(raw) * 0.7);
    score += part;
    reasons.push(`shop:${product.shopId}`);
  }
  return { score, reasons };
}
