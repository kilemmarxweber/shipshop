"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney, cn } from "@/lib/utils";
import { useI18n, type MessagePath } from "@/components/i18n-provider";
import { ProductImageCarousel } from "@/components/product-image-carousel";
import { Input } from "@/components/ui/input";

type Product = {
  id: string;
  title: string;
  priceCents: number;
  currency?: string;
  images: string[];
  category: string;
};

export default function DiscoverPage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const params = new URLSearchParams({ status: "ACTIVE" });
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    const timer = setTimeout(() => {
      fetchJson<{ products?: Product[] }>(`/api/products?${params}`)
        .then(({ data }) => setProducts(data?.products ?? []))
        .catch(() => setProducts([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [q, category]);

  return (
    <div className="px-4 pb-4 pt-3 md:px-8">
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border bg-surface-2 px-3">
        <Search className="size-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("discover.searchPlaceholder")}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
      </div>

      <Link
        href="/wanted"
        className="mb-5 flex items-center justify-between rounded-2xl border border-border bg-surface-2 px-4 py-3"
      >
        <span>
          <span className="block font-heading text-sm font-bold">
            {t("wanted.title")}
          </span>
          <span className="text-[11px] text-muted-foreground">
            Demandes d’achat — neuf ou occasion
          </span>
        </span>
        <span className="text-xs font-semibold text-primary">Voir</span>
      </Link>

      <h2 className="mb-3 font-heading text-sm font-bold">
        {t("discover.categoriesHeading")}
      </h2>
      <div className="h-scroll h-scroll-fade mb-5 gap-2.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() =>
              setCategory((prev) => (prev === c.id ? null : c.id))
            }
            className={cn(
              "relative size-[4.5rem] shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br p-2 sm:size-20",
              c.gradient,
              category === c.id && "ring-2 ring-primary ring-offset-2 ring-offset-background",
            )}
          >
            <span className="absolute inset-x-0 bottom-1 text-center text-[9px] font-bold">
              {t(`categories.${c.id}` as MessagePath)}
            </span>
          </button>
        ))}
      </div>

      <h2 className="mb-3 font-heading text-sm font-bold">
        {t("discover.trendsHeading")}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/product/${p.id}`}
            className="group relative aspect-[3/4] overflow-hidden rounded-2xl"
          >
            <ProductImageCarousel
              images={p.images}
              className="absolute inset-0"
              showDots={p.images.length > 1}
              intervalMs={3500}
            />
            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 to-transparent p-3">
              <p className="truncate text-xs font-bold">{p.title}</p>
              <p className="text-[11px] font-bold text-trust">
                {formatMoney(p.priceCents, p.currency)}
              </p>
            </div>
          </Link>
        ))}
      </div>
      {products.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("discover.emptyResults")}
        </p>
      )}
    </div>
  );
}
