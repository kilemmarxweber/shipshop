"use client";

import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/fetch-json";
import { cn, formatMoney } from "@/lib/utils";
import { ChevronLeft, Search, ShoppingBag, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  isHost?: boolean;
  presentedProductId?: string | null;
  seed?: LiveCatalogProduct[];
  scrollY?: number;
  onScroll?: (ratio: number) => void;
  onClose: () => void;
  onPick: (product: LiveCatalogProduct) => void;
  onClearPresented?: () => void;
};

export function LiveProductPicker({
  liveId,
  open,
  isHost = false,
  presentedProductId,
  seed,
  scrollY = 0,
  onScroll,
  onClose,
  onPick,
  onClearPresented,
}: Props) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [products, setProducts] = useState<LiveCatalogProduct[]>(seed ?? []);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [localView, setLocalView] = useState<LiveCatalogProduct | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (seed?.length) setProducts(seed);
  }, [seed]);

  useEffect(() => {
    if (!open) {
      setLocalView(null);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(!(seed && seed.length > 0));
        const params = new URLSearchParams();
        if (isHost && q.trim()) params.set("q", q.trim());
        if (isHost && category) params.set("category", category);
        const { data } = await fetchJson<{
          products?: LiveCatalogProduct[];
          categories?: string[];
        }>(`/api/growth/lives/${liveId}/products?${params}`);
        setProducts(data?.products ?? []);
        if (data?.categories) setCategories(data.categories);
        setLoading(false);
      })();
    }, 180);
    return () => window.clearTimeout(t);
  }, [open, liveId, q, category, seed, isHost]);

  const presented = useMemo(() => {
    const id = isHost
      ? (presentedProductId ?? localView?.id)
      : presentedProductId;
    if (!id) return null;
    return products.find((row) => row.id === id) ?? (isHost ? localView : null);
  }, [isHost, localView, presentedProductId, products]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || isHost || presented) return;
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTop = (Number.isFinite(scrollY) ? scrollY : 0) * Math.max(0, max);
  }, [isHost, presented, products.length, scrollY, open]);

  if (!open) return null;

  function show(product: LiveCatalogProduct) {
    if (!isHost) return;
    setLocalView(product);
    onPick(product);
  }

  return (
    <>
      {isHost ? (
        <button
          type="button"
          aria-label="Fermer le catalogue"
          className="absolute inset-0 z-[39] bg-black/45"
          onClick={onClose}
        />
      ) : (
        <div className="absolute inset-0 z-[39] bg-black/45" />
      )}
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-40 flex max-h-[70%] flex-col rounded-t-3xl border border-white/15 bg-[#121218]/98 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-4 text-[#7dffb3]" />
            <p className="text-sm font-bold">
              {presented
                ? presented.title
                : isHost
                  ? "Produits du live"
                  : "Catalogue du live"}
            </p>
          </div>
          {isHost ? (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (presented) {
                  setLocalView(null);
                  onClearPresented?.();
                  return;
                }
                onClose();
              }}
              className="grid size-9 place-items-center rounded-full bg-white/15"
              aria-label="Fermer"
            >
              <X className="size-4" />
            </button>
          ) : (
            <span className="text-[11px] font-bold text-[#7dffb3]">
              En direct
            </span>
          )}
        </div>
        {presented ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4 pt-2">
            {isHost ? (
              <button
                type="button"
                onClick={() => {
                  setLocalView(null);
                  onClearPresented?.();
                }}
                className="flex items-center gap-1 text-[12px] font-bold text-white/70"
              >
                <ChevronLeft className="size-4" />
                Liste
              </button>
            ) : (
              <p className="text-[11px] text-white/55">
                Le diffuseur présente ce produit.
              </p>
            )}
            {presented.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={presented.images[0]}
                alt=""
                className="h-44 w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="h-44 rounded-2xl bg-white/10" />
            )}
            <p className="text-lg font-extrabold">{presented.title}</p>
            <p className="text-base font-extrabold text-[#7dffb3]">
              {formatMoney(presented.priceCents)}
            </p>
            <p className="text-sm leading-relaxed text-white/75">
              {presented.description?.trim() ||
                (isHost
                  ? "Pas de description — explique le produit à l’oral."
                  : "Le diffuseur présente ce produit.")}
            </p>
          </div>
        ) : (
          <>
            <p className="px-4 pt-1 text-[11px] text-white/55">
              {isHost
                ? "Tes spectateurs voient et suivent cette liste. Touche Voir pour expliquer un produit."
                : "Lecture seule — le diffuseur contrôle le défilement."}
            </p>
            {isHost ? (
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
            ) : null}
            <ul
              ref={listRef}
              onScroll={(e) => {
                if (!isHost) return;
                const el = e.currentTarget;
                const max = el.scrollHeight - el.clientHeight;
                onScroll?.(
                  max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0,
                );
              }}
              className={cn(
                "mt-2 min-h-0 flex-1 space-y-1.5 px-3 pb-4",
                isHost ? "overflow-y-auto" : "overflow-hidden",
              )}
            >
              {loading ? (
                <li className="py-8 text-center text-xs text-white/45">
                  Chargement…
                </li>
              ) : products.length === 0 ? (
                <li className="py-8 text-center text-xs text-white/45">
                  Aucun produit pour ce live.
                </li>
              ) : (
                products.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={!isHost}
                      onClick={() => show(p)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2 text-left transition hover:bg-white/10 active:scale-[0.99] disabled:pointer-events-none"
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
                        <p className="truncate text-sm font-semibold">
                          {p.title}
                        </p>
                        <p className="text-[11px] text-[#7dffb3]">
                          {formatMoney(p.priceCents)}
                          {p.category ? ` · ${p.category}` : ""}
                        </p>
                        {p.description ? (
                          <p className="mt-0.5 line-clamp-1 text-[10px] text-white/50">
                            {p.description}
                          </p>
                        ) : null}
                      </div>
                      {isHost ? (
                        <span className="shrink-0 rounded-full bg-[#7dffb3] px-2 py-1 text-[10px] font-bold text-[#05140F]">
                          Voir
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </div>
    </>
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
