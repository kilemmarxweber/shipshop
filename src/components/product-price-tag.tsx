import { formatMoney, cn } from "@/lib/utils";

export type PromoPrice = {
  priceCents: number;
  currency?: string | null;
  compareAtCents?: number | null;
  promoPercent?: number | null;
};

export function hasPromoPrice(p: PromoPrice) {
  return Boolean(
    p.compareAtCents &&
      p.compareAtCents > p.priceCents &&
      (p.promoPercent ?? 0) > 0,
  );
}

export function ProductPriceTag({
  priceCents,
  currency,
  compareAtCents,
  promoPercent,
  className,
  size = "md",
}: PromoPrice & {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const show = hasPromoPrice({
    priceCents,
    compareAtCents,
    promoPercent,
  });
  const priceClass =
    size === "lg"
      ? "font-heading text-2xl font-black sm:text-3xl"
      : size === "sm"
        ? "font-heading text-sm font-bold"
        : "font-heading text-sm font-bold";
  if (!show) {
    return (
      <p className={cn(priceClass, "text-trust", className)}>
        {formatMoney(priceCents, currency ?? undefined)}
      </p>
    );
  }
  const percent = promoPercent ?? Math.round(
    (1 - priceCents / (compareAtCents as number)) * 100,
  );
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span
        className={cn(
          priceClass,
          "text-red-500 line-through decoration-red-500/80",
        )}
      >
        {formatMoney(compareAtCents as number, currency ?? undefined)}
      </span>
      <span className={cn(priceClass, "text-emerald-400")}>
        {formatMoney(priceCents, currency ?? undefined)}
      </span>
      <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
        −{percent} %
      </span>
    </div>
  );
}
