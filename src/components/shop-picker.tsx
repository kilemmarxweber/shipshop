"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ShopPickerShop = {
  id: string;
  name: string;
  slug?: string;
  owner?: { name?: string | null } | null;
};

function shopLabel(shop: ShopPickerShop) {
  return shop.owner?.name ? `${shop.name} · ${shop.owner.name}` : shop.name;
}

export function ShopPicker({
  shops,
  value,
  onChange,
  allLabel,
  placeholder = "Boutique",
  className,
  hideWhenSingle = true,
}: {
  shops: ShopPickerShop[];
  value: string;
  onChange: (id: string) => void;
  allLabel?: string;
  placeholder?: string;
  className?: string;
  hideWhenSingle?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const searchable = shops.length > 1;
  const visible =
    shops.length > 1 || Boolean(allLabel && shops.length > 0) || !hideWhenSingle;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return shops;
    return shops.filter((shop) =>
      `${shop.name} ${shop.slug ?? ""} ${shop.owner?.name ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [shops, q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  if (!visible || shops.length === 0) return null;

  const selected = shops.find((shop) => shop.id === value);
  const label = selected
    ? shopLabel(selected)
    : value === "" && allLabel
      ? allLabel
      : placeholder;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 text-left text-sm"
      >
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute z-50 mt-1 flex max-h-72 w-full flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-md">
          {searchable ? (
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <Input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Rechercher une boutique"
                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                autoFocus
              />
            </div>
          ) : null}
          <ul
            role="listbox"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
            onWheel={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
          >
            {allLabel ? (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                    !value && "bg-accent",
                  )}
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{allLabel}</span>
                  {!value ? <Check className="size-4 shrink-0" /> : null}
                </button>
              </li>
            ) : null}
            {filtered.map((shop) => (
              <li key={shop.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={shop.id === value}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                    shop.id === value && "bg-accent",
                  )}
                  onClick={() => {
                    onChange(shop.id);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {shopLabel(shop)}
                  </span>
                  {shop.id === value ? (
                    <Check className="size-4 shrink-0" />
                  ) : null}
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">
                Aucune boutique
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
