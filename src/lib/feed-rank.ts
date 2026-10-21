import { isVideoUrl } from "@/lib/media";
import { haversineKm } from "@/lib/shipping";
import { tasteMatchScore, type BuyerTaste } from "@/lib/taste-tokens";

export type RankableProduct = {
  id: string;
  shopId?: string;
  title?: string;
  category?: string;
  createdAt: Date;
  images: string[];
  likesCount?: number;
  commentsCount?: number;
  boosted?: boolean;
  shop: { lat?: number | null; lng?: number | null };
};

export type GeoPoint = { lat: number; lng: number };

export function productHasVideoMedia(images: string[]) {
  return images.some((url) => isVideoUrl(url));
}

/** Score lisible : vidéo, proximité, récence, engagement, légèrement following. */
export function feedRankScore(
  product: RankableProduct,
  near?: GeoPoint | null,
  now = Date.now(),
  followedShopIds?: Set<string> | null,
  taste?: BuyerTaste | null,
) {
  const ageHours = Math.max(0, (now - product.createdAt.getTime()) / 3_600_000);
  const recency = Math.exp(-ageHours / 72);
  const video = productHasVideoMedia(product.images) ? 1 : 0;
  const engagement = Math.log1p(
    (product.likesCount ?? 0) + (product.commentsCount ?? 0) * 2,
  );
  let proximity = 0;
  if (
    near &&
    Number.isFinite(near.lat) &&
    Number.isFinite(near.lng) &&
    product.shop.lat != null &&
    product.shop.lng != null
  ) {
    const km = haversineKm(
      near.lat,
      near.lng,
      product.shop.lat,
      product.shop.lng,
    );
    proximity = Math.exp(-km / 8);
  }
  const following =
    product.shopId && followedShopIds?.has(product.shopId) ? 1 : 0;
  const personal =
    product.shopId && product.title && product.category
      ? tasteMatchScore(
          {
            title: product.title,
            category: product.category,
            shopId: product.shopId,
          },
          taste,
        )
      : 0;
  const boosted = product.boosted ? 1 : 0;
  return (
    video * 3.2 +
    proximity * 3.6 +
    recency * 1.6 +
    engagement * 0.5 +
    following * 0.8 +
    personal * 1.15 +
    boosted * 4.2
  );
}

export function sortByFeedRank<T extends RankableProduct>(
  products: T[],
  near?: GeoPoint | null,
  followedShopIds?: Set<string> | null,
  taste?: BuyerTaste | null,
) {
  const now = Date.now();
  return [...products].sort((a, b) => {
    const diff =
      feedRankScore(b, near, now, followedShopIds, taste) -
      feedRankScore(a, near, now, followedShopIds, taste);
    if (diff !== 0) return diff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}
