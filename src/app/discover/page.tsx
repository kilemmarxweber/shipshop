"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Car,
  Cpu,
  Dumbbell,
  Gamepad2,
  Home,
  ChevronRight,
  MapPin,
  Play,
  Search,
  Shirt,
  Sparkles,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeedLoadSentinel } from "@/components/feed-load-trigger";
import { ScrollAdFeedSurface } from "@/lib/use-scroll-ad";
import {
  GrowthFeedFormats,
  highlightAudioKey,
} from "@/components/growth/feed-formats";
import { ChallengeCard } from "@/components/growth/challenge-card";
import { useGrowthSurface } from "@/lib/growth/use-growth-surface";
import { usePaginatedList } from "@/lib/use-paginated-list";
import { firstVisualUrl } from "@/lib/growth/challenge-look";
import { SellerMeta } from "@/components/growth/cover-image";
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
  likesCount?: number;
  viewsCount?: number;
  soundtrack?: { audioUrl: string; durationMs?: number } | null;
  shop?: { id: string; name: string; logoUrl?: string | null };
  boosted?: boolean;
};

const CATEGORY_ICON: Record<string, LucideIcon> = {
  Tech: Cpu,
  Mode: Shirt,
  Maison: Home,
  Gaming: Gamepad2,
  Beauté: Sparkles,
  Auto: Car,
  Livres: BookOpen,
  Sport: Dumbbell,
};

function clipLabel(durationMs?: number) {
  if (!durationMs || durationMs < 1000) return null;
  const total = Math.round(durationMs / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

type CardEntry = {
  key: string;
  product: Product;
};

function hasAudio(p: Product) {
  return Boolean(p.soundtrack?.audioUrl) || productHasVideo(p.images);
}

export default function DiscoverPage() {
  const { t, locale } = useI18n();
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
  const popularCats = useMemo(
    () =>
      CATEGORIES.map((c) => {
        const hit = products.find(
          (p) => p.category === c.id && firstVisualUrl(p.images),
        );
        const image = hit ? firstVisualUrl(hit.images) : null;
        return image ? { id: c.id, image } : null;
      }).filter((row): row is { id: string; image: string } => Boolean(row)),
    [products],
  );
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
  const { busyId, joinChallenge, placeChallenges, surface } = useGrowthSurface();
  const momentHighlight = surface?.highlights?.find(
    (item, index) => item.hasVideo && index === 0,
  );
  const momentAudioKey = momentHighlight
    ? highlightAudioKey(momentHighlight.id)
    : null;
  const resultRows = useMemo(
    () => placeChallenges("discover", resultEntries, (entry) => entry.key),
    [resultEntries, placeChallenges],
  );
  orderedAudioRef.current = [
    ...(momentAudioKey ? [momentAudioKey] : []),
    ...featuredEntries,
    ...videoEntries,
    ...budgetEntries,
    ...resultEntries,
  ]
    .filter((entry) =>
      typeof entry === "string" ? true : hasAudio(entry.product),
    )
    .map((entry) => (typeof entry === "string" ? entry : entry.key));
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

  const productSoundKey = `${products.length}:${products[0]?.id ?? ""}:${products.at(-1)?.id ?? ""}:${momentAudioKey ?? ""}`;

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
      <GrowthFeedFormats
        variant="discover"
        pinChallenges
        playback={{
          clipMs: appConfig.clipMs,
          soundFor,
          focused: (key) => audioFocusId === key && !audioOff,
          onVisible: onTileVisible,
          onActivateSound: onTileActivate,
          onPlaybackEnded: playNext,
          onSoundChange: (key, next) => {
            setAudioOff(next.muted);
            if (next.muted) {
              disableFeedSound();
              if (userPinned === key) {
                setUserPinned(null);
                unpinFeedAudio();
              }
            } else {
              enableFeedSound(false);
              setUserPinned(key);
              requestFeedAudioFocus(key);
            }
            setSoundById((prev) => applyExclusiveVideoSound(prev, key, next));
          },
        }}
      />
      <div className="mb-5 flex h-12 items-center gap-2 rounded-full border border-[#30303b] bg-[#22222c] px-4 sm:h-[3.4rem]">
        <Search className="size-5 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("discover.searchPlaceholder")}
          className="h-full border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
        />
      </div>

      <section className="mb-6">
        <h2 className="mb-3.5 font-heading text-[1.05rem] font-bold tracking-tight">
          {t("discover.categoriesHeading")}
        </h2>
        <div className="h-scroll h-scroll-fade items-start gap-2.5 sm:gap-3 md:justify-between md:overflow-visible md:[mask-image:none]">
          {CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICON[c.id] ?? Sparkles;
            const selected = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategory((prev) => (prev === c.id ? null : c.id));
                  void fetch("/api/growth/activity", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ kind: "category" }),
                  });
                }}
                className="flex w-[3.55rem] shrink-0 flex-col items-center gap-1.5 sm:w-[4.25rem]"
              >
                <span
                  className={cn(
                    "grid size-12 place-items-center rounded-full bg-gradient-to-br text-white shadow-[0_8px_20px_rgba(0,0,0,0.28)] transition duration-200 sm:size-14",
                    c.gradient,
                    selected
                      ? "scale-[1.04] ring-2 ring-white/90 ring-offset-2 ring-offset-background"
                      : "opacity-95 hover:scale-[1.03]",
                  )}
                >
                  <Icon className="size-5 sm:size-[1.35rem]" strokeWidth={1.75} />
                </span>
                <span
                  className={cn(
                    "text-center text-[11px] font-medium leading-tight",
                    selected ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {t(`categories.${c.id}` as MessagePath)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 font-heading text-[1.05rem] font-bold tracking-tight">
          <MapPin className="size-4 text-primary" />
          {t("discover.trendsHeading")}
        </h2>
        <Link
          href="#discover-results"
          className="inline-flex items-center text-white/50 hover:text-white"
        >
          <ChevronRight className="size-5" />
        </Link>
      </div>
      {(featuredEntries.length > 0 ||
        videoEntries.length > 0 ||
        budgetEntries.length > 0) && (
        <div className="mb-7 space-y-6">
          {featuredEntries.length > 0 ? (
            <section>
              <p className="mb-3 text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
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
              <p className="mb-3 text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
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
              <p className="mb-3 text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
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

      {popularCats.length > 1 ? (
        <section className="mb-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-heading text-[1.05rem] font-bold tracking-tight">
              {t("discover.popularHeading")}
            </h2>
            <Link
              href="#discover-results"
              className="inline-flex items-center text-white/50 hover:text-white"
            >
              <ChevronRight className="size-5" />
            </Link>
          </div>
          <div className="h-scroll h-scroll-fade gap-2.5 pb-1">
            {popularCats.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  setCategory((prev) => (prev === row.id ? null : row.id));
                  void fetch("/api/growth/activity", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ kind: "category" }),
                  });
                }}
                className="relative h-[5.5rem] w-[7.25rem] shrink-0 overflow-hidden rounded-2xl [transform:translateZ(0)] [isolation:isolate] sm:h-24 sm:w-32"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={row.image}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <span className="absolute inset-x-0 bottom-2 text-center text-[12px] font-semibold text-white">
                  {t(`categories.${row.id}` as MessagePath)}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <h2
        id="discover-results"
        className="mb-3.5 font-heading text-[1.05rem] font-bold tracking-tight"
      >
        {t("discover.resultsHeading")}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {resultRows.map((row) => {
          if (row.kind === "challenge") {
            return (
              <div
                key={row.key}
                className="col-span-2 md:col-span-3 lg:col-span-4"
              >
                <ChallengeCard
                  challenge={row.challenge}
                  template={row.template}
                  busy={busyId === row.challenge.id}
                  onJoin={() => void joinChallenge(row.challenge.id)}
                />
              </div>
            );
          }
          const entry = row.item;
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
              <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/25 to-transparent p-2.5 sm:p-3">
                <Link href={`/product/${p.id}`} className="block cursor-pointer">
                  <p className="line-clamp-2 text-[13px] font-extrabold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    {p.title}
                  </p>
                  <div className="mt-1.5">
                    <SellerMeta
                      name={p.shop?.name ?? "?"}
                      image={p.shop?.logoUrl ?? null}
                      views={p.viewsCount || p.likesCount || 0}
                      locale={locale}
                      viewsLabel={t("discover.views")}
                      likes={p.likesCount ?? 0}
                    />
                  </div>
                </Link>
                {p.shop ? (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-[#7dffb3]">
                      {formatMoney(p.priceCents, p.currency)}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setBuyProduct(p)}
                      className="h-7 cursor-pointer rounded-full px-3 text-[10px] font-bold"
                    >
                      {t("buy.cta")}
                    </Button>
                  </div>
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

  const { t, locale } = useI18n();
  const duration = clipLabel(product.soundtrack?.durationMs);
  const likes = product.likesCount ?? 0;
  const views = product.viewsCount || likes;

  return (
    <article
      ref={ref}
      data-feed-card
      data-audio-key={cardKey}
      {...(!sound.muted ? { "data-feed-sound-on": "1" } : {})}
      className="relative w-[67vw] max-w-[270px] shrink-0 overflow-hidden rounded-[1.55rem] bg-[#17171c] [transform:translateZ(0)] [isolation:isolate] sm:w-[clamp(190px,18vw,270px)]"
    >
      <div className="relative h-[330px] overflow-hidden bg-surface-2 sm:h-[clamp(280px,29vw,410px)]">
        <Link href={`/product/${product.id}`} className="absolute inset-0">
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
        </Link>
        {product.soundtrack?.audioUrl ? (
          <FeedSoundtrackPlayer
            audioUrl={product.soundtrack.audioUrl}
            startMs={product.soundtrackStartMs}
            sound={sound}
            active={focused}
            onCycleEnd={onPlaybackEnded}
          />
        ) : null}
        {duration || withVideoBadge ? (
          <span className="pointer-events-none absolute top-2.5 left-2.5 z-20 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            <Play className="size-2.5 fill-white" />
            {duration ?? "Video"}
          </span>
        ) : null}
        {audio ? (
          <div className="absolute top-2.5 right-2.5 z-20">
            <VideoSoundButton
              images={product.images}
              hasSoundtrack={Boolean(product.soundtrack?.audioUrl)}
              sound={sound}
              onChange={onSoundChange}
            />
          </div>
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent px-2.5 pb-2.5 pt-14">
          <SellerMeta
            name={product.shop?.name ?? product.title}
            image={product.shop?.logoUrl ?? null}
            views={views}
            locale={locale}
            viewsLabel={t("discover.views")}
            likes={likes}
          />
          {product.shop ? (
            <div className="pointer-events-auto mt-2 flex items-center justify-between gap-2">
              <p className="truncate text-[11px] font-semibold text-[#7dffb3]">
                {formatMoney(product.priceCents, product.currency)}
              </p>
              <Button
                type="button"
                size="sm"
                onClick={onBuy}
                className="h-7 cursor-pointer rounded-full px-3 text-[10px] font-bold"
              >
                {buyLabel}
              </Button>
            </div>
          ) : null}
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
      className="group relative aspect-[3/4] overflow-hidden rounded-[1.25rem] [transform:translateZ(0)] [isolation:isolate]"
    >
      {children}
    </article>
  );
}
