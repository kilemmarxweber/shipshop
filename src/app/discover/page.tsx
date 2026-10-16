"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney, cn } from "@/lib/utils";
import { ProductImageCarousel } from "@/components/product-image-carousel";
import { Input } from "@/components/ui/input";

type Product = {
  id: string;
  title: string;
  priceCents: number;
  images: string[];
  category: string;
};

export default function DiscoverPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const params = new URLSearchParams({ status: "ACTIVE" });
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    const t = setTimeout(() => {
      fetchJson<{ products?: Product[] }>(`/api/products?${params}`)
        .then(({ data }) => setProducts(data?.products ?? []))
        .catch(() => setProducts([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q, category]);

  return (
    <div className="px-4 pb-4 pt-3 md:px-8">
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/8 bg-[#1c1c26] px-3">
        <Search className="size-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un produit, vendeur…"
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
      </div>

      <h2 className="mb-3 font-heading text-sm font-bold">Catégories</h2>
      <div className="h-scroll h-scroll-fade mb-6 gap-2.5 pb-2">
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
              {c.label}
            </span>
          </button>
        ))}
      </div>

      <h2 className="mb-3 font-heading text-sm font-bold">
        Tendances à Kinshasa
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
                {formatMoney(p.priceCents)}
              </p>
            </div>
          </Link>
        ))}
      </div>
      {products.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Aucun résultat
        </p>
      )}
    </div>
  );
}
