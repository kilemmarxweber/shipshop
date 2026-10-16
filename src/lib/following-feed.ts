import { prisma, withDbRetry } from "@/lib/prisma";

const BOUGHT_EXCLUDE = ["CANCELLED", "REFUNDED", "FAILED"] as const;
const USED_STATUSES = ["DELIVERED", "PICKED_UP"] as const;

/** IDs produits pour le fil Abonnements : suivis, likes, achats, reçus, partages, conversations. */
export async function collectFollowingProductIds(userId: string) {
  const [follows, likes, bought, used, shares, convos, cart] = await Promise.all([
    withDbRetry(() =>
      prisma.shopFollow.findMany({
        where: { userId },
        select: { shopId: true },
      }),
    ),
    withDbRetry(() =>
      prisma.productLike.findMany({
        where: { userId },
        select: { productId: true, createdAt: true },
      }),
    ),
    withDbRetry(() =>
      prisma.order.findMany({
        where: {
          buyerId: userId,
          status: { notIn: [...BOUGHT_EXCLUDE] },
        },
        select: { productId: true, createdAt: true },
      }),
    ),
    withDbRetry(() =>
      prisma.order.findMany({
        where: {
          buyerId: userId,
          status: { in: [...USED_STATUSES] },
        },
        select: { productId: true, updatedAt: true },
      }),
    ),
    withDbRetry(() =>
      prisma.productShare.findMany({
        where: { userId },
        select: { productId: true, createdAt: true },
      }),
    ),
    withDbRetry(() =>
      prisma.conversation.findMany({
        where: { buyerId: userId, productId: { not: null } },
        select: { productId: true, updatedAt: true },
      }),
    ),
    withDbRetry(() =>
      prisma.cartItem.findMany({
        where: { userId },
        select: { productId: true, createdAt: true },
      }),
    ),
  ]);

  const shopIds = follows.map((f) => f.shopId);
  const productIds = new Set<string>();
  const recency = new Map<string, number>();

  function touch(id: string, at: Date) {
    productIds.add(id);
    const t = at.getTime();
    recency.set(id, Math.max(recency.get(id) ?? 0, t));
  }

  for (const row of likes) touch(row.productId, row.createdAt);
  for (const row of bought) touch(row.productId, row.createdAt);
  for (const row of used) touch(row.productId, row.updatedAt);
  for (const row of shares) touch(row.productId, row.createdAt);
  for (const row of convos) {
    if (row.productId) touch(row.productId, row.updatedAt);
  }
  for (const row of cart) touch(row.productId, row.createdAt);

  return { shopIds, productIds: [...productIds], recency };
}
