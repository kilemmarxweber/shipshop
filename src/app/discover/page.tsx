"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { PUBLIC_PAGE_SIZE } from "@/lib/list-cursor";
import { useAppConfig } from "@/lib/use-app-config";
import { formatMoney, cn } from "@/lib/utils";
import { useI18n, type MessagePath } from "@/components/i18n-provider";
import { ProductImageCarousel } from "@/components/product-image-carousel";
import { FeedSoundtrackPlayer } from "@/components/feed-soundtrack-player";
import {
  DEFAULT_VIDEO_SOUND,
  VideoSoundButton,
  productHasVideo,
  type VideoSoundState,
} from "@/components/video-sound-button";
import { BuyProductSheet } from "@/components/buy-product-sheet";
import { Input } from "@/components/ui/input";
import { getCurrentGeoCoords } from "@/lib/browser-geolocation";
import { FeedLoadSentinel } from "@/components/feed-load-trigger";
import { usePaginatedList } from "@/lib/use-paginated-list";
import { applyExclusiveVideoSound } from "@/lib/feed-video-sound";
import {
  requestFeedAudioFocus,
  resetFeedAudioFocus,
  unpinFeedAudio,
  useFeedAudioFocus,
} from "@/lib/feed-audio-focus";

type Product = {
  id: string;
  title: string;
  priceCents: number;
  currency?: string;
  quantity?: number;
  soldCount?: number;
  images: string[];
  imageMotions?: string[];
  colors?: string[];
  sizes?: string[];
  category: string;
  soundtrackStartMs?: number;
  soundtrack?: { audioUrl: string; durationMs?: number } | null;
  shop?: { id: string; name: string };
};

function hasAudio(p: Product) {
  return Boolean(p.soundtrack?.audioUrl) || productHasVideo(p.images);
}

function hasCoverVideo(p: Product) {
  return productHasVideo(p.images.slice(0, 1));
}

export default function DiscoverPage() {
  const { t } = useI18n();
  const appConfig = useAppConfig();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [nearMe, setNearMe] = useState(false);
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [soundById, setSoundById] = useState<Record<string, VideoSoundState>>(
    {},
  );
  const [userPinned, setUserPinned] = useState<string | null>(null);
  const [audioOff, setAudioOff] = useState(false);
  const audioFocusId = useFeedAudioFocus();
  const prevAudioFocus = useRef<string | null>(null);
  const audioFocusRef = useRef<string | null>(null);
  const userPinnedRef = useRef<string | null>(null);
  const audioOffRef = useRef(false);
  const visibleRef = useRef(new Set<string>());
  const productsRef = useRef<Product[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 200);
    return () => clearTimeout(timer);
  }, [q]);

  const feed = usePaginatedList<Product>({
    prefetchRemaining: 4,
    cacheKey: `discover:${category ?? ""}:${debouncedQ}:${nearMe ? "near" : "all"}`,
    deps: [debouncedQ, category, nearMe, near?.lat, near?.lng],
    buildUrl: (cursor) => {
      const params = new URLSearchParams({
        status: "ACTIVE",
        limit: String(PUBLIC_PAGE_SIZE),
      });
      if (debouncedQ) params.set("q", debouncedQ);
      if (category) params.set("category", category);
      if (nearMe && near) {
        params.set("nearLat", String(near.lat));
        params.set("nearLng", String(near.lng));
      }
      if (cursor) params.set("cursor", cursor);
      return `/api/products?${params}`;
    },
    extract: (json) => {
      const data = json as { products?: Product[]; nextCursor?: string | null };
      return { items: data.products ?? [], nextCursor: data.nextCursor ?? null };
    },
  });

  const products = feed.items;
  productsRef.current = products;
  userPinnedRef.current = userPinned;
  audioOffRef.current = audioOff;
  audioFocusRef.current = audioFocusId;

  const assignVisibleAudio = useCallback(() => {
    if (audioOffRef.current || userPinnedRef.current) return;
    const list = productsRef.current;
    const visible = visibleRef.current;
    const visibleCover = list.filter((p) => hasCoverVideo(p) && visible.has(p.id));
    const target =
      visibleCover[0] ??
      list.find((p) => hasCoverVideo(p)) ??
      list.find((p) => productHasVideo(p.images)) ??
      list.find((p) => hasAudio(p));
    if (!target) return;
    if (audioFocusRef.current === target.id) return;
    requestFeedAudioFocus(target.id);
  }, []);

  useEffect(() => {
    const root = document.querySelector(".app-main");
    if (!root) return;
    const onScroll = () => feed.noteUserScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [feed.noteUserScroll]);

  useEffect(() => {
    if (prevAudioFocus.current === audioFocusId) return;
    prevAudioFocus.current = audioFocusId;
    if (!audioFocusId) {
      setSoundById({});
      return;
    }
    setSoundById((prev) =>
      applyExclusiveVideoSound(prev, audioFocusId, {
        muted: false,
        volume: 1,
      }),
    );
  }, [audioFocusId]);

  useEffect(() => {
    setUserPinned(null);
    setAudioOff(false);
    resetFeedAudioFocus();
    setSoundById({});
    visibleRef.current.clear();
  }, [debouncedQ, category]);

  useEffect(() => {
    const timer = window.setTimeout(assignVisibleAudio, 120);
    return () => window.clearTimeout(timer);
  }, [products, category, debouncedQ, assignVisibleAudio]);

  function soundFor(id: string): VideoSoundState {
    const base = soundById[id] ?? DEFAULT_VIDEO_SOUND;
    if (audioOff || audioFocusId !== id) return { ...base, muted: true };
    return base;
  }

  function activateSound(id: string) {
    requestFeedAudioFocus(id);
    setSoundById((prev) =>
      applyExclusiveVideoSound(prev, id, {
        muted: false,
        volume: (prev[id] ?? DEFAULT_VIDEO_SOUND).volume,
      }),
    );
  }

  const playNext = useCallback((fromId: string) => {
    if (userPinnedRef.current || audioOffRef.current) return;
    const visible = visibleRef.current;
    const order = productsRef.current
      .filter((p) => visible.has(p.id) && hasAudio(p))
      .map((p) => p.id);
    if (order.length === 0) return;
    const i = order.indexOf(fromId);
    const next = order[(i + 1) % order.length] ?? order[0];
    if (next) requestFeedAudioFocus(next);
  }, []);

  const onTileVisible = useCallback(
    (id: string, visible: boolean) => {
      if (visible) visibleRef.current.add(id);
      else visibleRef.current.delete(id);
      assignVisibleAudio();
    },
    [assignVisibleAudio],
  );

  function onTileActivate(id: string) {
    setAudioOff(false);
    if (userPinned === id) {
      setUserPinned(null);
      setSoundById({});
      unpinFeedAudio();
      return;
    }
    setUserPinned(id);
    if (!soundFor(id).muted) {
      requestFeedAudioFocus(id);
      return;
    }
    activateSound(id);
  }

  function muteWantedBanner() {
    setAudioOff(true);
    setUserPinned(null);
    setSoundById({});
    resetFeedAudioFocus();
  }

  return (
    <div className="discover-scroll px-4 pb-4 pt-3 md:px-8">
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
        onClick={muteWantedBanner}
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

      <div className="mb-4">
        <button
          type="button"
          onClick={() => {
            if (nearMe) {
              setNearMe(false);
              return;
            }
            void getCurrentGeoCoords()
              .then((coords) => {
                setNear({ lat: coords.latitude, lng: coords.longitude });
                setNearMe(true);
              })
              .catch(() => setNearMe(false));
          }}
          className={cn(
            "h-10 rounded-full px-4 text-xs font-bold",
            nearMe
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-surface-2",
          )}
        >
          {t("discover.nearMe")}
        </button>
      </div>
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
        {products.map((p) => {
          const cover = p.images[0] ? [p.images[0]] : [];
          const audio = hasAudio(p);
          const focused = audioFocusId === p.id && !audioOff;
          return (
            <DiscoverTile
              key={p.id}
              id={p.id}
              onVisible={onTileVisible}
            >
              <ProductImageCarousel
                images={
                  audio
                    ? p.images.slice(0, appConfig.maxImages)
                    : cover
                }
                className="absolute inset-0"
                showDots={false}
                intervalMs={3500}
                muted={soundFor(p.id).muted}
                volume={soundFor(p.id).volume}
                hasSoundtrack={Boolean(p.soundtrack?.audioUrl)}
                clipMs={p.soundtrack?.audioUrl ? appConfig.clipMs : undefined}
                motions={p.imageMotions}
                forcePlay={focused}
                loop={userPinned === p.id}
                onActivateSound={audio ? () => onTileActivate(p.id) : undefined}
                onPlaybackEnded={
                  p.soundtrack?.audioUrl ? undefined : () => playNext(p.id)
                }
              />
              {p.soundtrack?.audioUrl ? (
                <FeedSoundtrackPlayer
                  audioUrl={p.soundtrack.audioUrl}
                  startMs={p.soundtrackStartMs}
                  sound={soundFor(p.id)}
                  active={focused}
                  loop={userPinned === p.id}
                  onCycleEnd={() => playNext(p.id)}
                />
              ) : null}
              {audio ? (
                <div className="absolute top-2 right-2 z-20">
                  <VideoSoundButton
                    images={p.images}
                    hasSoundtrack={Boolean(p.soundtrack?.audioUrl)}
                    sound={soundFor(p.id)}
                    onChange={(next) => {
                      setAudioOff(false);
                      if (!next.muted) {
                        setUserPinned(p.id);
                        requestFeedAudioFocus(p.id);
                      } else if (userPinned === p.id) {
                        setUserPinned(null);
                        unpinFeedAudio();
                      }
                      setSoundById((prev) =>
                        applyExclusiveVideoSound(prev, p.id, next),
                      );
                    }}
                  />
                </div>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-3">
                <Link href={`/product/${p.id}`}>
                  <p className="truncate text-xs font-bold">{p.title}</p>
                  <p className="text-[11px] font-bold text-trust">
                    {formatMoney(p.priceCents, p.currency)}
                  </p>
                </Link>
                {p.shop ? (
                  <button
                    type="button"
                    onClick={() => setBuyProduct(p)}
                    className="mt-2 h-9 w-full rounded-full bg-primary text-[11px] font-bold text-white"
                  >
                    {t("buy.cta")}
                  </button>
                ) : null}
              </div>
            </DiscoverTile>
          );
        })}
      </div>
      {feed.hasMore ? (
        <FeedLoadSentinel
          onVisible={feed.loadMore}
          rootSelector=".app-main"
          resumeKey={`${products.length}:${feed.loadingMore ? 1 : 0}`}
        />
      ) : null}
      {feed.loadingMore ? (
        <p className="py-4 text-center text-xs text-muted-foreground">…</p>
      ) : null}
      {feed.loading && products.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">…</p>
      ) : null}
      {products.length === 0 && !feed.loading && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("discover.emptyResults")}
        </p>
      )}
      <BuyProductSheet
        product={
          buyProduct?.shop
            ? {
                id: buyProduct.id,
                title: buyProduct.title,
                priceCents: buyProduct.priceCents,
                currency: buyProduct.currency,
                images: buyProduct.images,
                quantity: buyProduct.quantity,
                colors: buyProduct.colors ?? [],
                sizes: buyProduct.sizes ?? [],
                shop: buyProduct.shop,
              }
            : null
        }
        open={Boolean(buyProduct)}
        onOpenChange={(open) => {
          if (!open) setBuyProduct(null);
        }}
      />
    </div>
  );
}

function DiscoverTile({
  id,
  onVisible,
  children,
}: {
  id: string;
  onVisible: (id: string, visible: boolean) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.querySelector(".app-main");
    const io = new IntersectionObserver(
      ([entry]) => {
        onVisible(id, (entry?.intersectionRatio ?? 0) >= 0.08);
      },
      {
        root,
        rootMargin: "120px 0px 80px 0px",
        threshold: [0, 0.08, 0.2, 0.35, 0.6, 1],
      },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      onVisible(id, false);
    };
  }, [id, onVisible]);

  return (
    <article
      ref={ref}
      className="group relative aspect-[3/4] overflow-hidden rounded-2xl"
    >
      {children}
    </article>
  );
}
