"use client";

import Link from "next/link";
import { ShoppingBag, Star } from "lucide-react";
import { MediaThumb } from "@/components/media-thumb";
import { hasPromoPrice } from "@/components/product-price-tag";
import { compactCount } from "@/lib/growth/challenge-look";
import type { UserLocale } from "@/lib/user-locale";
import { cn, formatMoney } from "@/lib/utils";

export type FeedBuyProduct = {
  id: string;
  title: string;
  images: string[];
  priceCents: number;
  currency?: string | null;
  compareAtCents?: number | null;
  promoPercent?: number | null;
  likesCount?: number;
  commentsCount?: number;
  soldCount?: number;
};

export function FeedBuyCard({
  product,
  onBuy,
  buyLabel,
  reviewsLabel,
  locale,
  className,
}: {
  product: FeedBuyProduct;
  onBuy: () => void;
  buyLabel: string;
  reviewsLabel: string;
  locale?: UserLocale;
  className?: string;
}) {
  const promo = hasPromoPrice(product);
  const percent = promo
    ? (product.promoPercent ??
      Math.round(
        (1 - product.priceCents / (product.compareAtCents as number)) * 100,
      ))
    : 0;
  const reviews =
    product.commentsCount ||
    product.soldCount ||
    product.likesCount ||
    0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onBuy}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onBuy();
        }
      }}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-[1.35rem] border border-white/14 bg-[rgba(18,16,22,0.72)] p-2 pr-2 pl-2 shadow-[0_10px_28px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:gap-3 sm:p-2.5",
        className,
      )}
    >
      <Link
        href={`/product/${product.id}`}
        className="contents"
        onClick={(e) => e.stopPropagation()}
      >
        <MediaThumb
          images={product.images}
          className="size-14 shrink-0 rounded-[0.9rem] ring-1 ring-white/15 sm:size-[3.6rem]"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold leading-tight text-white sm:text-sm">
          {product.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold">
          {reviews > 0 ? (
            <>
              <Star className="size-3 fill-[#ffc107] text-[#ffc107]" />
              <span className="text-white/90">
                ({compactCount(reviews, locale)} {reviewsLabel})
              </span>
            </>
          ) : null}
          {promo ? (
            <span className="font-extrabold text-[#ff4d9a]">−{percent}%</span>
          ) : null}
        </p>
        <p className="mt-0.5 flex items-baseline gap-x-1.5 whitespace-nowrap">
          <span className="font-heading text-[15px] font-black tracking-tight text-[#3DFF9A] sm:text-base">
            {formatMoney(product.priceCents, product.currency ?? undefined)}
          </span>
          {promo ? (
            <span className="text-[11px] font-semibold text-white/45 line-through">
              {formatMoney(
                product.compareAtCents as number,
                product.currency ?? undefined,
              )}
            </span>
          ) : null}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onBuy();
        }}
        className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-[#ff2d78] px-3 text-[12px] font-extrabold text-white shadow-[0_8px_18px_rgba(255,45,120,0.42)] transition hover:bg-[#ff4d90] active:scale-[0.97] sm:min-h-12 sm:px-3.5 sm:text-[13px]"
      >
        <ShoppingBag className="size-4" strokeWidth={2.4} />
        {buyLabel}
      </button>
    </div>
  );
}
