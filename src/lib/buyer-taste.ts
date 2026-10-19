import { prisma, withDbRetry } from "@/lib/prisma";
import {
  addTasteWeight,
  emptyTaste,
  tasteTokens,
  type BuyerTaste,
} from "@/lib/taste-tokens";

const LIKE_W = 3;
const COMMENT_W = 3.5;
const WANTED_W = 5;
const DWELL_W = 2.2;
const ORDER_W = 2.5;

function addProductSignals(
  taste: BuyerTaste,
  product: { title: string; category: string; shopId: string } | null,
  weight: number,
) {
  if (!product) return;
  addTasteWeight(taste.categories, product.category, weight);
  addTasteWeight(taste.shopIds, product.shopId, weight * 0.85);
  for (const token of tasteTokens(product.title)) {
    addTasteWeight(taste.tokens, token, weight);
  }
}

/** Goût acheteur : likes, commentaires, « je cherche », temps de vue, achats. */
export async function loadBuyerTaste(userId: string): Promise<BuyerTaste> {
  const taste = emptyTaste();
  const [likes, comments, wanted, dwells, orders] = await Promise.all([
    withDbRetry(() =>
      prisma.productLike.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 80,
        select: {
          product: { select: { title: true, category: true, shopId: true } },
        },
      }),
    ),
    withDbRetry(() =>
      prisma.productComment.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 80,
        select: {
          product: { select: { title: true, category: true, shopId: true } },
        },
      }),
    ),
    withDbRetry(() =>
      prisma.wantedRequest.findMany({
        where: { buyerId: userId, status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { title: true, category: true },
      }),
    ),
    withDbRetry(() =>
      prisma.productDwell.findMany({
        where: { userId, dwellMs: { gte: 12_000 } },
        orderBy: { dwellMs: "desc" },
        take: 60,
        select: {
          dwellMs: true,
          product: { select: { title: true, category: true, shopId: true } },
        },
      }),
    ),
    withDbRetry(() =>
      prisma.order.findMany({
        where: {
          buyerId: userId,
          status: { notIn: ["CANCELLED", "REFUNDED", "FAILED"] },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          product: { select: { title: true, category: true, shopId: true } },
        },
      }),
    ),
  ]);

  for (const row of likes) addProductSignals(taste, row.product, LIKE_W);
  for (const row of comments) addProductSignals(taste, row.product, COMMENT_W);
  for (const row of wanted) {
    addTasteWeight(taste.categories, row.category, WANTED_W);
    for (const token of tasteTokens(row.title)) {
      addTasteWeight(taste.tokens, token, WANTED_W);
    }
  }
  for (const row of dwells) {
    const minutes = Math.min(12, row.dwellMs / 60_000);
    addProductSignals(taste, row.product, DWELL_W * Math.log1p(minutes * 4));
  }
  for (const row of orders) addProductSignals(taste, row.product, ORDER_W);

  return taste;
}

export function topTasteKeys(map: Map<string, number>, n: number) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => key);
}
