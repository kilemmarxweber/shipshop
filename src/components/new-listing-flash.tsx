"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { ShopBrand } from "@/components/shop-brand";
import { MediaThumb } from "@/components/media-thumb";
import {
  NEW_LISTING_EVENT,
  NEW_LISTING_STORAGE_KEY,
  type NewListingFlashPayload,
} from "@/lib/new-listing-events";

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

const POLL_MS = 8_000;
const VISIBLE_MS = 4200;
const MAX_STACK = 2;
const FLASH_PATHS = new Set(["/", "/discover"]);

export function NewListingFlash() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [queue, setQueue] = useState<FlashItem[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const timers = useRef<Map<string, number>>(new Map());
  const remainingMs = useRef<Map<string, number>>(new Map());
  const startedAt = useRef<Map<string, number>>(new Map());
  const paused = useRef<Set<string>>(new Set());
  const [pausedIds, setPausedIds] = useState<Set<string>>(new Set());

  const active = FLASH_PATHS.has(pathname);

  function clearTimer(flashId: string) {
    const timer = timers.current.get(flashId);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(flashId);
    }
  }

  function scheduleDismiss(flashId: string, ms: number) {
    clearTimer(flashId);
    remainingMs.current.set(flashId, ms);
    startedAt.current.set(flashId, Date.now());
    const timer = window.setTimeout(() => dismiss(flashId), ms);
    timers.current.set(flashId, timer);
  }

  function dismiss(flashId: string) {
    clearTimer(flashId);
    remainingMs.current.delete(flashId);
    startedAt.current.delete(flashId);
    paused.current.delete(flashId);
    setPausedIds((prev) => {
      if (!prev.has(flashId)) return prev;
      const next = new Set(prev);
      next.delete(flashId);
      return next;
    });
    setQueue((prev) => prev.filter((item) => item.flashId !== flashId));
  }

  function pauseFlash(flashId: string) {
    if (paused.current.has(flashId)) return;
    paused.current.add(flashId);
    const started = startedAt.current.get(flashId) ?? Date.now();
    const remaining = remainingMs.current.get(flashId) ?? VISIBLE_MS;
    remainingMs.current.set(
      flashId,
      Math.max(0, remaining - (Date.now() - started)),
    );
    clearTimer(flashId);
    setPausedIds((prev) => new Set(prev).add(flashId));
  }

  function resumeFlash(flashId: string) {
    if (!paused.current.has(flashId)) return;
    paused.current.delete(flashId);
    setPausedIds((prev) => {
      const next = new Set(prev);
      next.delete(flashId);
      return next;
    });
    scheduleDismiss(flashId, remainingMs.current.get(flashId) ?? VISIBLE_MS);
  }

  function enqueueItems(items: LatestItem[]) {
    const incoming: FlashItem[] = [];
    for (const p of items) {
      if (seenRef.current.has(p.id)) continue;
      seenRef.current.add(p.id);
      incoming.push({ ...p, flashId: `${p.id}-${Date.now()}` });
    }
    if (!incoming.length) return;
    setQueue((prev) => [...incoming, ...prev].slice(0, MAX_STACK));
    for (const item of incoming) {
      scheduleDismiss(item.flashId, VISIBLE_MS);
    }
  }

  const enqueueRef = useRef(enqueueItems);
  enqueueRef.current = enqueueItems;

  function payloadToItem(payload: NewListingFlashPayload): LatestItem {
    return {
      id: payload.id,
      title: payload.title,
      priceCents: payload.priceCents,
      currency: payload.currency,
      createdAt: payload.createdAt ?? new Date().toISOString(),
      cover: payload.cover,
      shop: {
        id: payload.shop.id,
        name: payload.shop.name,
        slug: payload.shop.slug,
        logoUrl: payload.shop.logoUrl,
        ownerUserId: payload.shop.ownerUserId ?? null,
      },
    };
  }

  useEffect(() => {
    function onNew(event: Event) {
      const payload = (event as CustomEvent<NewListingFlashPayload>).detail;
      if (!payload?.id) return;
      enqueueRef.current([payloadToItem(payload)]);
    }
    function onStorage(event: StorageEvent) {
      if (event.key !== NEW_LISTING_STORAGE_KEY || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue) as NewListingFlashPayload;
        if (!payload?.id) return;
        enqueueRef.current([payloadToItem(payload)]);
      } catch {
        /* ignore */
      }
    }
    window.addEventListener(NEW_LISTING_EVENT, onNew);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(NEW_LISTING_EVENT, onNew);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!active) return;

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
      enqueueItems(list);
    }

    void pull();
    const interval = window.setInterval(() => {
      void pull();
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [active]);

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
          onPointerEnter={() => pauseFlash(item.flashId)}
          onPointerLeave={() => resumeFlash(item.flashId)}
          data-paused={pausedIds.has(item.flashId) ? "true" : undefined}
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
