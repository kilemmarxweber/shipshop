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
import { FeedLoadSentinel } from "@/components/feed-load-trigger";
import { ScrollAdFeedSurface } from "@/lib/use-scroll-ad";
import { usePaginatedList } from "@/lib/use-paginated-list";
import { applyExclusiveVideoSound } from "@/lib/feed-video-sound";
import {
  getPinnedFeedAudioId,
  requestFeedAudioFocus,
  resetFeedAudioFocus,
  unpinFeedAudio,
  useFeedAudioFocus,
  useResumeFeedSoundWhenVisible,
} from "@/lib/feed-audio-focus";
import {
  disableFeedSound,
  enableFeedSound,
  playFirstVisibleFeedSound,
} from "@/lib/try-play-media";

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
  boosted?: boolean;
};

type CardEntry = {
  key: string;
  product: Product;
};

function hasAudio(p: Product) {
  return Boolean(p.soundtrack?.audioUrl) || productHasVideo(p.images);
}

export default function DiscoverPage() {
  const { t } = useI18n();
  const appConfig = useAppConfig();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [soundById, setSoundById] = useState<Record<string, VideoSoundState>>(
    {},
  );
  const [userPinned, setUserPinned] = useState<string | null>(null);
  const [audioOff, setAudioOff] = useState(false);
  const audioFocusId = useFeedAudioFocus();
  useResumeFeedSoundWhenVisible();
  const prevAudioFocus = useRef<string | null>(null);
  const audioFocusRef = useRef<string | null>(null);
  const userPinnedRef = useRef<string | null>(null);
  const audioOffRef = useRef(false);
  const visibleRef = useRef(new Set<string>());
  const orderedAudioRef = useRef<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 200);
    return () => clearTimeout(timer);
  }, [q]);

  const feed = usePaginatedList<Product>({
    prefetchRemaining: 4,
    cacheKey: `discover:${category ?? ""}:${debouncedQ}`,
    deps: [debouncedQ, category],
    buildUrl: (cursor) => {
      const params = new URLSearchParams({
        status: "ACTIVE",
        limit: String(PUBLIC_PAGE_SIZE),
      });
      if (debouncedQ) params.set("q", debouncedQ);
      if (category) params.set("category", category);
      if (cursor) params.set("cursor", cursor);
      return `/api/products?${params}`;
    },
    extract: (json) => {
      const data = json as { products?: Product[]; nextCursor?: string | null };
      return { items: data.products ?? [], nextCursor: data.nextCursor ?? null };
    },
  });

  const products = feed.items;
  const featuredEntries: CardEntry[] = products
    .slice(0, 12)
    .map((product, index) => ({ key: `featured:${product.id}:${index}`, product }));
  const videoEntries: CardEntry[] = products
    .filter((p) => hasAudio(p))
    .slice(0, 12)
    .map((product, index) => ({ key: `video:${product.id}:${index}`, product }));
  const budgetEntries: CardEntry[] = [...products]
    .sort((a, b) => a.priceCents - b.priceCents)
    .slice(0, 12)
    .map((product, index) => ({ key: `budget:${product.id}:${index}`, product }));
  const resultEntries: CardEntry[] = products.map((product, index) => ({
    key: `results:${product.id}:${index}`,
    product,
  }));
  orderedAudioRef.current = [
    ...featuredEntries,
    ...videoEntries,
    ...budgetEntries,
    ...resultEntries,
  ]
    .filter((entry) => hasAudio(entry.product))
    .map((entry) => entry.key);
  userPinnedRef.current = userPinned;
  audioOffRef.current = audioOff;
  audioFocusRef.current = audioFocusId;

  const assignVisibleAudio = useCallback(() => {
    if (audioOffRef.current || userPinnedRef.current) return;
    const id = playFirstVisibleFeedSound();
    if (!id) return;
    requestFeedAudioFocus(id);
  }, []);

  useEffect(() => {
    const root = document.querySelector(".app-main");
    if (!root) return;
    const onScroll = () => {
      feed.noteUserScroll();
      unpinFeedAudio();
    };
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

  function mediaSound(cardKey: string): VideoSoundState {
    const volume = soundById[cardKey]?.volume ?? DEFAULT_VIDEO_SOUND.volume;
    return {
      volume,
      muted: audioOff || audioFocusId !== cardKey,
    };
  }

  function soundFor(cardKey: string): VideoSoundState {
    return mediaSound(cardKey);
  }

  function activateSound(cardKey: string) {
    enableFeedSound(false);
    requestFeedAudioFocus(cardKey);
    setSoundById((prev) =>
      applyExclusiveVideoSound(prev, cardKey, {
        muted: false,
        volume: (prev[cardKey] ?? DEFAULT_VIDEO_SOUND).volume,
      }),
    );
  }

  function syncVisibleSoundIcon() {
    const pin = getPinnedFeedAudioId();
    const id = pin ?? playFirstVisibleFeedSound();
    if (!id) return;
    requestFeedAudioFocus(id);
    setSoundById((prev) =>
      applyExclusiveVideoSound(prev, id, {
        muted: false,
        volume: 1,
      }),
    );
  }

  const productSoundKey = `${products.length}:${products[0]?.id ?? ""}:${products.at(-1)?.id ?? ""}`;

  useEffect(() => {
    const id = window.setTimeout(() => {
      enableFeedSound(false);
      syncVisibleSoundIcon();
    }, 160);
    return () => window.clearTimeout(id);
  }, [productSoundKey]);

  useEffect(() => {
    const onDiscover = () => {
      enableFeedSound();
      syncVisibleSoundIcon();
    };
    window.addEventListener("ss:discover-feed", onDiscover);
    return () => window.removeEventListener("ss:discover-feed", onDiscover);
  }, []);

  const playNext = useCallback((fromCardKey: string) => {
    if (userPinnedRef.current || audioOffRef.current) return;
    const visible = visibleRef.current;
    const order = orderedAudioRef.current.filter((key) => visible.has(key));
    if (order.length === 0) return;
    const group = `${fromCardKey.split(":")[0] ?? ""}:`;
    const scoped = order.filter((key) => key.startsWith(group));
    const pool = scoped.length > 0 ? scoped : order;
    const i = pool.indexOf(fromCardKey);
    const next = pool[(i + 1) % pool.length] ?? pool[0];
    if (next) requestFeedAudioFocus(next);
  }, []);

  const onTileVisible = useCallback(
    (cardKey: string, visible: boolean) => {
      if (visible) visibleRef.current.add(cardKey);
      else visibleRef.current.delete(cardKey);
      assignVisibleAudio();
    },
    [assignVisibleAudio],
  );

  function onTileActivate(cardKey: string) {
    setAudioOff(false);
    if (userPinned === cardKey) {
      setUserPinned(null);
      setSoundById({});
      unpinFeedAudio();
      return;
    }
    setUserPinned(cardKey);
    if (!soundFor(cardKey).muted) {
      requestFeedAudioFocus(cardKey);
      return;
    }
    activateSound(cardKey);
  }

  return (
    <div className="discover-scroll px-4 pb-4 pt-3 md:px-8">
      <ScrollAdFeedSurface on />
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border bg-surface-2 px-3">
        <Search className="size-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("discover.searchPlaceholder")}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
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
      {(featuredEntries.length > 0 ||
        videoEntries.length > 0 ||
        budgetEntries.length > 0) && (
        <div className="mb-6 space-y-4">
          {featuredEntries.length > 0 ? (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("discover.featuredHeading")}
              </p>
              <div className="h-scroll h-scroll-fade gap-3 pb-1">
                {featuredEntries.map((entry) => (
                  <DiscoverStripCard
                    key={entry.key}
                    cardKey={entry.key}
                    product={entry.product}
                    onBuy={() => setBuyProduct(entry.product)}
                    onVisible={onTileVisible}
                    appClipMs={appConfig.clipMs}
                    sound={soundFor(entry.key)}
                    focused={audioFocusId === entry.key && !audioOff}
                    onActivateSound={() => onTileActivate(entry.key)}
                    onPlaybackEnded={
                      entry.product.soundtrack?.audioUrl
                        ? undefined
                        : () => playNext(entry.key)
                    }
                    onSoundChange={(next) => {
                      setAudioOff(next.muted);
                      if (next.muted) {
                        disableFeedSound();
                        if (userPinned === entry.key) {
                          setUserPinned(null);
                          unpinFeedAudio();
                        }
                      } else {
                        enableFeedSound(false);
                        setUserPinned(entry.key);
                        requestFeedAudioFocus(entry.key);
                      }
                      setSoundById((prev) =>
                        applyExclusiveVideoSound(prev, entry.key, next),
                      );
                    }}
                    buyLabel={t("buy.cta")}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {videoEntries.length > 0 ? (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("discover.videoHeading")}
              </p>
              <div className="h-scroll h-scroll-fade gap-3 pb-1">
                {videoEntries.map((entry) => (
                  <DiscoverStripCard
                    key={entry.key}
                    cardKey={entry.key}
                    product={entry.product}
                    onBuy={() => setBuyProduct(entry.product)}
                    withVideoBadge
                    onVisible={onTileVisible}
                    appClipMs={appConfig.clipMs}
                    sound={soundFor(entry.key)}
                    focused={audioFocusId === entry.key && !audioOff}
                    onActivateSound={() => onTileActivate(entry.key)}
                    onPlaybackEnded={
                      entry.product.soundtrack?.audioUrl
                        ? undefined
                        : () => playNext(entry.key)
                    }
                    onSoundChange={(next) => {
                      setAudioOff(next.muted);
                      if (next.muted) {
                        disableFeedSound();
                        if (userPinned === entry.key) {
                          setUserPinned(null);
                          unpinFeedAudio();
                        }
                      } else {
                        enableFeedSound(false);
                        setUserPinned(entry.key);
                        requestFeedAudioFocus(entry.key);
                      }
                      setSoundById((prev) =>
                        applyExclusiveVideoSound(prev, entry.key, next),
                      );
                    }}
                    buyLabel={t("buy.cta")}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {budgetEntries.length > 0 ? (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("discover.budgetHeading")}
              </p>
              <div className="h-scroll h-scroll-fade gap-3 pb-1">
                {budgetEntries.map((entry) => (
                  <DiscoverStripCard
                    key={entry.key}
                    cardKey={entry.key}
                    product={entry.product}
                    onBuy={() => setBuyProduct(entry.product)}
                    onVisible={onTileVisible}
                    appClipMs={appConfig.clipMs}
                    sound={soundFor(entry.key)}
                    focused={audioFocusId === entry.key && !audioOff}
                    onActivateSound={() => onTileActivate(entry.key)}
                    onPlaybackEnded={
                      entry.product.soundtrack?.audioUrl
                        ? undefined
                        : () => playNext(entry.key)
                    }
                    onSoundChange={(next) => {
                      setAudioOff(next.muted);
                      if (next.muted) {
                        disableFeedSound();
                        if (userPinned === entry.key) {
                          setUserPinned(null);
                          unpinFeedAudio();
                        }
                      } else {
                        enableFeedSound(false);
                        setUserPinned(entry.key);
                        requestFeedAudioFocus(entry.key);
                      }
                      setSoundById((prev) =>
                        applyExclusiveVideoSound(prev, entry.key, next),
                      );
                    }}
                    buyLabel={t("buy.cta")}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <h2 className="mb-3 font-heading text-sm font-bold">
        {t("discover.resultsHeading")}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {resultEntries.map((entry) => {
          const p = entry.product;
          const cardKey = entry.key;
          const cover = p.images[0] ? [p.images[0]] : [];
          const audio = hasAudio(p);
          const focused = audioFocusId === cardKey && !audioOff;
          return (
            <DiscoverTile
              key={cardKey}
              id={cardKey}
              onVisible={onTileVisible}
              soundOn={!soundFor(cardKey).muted}
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
                muted={mediaSound(cardKey).muted}
                volume={mediaSound(cardKey).volume}
                hasSoundtrack={Boolean(p.soundtrack?.audioUrl)}
                clipMs={p.soundtrack?.audioUrl ? appConfig.clipMs : undefined}
                motions={p.imageMotions}
                audioKey={audio ? cardKey : undefined}
                forcePlay={focused}
                loop={userPinned === cardKey}
                onActivateSound={audio ? () => onTileActivate(cardKey) : undefined}
                onPlaybackEnded={
                  p.soundtrack?.audioUrl ? undefined : () => playNext(cardKey)
                }
              />
              {p.soundtrack?.audioUrl ? (
                <FeedSoundtrackPlayer
                  audioUrl={p.soundtrack.audioUrl}
                  startMs={p.soundtrackStartMs}
                  sound={mediaSound(cardKey)}
                  active={focused}
                  loop={userPinned === cardKey}
                  onCycleEnd={() => playNext(cardKey)}
                />
              ) : null}
              {audio ? (
                <div className="absolute top-2 right-2 z-20">
                  <VideoSoundButton
                    images={p.images}
                    hasSoundtrack={Boolean(p.soundtrack?.audioUrl)}
                    sound={soundFor(cardKey)}
                    onChange={(next) => {
                      setAudioOff(next.muted);
                      if (next.muted) {
                        disableFeedSound();
                        if (userPinned === cardKey) {
                          setUserPinned(null);
                          unpinFeedAudio();
                        }
                      } else {
                        enableFeedSound(false);
                        setUserPinned(cardKey);
                        requestFeedAudioFocus(cardKey);
                      }
                      setSoundById((prev) =>
                        applyExclusiveVideoSound(prev, cardKey, next),
                      );
                    }}
                  />
                </div>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-3">
                <Link href={`/product/${p.id}`} className="block cursor-pointer">
                  <p className="line-clamp-2 text-sm font-extrabold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    {p.title}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium text-white/75">
                    {p.shop?.name}
                  </p>
                  <p className="text-[11px] font-bold text-trust">
                    {formatMoney(p.priceCents, p.currency)}
                  </p>
                </Link>
                {p.shop ? (
                  <button
                    type="button"
                    onClick={() => setBuyProduct(p)}
                    className="mt-2 inline-flex h-8 min-w-20 cursor-pointer items-center justify-center rounded-full bg-primary px-3 text-[10px] font-bold text-white shadow-sm"
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
        <p className="py-4 text-center text-xs text-muted-foreground">...</p>
      ) : null}
      {feed.loading && products.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">...</p>
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

function DiscoverStripCard({
  cardKey,
  product,
  onBuy,
  onVisible,
  withVideoBadge = false,
  appClipMs,
  sound,
  focused,
  onActivateSound,
  onPlaybackEnded,
  onSoundChange,
  buyLabel,
}: {
  cardKey: string;
  product: Product;
  onBuy: () => void;
  onVisible: (id: string, visible: boolean) => void;
  withVideoBadge?: boolean;
  appClipMs: number;
  sound: VideoSoundState;
  focused: boolean;
  onActivateSound?: () => void;
  onPlaybackEnded?: () => void;
  onSoundChange: (next: VideoSoundState) => void;
  buyLabel: string;
}) {
  const audio = hasAudio(product);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.querySelector(".app-main");
    const io = new IntersectionObserver(
      ([entry]) => {
        onVisible(cardKey, (entry?.intersectionRatio ?? 0) >= 0.08);
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
      onVisible(cardKey, false);
    };
  }, [cardKey, onVisible]);

  return (
    <article
      ref={ref}
      data-feed-card
      data-audio-key={cardKey}
      {...(!sound.muted ? { "data-feed-sound-on": "1" } : {})}
      className="relative w-48 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface"
    >
      <Link href={`/product/${product.id}`} className="block cursor-pointer">
        <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
          <ProductImageCarousel
            images={audio ? product.images.slice(0, 8) : product.images.slice(0, 1)}
            className="absolute inset-0"
            showDots={false}
            intervalMs={audio ? 3500 : 0}
            muted={sound.muted}
            volume={sound.volume}
            hasSoundtrack={Boolean(product.soundtrack?.audioUrl)}
            clipMs={product.soundtrack?.audioUrl ? appClipMs : undefined}
            audioKey={audio ? cardKey : undefined}
            forcePlay={focused}
            onActivateSound={audio ? onActivateSound : undefined}
            onPlaybackEnded={onPlaybackEnded}
          />
          {product.soundtrack?.audioUrl ? (
            <FeedSoundtrackPlayer
              audioUrl={product.soundtrack.audioUrl}
              startMs={product.soundtrackStartMs}
              sound={sound}
              active={focused}
              onCycleEnd={onPlaybackEnded}
            />
          ) : null}
          {withVideoBadge ? (
            <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
              Video
            </span>
          ) : null}
          {audio ? (
            <div className="absolute top-2 right-2 z-20">
              <VideoSoundButton
                images={product.images}
                hasSoundtrack={Boolean(product.soundtrack?.audioUrl)}
                sound={sound}
                onChange={onSoundChange}
              />
            </div>
          ) : null}
        </div>
      </Link>
      <div className="space-y-1 p-2.5">
        <p className="line-clamp-2 text-xs font-semibold leading-tight text-foreground">
          {product.title}
        </p>
        <p className="text-[10px] text-muted-foreground">{product.shop?.name}</p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-trust">
            {formatMoney(product.priceCents, product.currency)}
          </p>
          <button
            type="button"
            onClick={onBuy}
            className="inline-flex h-7 cursor-pointer items-center justify-center rounded-full bg-primary px-2.5 text-[10px] font-bold text-white"
          >
            {buyLabel}
          </button>
        </div>
      </div>
    </article>
  );
}

function DiscoverTile({
  id,
  onVisible,
  soundOn = false,
  children,
}: {
  id: string;
  onVisible: (id: string, visible: boolean) => void;
  soundOn?: boolean;
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
      data-feed-card
      data-audio-key={id}
      {...(soundOn ? { "data-feed-sound-on": "1" } : {})}
      className="group relative aspect-[3/4] overflow-hidden rounded-2xl"
    >
      {children}
    </article>
  );
}
