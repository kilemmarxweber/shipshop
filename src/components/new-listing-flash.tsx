"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { ShopBrand } from "@/components/shop-brand";
import { MediaThumb } from "@/components/media-thumb";

type LatestItem = {
  id: string;
  title: string;
  priceCents: number;
  currency?: string;
  createdAt: string;
  cover: string | null;
  shop: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    ownerUserId: string | null;
  };
};

type FlashItem = LatestItem & { flashId: string };

const POLL_MS = 16_000;
const VISIBLE_MS = 4200;
const MAX_STACK = 2;
const FLASH_PATHS = new Set(["/", "/discover"]);

export function NewListingFlash() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { data: session } = authClient.useSession();
  const [queue, setQueue] = useState<FlashItem[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const timers = useRef<Map<string, number>>(new Map());
  const myId = session?.user?.id;

  const active = FLASH_PATHS.has(pathname);

  function dismiss(flashId: string) {
    const timer = timers.current.get(flashId);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(flashId);
    }
    setQueue((prev) => prev.filter((item) => item.flashId !== flashId));
  }

  useEffect(() => {
    if (!active) {
      setQueue([]);
      for (const timer of timers.current.values()) window.clearTimeout(timer);
      timers.current.clear();
      return;
    }

    let cancelled = false;

    async function pull() {
      const { res, data } = await fetchJson<{ products?: LatestItem[] }>(
        "/api/products/latest",
      );
      if (cancelled || !res.ok) return;
      const list = data?.products ?? [];
      if (!primed.current) {
        seenRef.current = new Set(list.map((p) => p.id));
        primed.current = true;
        return;
      }
      const seen = seenRef.current;
      const fresh: LatestItem[] = [];
      for (const p of list) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        if (myId && p.shop.ownerUserId === myId) continue;
        fresh.push(p);
      }
      if (!fresh.length) return;
      const incoming = fresh.map((p) => ({
        ...p,
        flashId: `${p.id}-${Date.now()}`,
      }));
      setQueue((prev) => [...incoming, ...prev].slice(0, MAX_STACK));
      for (const item of incoming) {
        const timer = window.setTimeout(() => dismiss(item.flashId), VISIBLE_MS);
        timers.current.set(item.flashId, timer);
      }
    }

    void pull();
    const interval = window.setInterval(() => {
      void pull();
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [active, myId]);

  useEffect(() => {
    return () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer);
    };
  }, []);

  if (!active || queue.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute top-[4.25rem] right-0 z-50 flex w-[min(100%,20.5rem)] flex-col items-end gap-2 px-3"
      aria-live="polite"
    >
      {queue.map((item) => (
        <Link
          key={item.flashId}
          href={`/product/${item.id}`}
          onClick={() => dismiss(item.flashId)}
          className="listing-flash pointer-events-auto relative w-full overflow-hidden rounded-2xl border border-white/15 bg-background/92 shadow-[0_16px_40px_rgba(0,0,0,0.38)] backdrop-blur-xl"
        >
          <span className="listing-flash-bar absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-trust to-primary" />
          <span className="flex items-center gap-2.5 p-2.5">
            <MediaThumb
              images={item.cover ? [item.cover] : []}
              className="size-12 shrink-0 rounded-xl ring-1 ring-white/10"
            />
            <span className="min-w-0 flex-1">
              <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                <Sparkles className="size-2.5" />
                {t("feed.newListing")}
              </span>
              <ShopBrand
                name={item.shop.name}
                logoUrl={item.shop.logoUrl}
                className="mt-0.5"
                avatarClassName="size-5 ring-1 ring-border"
                nameClassName="text-[11px] font-semibold"
              />
              <span className="mt-0.5 block truncate text-sm font-bold">
                {item.title}
              </span>
              <span className="font-heading text-sm font-extrabold text-trust">
                {formatMoney(item.priceCents, item.currency)}
              </span>
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
