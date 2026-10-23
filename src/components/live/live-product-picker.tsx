"use client";

import { useEffect, useState } from "react";
import { Search, ShoppingBag, X } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { cn, formatMoney } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type LiveCatalogProduct = {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  priceCents: number;
  currency: string;
  category: string;
  shop: { name: string };
};

type Props = {
  liveId: string;
  open: boolean;
  onClose: () => void;
  onPick: (product: LiveCatalogProduct) => void;
};

export function LiveProductPicker({ liveId, open, onClose, onPick }: Props) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [products, setProducts] = useState<LiveCatalogProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (category) params.set("category", category);
        const { data } = await fetchJson<{
          products?: LiveCatalogProduct[];
          categories?: string[];
        }>(`/api/growth/lives/${liveId}/products?${params}`);
        setProducts(data?.products ?? []);
        if (data?.categories) setCategories(data.categories);
        setLoading(false);
      })();
    }, 220);
    return () => window.clearTimeout(t);
  }, [open, liveId, q, category]);

  if (!open) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 flex max-h-[70%] flex-col rounded-t-3xl border border-white/15 bg-[#121218]/98 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="size-4 text-[#7dffb3]" />
          <p className="text-sm font-bold">Produits à l’écran</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-8 place-items-center rounded-full bg-white/10"
          aria-label="Fermer"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="px-4 pt-1 text-[11px] text-white/55">
        Filtrez puis touchez un produit pour le placer sur la vidéo (prix +
        mode d’emploi / conseil).
      </p>
      <div className="px-4 pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-white/40" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un produit…"
            className="h-10 border-white/15 bg-white/10 pl-9 text-white placeholder:text-white/40"
          />
        </div>
        {categories.length > 0 ? (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            <FilterChip
              active={!category}
              label="Tous"
              onClick={() => setCategory("")}
            />
            {categories.map((c) => (
              <FilterChip
                key={c}
                active={category === c}
                label={c}
                onClick={() => setCategory(c === category ? "" : c)}
              />
            ))}
          </div>
        ) : null}
      </div>
      <ul className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-4">
        {loading ? (
          <li className="py-8 text-center text-xs text-white/45">Chargement…</li>
        ) : products.length === 0 ? (
          <li className="py-8 text-center text-xs text-white/45">
            Aucun produit publié dans vos boutiques.
          </li>
        ) : (
          products.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2 text-left transition active:scale-[0.99] hover:bg-white/10"
              >
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.images[0]}
                    alt=""
                    className="size-14 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="size-14 shrink-0 rounded-xl bg-white/10" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="text-[11px] text-[#7dffb3]">
                    {formatMoney(p.priceCents)} · {p.category}
                  </p>
                  {p.description ? (
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-white/50">
                      {p.description}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-full bg-[#7dffb3]/20 px-2 py-1 text-[10px] font-bold text-[#7dffb3]">
                  À l’écran
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold",
        active ? "bg-white text-black" : "bg-white/10 text-white/70",
      )}
    >
      {label}
    </button>
  );
}
