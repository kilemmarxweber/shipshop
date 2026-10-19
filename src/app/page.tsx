"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney, cn } from "@/lib/utils";
import { useAppConfig } from "@/lib/use-app-config";
import { useI18n } from "@/components/i18n-provider";
import { PageLoader } from "@/components/page-loader";
import { FollowShopButton } from "@/components/follow-shop-button";
import { ProductCommentsSheet } from "@/components/product-comments-sheet";
import { FeedSoundtrackPlayer } from "@/components/feed-soundtrack-player";
import { ProductImageCarousel } from "@/components/product-image-carousel";
import { ShopBrand } from "@/components/shop-brand";
import { ShareMenu } from "@/components/share-menu";
import {
  DEFAULT_VIDEO_SOUND,
  VideoSoundButton,
  productHasVideo,
  type VideoSoundState,
} from "@/components/video-sound-button";
import {
  requestFeedAudioFocus,
  useFeedAudioFocus,
} from "@/lib/feed-audio-focus";
import { applyExclusiveVideoSound } from "@/lib/feed-video-sound";
import { colorHex } from "@/lib/product-options";
import { AuthInline } from "@/components/auth-inline";
import { BuyProductSheet } from "@/components/buy-product-sheet";
import { MediaThumb } from "@/components/media-thumb";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getCurrentGeoCoords } from "@/lib/browser-geolocation";
import type { MessagePath } from "@/components/i18n-provider";
import { WantedCard, type WantedListItem } from "@/components/wanted-card";
import {
  FeedLoadSentinel,
  FeedLoadTrigger,
} from "@/components/feed-load-trigger";
import { usePaginatedList } from "@/lib/use-paginated-list";
import { PUBLIC_PAGE_SIZE } from "@/lib/list-cursor";
import { DwellArticle } from "@/components/dwell-article";

type Product = {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  currency?: string;
  quantity?: number;
  soldCount?: number;
  category: string;
  images: string[];
  imageMotions?: string[];
  colors: string[];
  sizes: string[];
  location: string | null;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  soundtrackStartMs?: number;
  soundtrack?: { id: string; title: string; audioUrl: string } | null;
  shop: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    ownerUserId?: string | null;
    followedByMe?: boolean;
    lat?: number | null;
    lng?: number | null;
  };
};

type FeedTab = "foryou" | "following" | "wanted";

function categoryLabel(
  t: (path: MessagePath) => string,
  id: string,
): string {
  const key = `categories.${id}` as MessagePath;
  const label = t(key);
  return label === key ? id : label;
}

export default function FeedPage() {
  const { t } = useI18n();
  const appConfig = useAppConfig();
  const { data: session } = authClient.useSession();
  const [tab, setTab] = useState<FeedTab>("foryou");

  useEffect(() => {
    void getCurrentGeoCoords()
      .then((coords) =>
        setNear({ lat: coords.latitude, lng: coords.longitude }),
      )
      .catch(() => undefined);
  }, []);
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const productFeed = usePaginatedList<Product>({
    enabled: tab !== "wanted" && !(tab === "following" && !session),
    cacheKey:
      tab === "following"
        ? `products:following:${session?.user?.id ?? ""}`
        : `products:foryou:${session?.user?.id ?? "guest"}:${near ? "near" : "all"}`,
    prefetchRemaining: 4,
    deps: [tab, session?.user?.id, near?.lat, near?.lng],
    buildUrl: (cursor) => {
      const params = new URLSearchParams({
        status: "ACTIVE",
        limit: String(PUBLIC_PAGE_SIZE),
      });
      if (tab === "following") params.set("following", "1");
      if (tab === "foryou" && near) {
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
  const wantedFeed = usePaginatedList<WantedListItem>({
    enabled: tab === "wanted",
    cacheKey: "wanted:open",
    deps: [tab],
    buildUrl: (cursor) => {
      const params = new URLSearchParams({ limit: String(PUBLIC_PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);
      return `/api/wanted?${params}`;
    },
    extract: (json) => {
      const data = json as {
        requests?: WantedListItem[];
        nextCursor?: string | null;
      };
      return { items: data.requests ?? [], nextCursor: data.nextCursor ?? null };
    },
  });
  const products = productFeed.items;
  const setProducts = productFeed.setItems;
  const wanted = wantedFeed.items;
  const loading =
    tab === "wanted" ? wantedFeed.loading : productFeed.loading;
  const loadMoreProducts = productFeed.loadMore;
  const loadMoreWanted = wantedFeed.loadMore;
  const [soundById, setSoundById] = useState<Record<string, VideoSoundState>>(
    {},
  );
  const [commentProductId, setCommentProductId] = useState<string | null>(null);
  const audioFocusId = useFeedAudioFocus();
  const prevAudioFocus = useRef<string | null>(null);

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
    setSoundById({});
  }, [tab]);

  function soundFor(id: string): VideoSoundState {
    const base = soundById[id] ?? DEFAULT_VIDEO_SOUND;
    if (audioFocusId !== id) return { ...base, muted: true };
    return base;
  }

  function activateSound(id: string) {
    if (!soundFor(id).muted) {
      requestFeedAudioFocus(id);
      return;
    }
    requestFeedAudioFocus(id);
    setSoundById((prev) =>
      applyExclusiveVideoSound(prev, id, {
        muted: false,
        volume: (prev[id] ?? DEFAULT_VIDEO_SOUND).volume,
      }),
    );
  }

  const prefetchAt = Math.max(0, products.length - 4);

  useEffect(() => {
    const root = document.querySelector(".app-main");
    if (!root) return;
    const onScroll = () => {
      productFeed.noteUserScroll();
      wantedFeed.noteUserScroll();
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [productFeed.noteUserScroll, wantedFeed.noteUserScroll]);

  function setShopFollowed(shopId: string, followed: boolean) {
    setProducts((prev) => {
      if (!followed && tab === "following") {
        return prev.filter((p) => p.shop.id !== shopId);
      }
      return prev.map((p) =>
        p.shop.id === shopId
          ? { ...p, shop: { ...p.shop, followedByMe: followed } }
          : p,
      );
    });
  }

  async function toggleLike(product: Product, opts?: { forceLike?: boolean }) {
    if (!session) {
      setAuthOpen(true);
      return;
    }
    if (opts?.forceLike && product.likedByMe) return;
    const wasLiked = product.likedByMe;
    const nextLiked = !wasLiked;
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id
          ? {
              ...p,
              likedByMe: nextLiked,
              likesCount: Math.max(0, p.likesCount + (nextLiked ? 1 : -1)),
            }
          : p,
      ),
    );

    const method = wasLiked ? "DELETE" : "POST";
    const { res, data } = await fetchJson<{
      liked?: boolean;
      likesCount?: number;
      notified?: boolean;
      messageRemoved?: boolean;
      error?: string;
    }>(`/api/products/${product.id}/like`, { method });

    if (!res.ok) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? {
                ...p,
                likedByMe: wasLiked,
                likesCount: product.likesCount,
              }
            : p,
        ),
      );
      toast.error(data?.error ?? t("feed.likeFailed"));
      return;
    }

    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id
          ? {
              ...p,
              likedByMe: Boolean(data?.liked),
              likesCount: data?.likesCount ?? p.likesCount,
            }
          : p,
      ),
    );

    if (data?.liked && data.notified) {
      toast.success(t("feed.likeSent"));
    } else if (data && !data.liked && data.messageRemoved) {
      toast.success(t("feed.likeRemoved"));
    }
  }

  const tabs = (
    <div className="flex shrink-0 justify-center gap-6 border-b border-border px-4 py-2 text-sm font-semibold">
      <button
        type="button"
        onClick={() => setTab("following")}
        className={cn(
          "cursor-pointer pb-1",
          tab === "following"
            ? "border-b-2 border-primary text-foreground"
            : "text-muted-foreground",
        )}
      >
        {t("feed.tabFollowing")}
      </button>
      <button
        type="button"
        onClick={() => setTab("foryou")}
        className={cn(
          "cursor-pointer pb-1",
          tab === "foryou"
            ? "border-b-2 border-primary text-foreground"
            : "text-muted-foreground",
        )}
      >
        {t("feed.tabForYou")}
      </button>
      <button
        type="button"
        onClick={() => setTab("wanted")}
        className={cn(
          "cursor-pointer pb-1",
          tab === "wanted"
            ? "border-b-2 border-primary text-foreground"
            : "text-muted-foreground",
        )}
      >
        {t("feed.tabWanted")}
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {tabs}
        <PageLoader className="h-[70dvh]" />
      </div>
    );
  }

  if (tab === "following" && !session) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {tabs}
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="font-heading text-lg font-bold">
            {t("feed.loginToFollowTitle")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("feed.loginToFollowHint")}
          </p>
          <Link
            href="/auth/login"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t("auth.login")}
          </Link>
        </div>
      </div>
    );
  }

  if (tab === "wanted") {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {tabs}
        <div
          className="feed-wanted-scroll flex-1 overflow-y-auto px-4 py-3"
          onScroll={wantedFeed.noteUserScroll}
        >
          {wanted.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {t("wanted.empty")}
            </p>
          ) : (
            <div className="space-y-2">
              {wanted.map((item) => (
                <WantedCard key={item.id} item={item} />
              ))}
              {wantedFeed.hasMore ? (
                <FeedLoadSentinel
                  onVisible={loadMoreWanted}
                  rootSelector=".feed-wanted-scroll"
                  resumeKey={`${wanted.length}:${wantedFeed.loadingMore ? 1 : 0}`}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {tabs}
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          {tab === "following" ? (
            <>
              <p className="font-heading text-lg font-bold">
                {t("feed.emptyFollowingTitle")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("feed.emptyFollowingHint")}
              </p>
              <button
                type="button"
                onClick={() => setTab("foryou")}
                className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                {t("feed.exploreForYou")}
              </button>
            </>
          ) : (
            <>
              <p className="font-heading text-lg font-bold">
                {t("feed.emptyForYouTitle")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("feed.emptyForYouHint")}
              </p>
              <Link
                href="/publish"
                className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                {t("nav.publish")}
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden md:h-auto md:overflow-visible">
      {tabs}

      <div
        className="feed-snap min-h-0 flex-1 overflow-y-auto overscroll-y-contain md:grid md:h-auto md:flex-none md:grid-cols-2 md:gap-3 md:overflow-visible md:overscroll-auto md:p-4 md:pb-8"
        data-experiment-id={appConfig.experimentId ?? undefined}
        onScroll={productFeed.noteUserScroll}
      >
        {products.map((p, index) => (
          <DwellArticle
            key={p.id}
            productId={p.id}
            enabled={Boolean(session)}
            className="feed-snap-item relative flex h-full min-h-full w-full shrink-0 flex-col justify-end overflow-hidden md:h-[min(520px,70dvh)] md:min-h-0 md:rounded-2xl"
          >
            <ProductImageCarousel
              images={p.images}
              overlay
              className="absolute inset-0"
              muted={soundFor(p.id).muted}
              volume={soundFor(p.id).volume}
              hasSoundtrack={Boolean(p.soundtrack?.audioUrl)}
              clipMs={p.soundtrack?.audioUrl ? appConfig.clipMs : undefined}
              motions={p.imageMotions}
              audioKey={
                productHasVideo(p.images) || p.soundtrack?.audioUrl
                  ? p.id
                  : undefined
              }
              onActivateSound={
                productHasVideo(p.images) || p.soundtrack?.audioUrl
                  ? () => activateSound(p.id)
                  : undefined
              }
              onDoubleLike={() => void toggleLike(p, { forceLike: true })}
            />
            {p.soundtrack?.audioUrl ? (
              <FeedSoundtrackPlayer
                audioUrl={p.soundtrack.audioUrl}
                startMs={p.soundtrackStartMs}
                sound={soundFor(p.id)}
                active={audioFocusId === p.id}
              />
            ) : null}
            {index === prefetchAt || index === products.length - 1 ? (
              <FeedLoadTrigger
                onNearEnd={loadMoreProducts}
                disabled={!productFeed.hasMore}
              />
            ) : null}

            <div className="absolute top-3 left-3 z-10 flex max-w-[70%] flex-col gap-1.5 sm:top-4 sm:left-4 sm:gap-2">
              {productHasVideo(p.images) ? (
                <span className="w-fit rounded-full border border-white/25 bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                  {t("buy.realVideo")}
                </span>
              ) : (
                <span className="w-fit rounded-full border border-white/25 bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                  {categoryLabel(t, p.category)}
                </span>
              )}
            </div>

            <div className="absolute right-2.5 bottom-[7.5rem] z-20 flex flex-col items-center gap-3.5 sm:right-3 sm:bottom-36 sm:gap-4 md:bottom-28">
              <button
                type="button"
                onClick={() => toggleLike(p)}
                className="grid cursor-pointer place-items-center"
                aria-label={
                  p.likesCount
                    ? `${t("feed.like")} (${p.likesCount})`
                    : t("feed.like")
                }
              >
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-full border backdrop-blur transition hover:scale-105 active:scale-95",
                    p.likedByMe
                      ? "border-destructive/50 bg-destructive/25"
                      : "border-white/15 bg-white/10",
                  )}
                >
                  <Heart
                    className={cn(
                      "size-5 text-white",
                      p.likedByMe && "fill-destructive text-destructive",
                    )}
                  />
                </span>
                <span className="mt-0.5 text-[10px] font-bold text-white drop-shadow">
                  {p.likesCount || 0}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCommentProductId(p.id)}
                className="grid cursor-pointer place-items-center"
                aria-label={t("feed.comments")}
              >
                <span className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:scale-105 active:scale-95">
                  <MessageCircle className="size-5" />
                </span>
                <span className="mt-0.5 text-[10px] font-bold text-white drop-shadow">
                  {p.commentsCount || 0}
                </span>
              </button>
              <ShareMenu
                title={p.title}
                productId={p.id}
                text={`${p.title} — ${formatMoney(p.priceCents, p.currency)} ${t("product.onShipShop")}`}
                url={`${typeof window !== "undefined" ? window.location.origin : ""}/product/${p.id}`}
                align="end"
                side="left"
                triggerClassName="grid cursor-pointer place-items-center border-0 bg-transparent p-0"
              >
                <span
                  className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:scale-105 active:scale-95"
                  aria-label={t("feed.share")}
                >
                  <Share2 className="size-5" />
                </span>
              </ShareMenu>
              <VideoSoundButton
                images={p.images}
                hasSoundtrack={Boolean(p.soundtrack?.audioUrl)}
                sound={soundFor(p.id)}
                onChange={(next) => {
                  if (!next.muted) requestFeedAudioFocus(p.id);
                  setSoundById((prev) =>
                    applyExclusiveVideoSound(prev, p.id, next),
                  );
                }}
              />
            </div>

            <div className="relative z-10 mt-auto px-3 pb-5 pt-3 pr-14 text-white sm:px-4 sm:pb-6 sm:pr-16">
              <div className="mb-2 flex items-center gap-2">
                <ShopBrand
                  name={p.shop.name}
                  slug={p.shop.slug}
                  logoUrl={p.shop.logoUrl}
                  className="min-w-0 flex-1"
                  nameClassName="text-sm text-white underline-offset-2 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                />
                <FollowShopButton
                  slug={p.shop.slug}
                  followedByMe={Boolean(p.shop.followedByMe)}
                  isOwnShop={
                    Boolean(session?.user?.id) &&
                    p.shop.ownerUserId === session?.user?.id
                  }
                  compact
                  onChange={(followed) => setShopFollowed(p.shop.id, followed)}
                />
              </div>
              {(p.colors.length > 0 || p.sizes.length > 0) && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {p.colors.slice(0, 5).map((c) => (
                    <span
                      key={c}
                      title={c}
                      className="size-4 rounded-full border border-white/30"
                      style={{ backgroundColor: colorHex(c) }}
                    />
                  ))}
                  {p.sizes.slice(0, 4).map((s) => (
                    <span
                      key={s}
                      className="rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold backdrop-blur"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {p.description && (
                <p className="mb-2.5 line-clamp-2 text-xs text-white/85 sm:mb-3">
                  {p.description}
                </p>
              )}
              <div className="flex items-center gap-2.5 rounded-2xl border border-white/12 bg-black/45 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:gap-3 sm:p-2.5">
                <Link href={`/product/${p.id}`} className="contents">
                  <MediaThumb
                    images={p.images}
                    className="size-11 shrink-0 rounded-xl ring-1 ring-white/10 sm:size-12"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">
                    {p.title}
                  </p>
                  <p className="font-heading text-sm font-bold text-trust">
                    {formatMoney(p.priceCents, p.currency)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBuyProduct(p)}
                  className="min-h-11 shrink-0 rounded-full bg-primary px-4 py-2 text-[11px] font-bold text-white"
                >
                  {t("buy.cta")}
                </button>
              </div>
            </div>
          </DwellArticle>
        ))}
        {productFeed.hasMore ? (
          <FeedLoadSentinel
            onVisible={loadMoreProducts}
            resumeKey={`${products.length}:${productFeed.loadingMore ? 1 : 0}`}
          />
        ) : null}
        {productFeed.loadingMore ? (
          <p className="py-4 text-center text-xs text-muted-foreground md:col-span-2">
            …
          </p>
        ) : null}
      </div>
      <ProductCommentsSheet
        productId={commentProductId}
        open={Boolean(commentProductId)}
        onOpenChange={(open) => {
          if (!open) setCommentProductId(null);
        }}
        onCountChange={(id, count) =>
          setProducts((prev) =>
            prev.map((p) =>
              p.id === id ? { ...p, commentsCount: count } : p,
            ),
          )
        }
      />
      <BuyProductSheet
        product={buyProduct}
        open={Boolean(buyProduct)}
        onOpenChange={(open) => {
          if (!open) setBuyProduct(null);
        }}
      />
      <Sheet open={authOpen} onOpenChange={setAuthOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl bg-surface">
          <SheetHeader>
            <SheetTitle>{t("buy.loginTitle")}</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <AuthInline onSuccess={() => setAuthOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
