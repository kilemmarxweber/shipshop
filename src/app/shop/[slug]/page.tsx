"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Heart,
  Link2,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Search,
  Share2,
  Store,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { CATEGORIES } from "@/lib/categories";
import { fetchJson } from "@/lib/fetch-json";
import { useAppConfig } from "@/lib/use-app-config";
import { uploadCompressedMedia } from "@/lib/compress-media";
import { colorHex } from "@/lib/product-options";
import { formatMoney, cn } from "@/lib/utils";
import { usePageBack } from "@/components/back-nav-context";
import { useI18n, type MessagePath } from "@/components/i18n-provider";
import { FollowShopButton } from "@/components/follow-shop-button";
import { FeedSoundtrackPlayer } from "@/components/feed-soundtrack-player";
import { PageLoader } from "@/components/page-loader";
import { ProductCommentsSheet } from "@/components/product-comments-sheet";
import { ProductImageCarousel } from "@/components/product-image-carousel";
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
import { MediaThumb } from "@/components/media-thumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ShopProfile = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  lat: number;
  lng: number;
  createdAt: string;
  productsCount: number;
  categories: { id: string; count: number }[];
  addressHint: string;
  contactPhone: string | null;
  contactName: string | null;
  owner: { id: string; name: string; phone: string | null; image: string | null } | null;
  followedByMe?: boolean;
  followersCount?: number;
};

type Product = {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  currency?: string;
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
  canDelete?: boolean;
  shop: {
    id: string;
    name: string;
    slug: string;
    ownerUserId?: string | null;
  };
};

function ShopInner() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const appConfig = useAppConfig();
  const { data: session } = authClient.useSession();
  usePageBack({ fallbackHref: "/" });
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [showAddress, setShowAddress] = useState(false);
  const [manageBusyId, setManageBusyId] = useState<string | null>(null);
  const [soundById, setSoundById] = useState<Record<string, VideoSoundState>>(
    {},
  );
  const [commentProductId, setCommentProductId] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
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

  const isOwnShop = shop?.owner?.id === session?.user?.id;

  function soundFor(id: string): VideoSoundState {
    const base = soundById[id] ?? DEFAULT_VIDEO_SOUND;
    if (audioFocusId !== id) return { ...base, muted: true };
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

  const shopUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/shop/${slug}`
      : `/shop/${slug}`;

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchJson<{ shop?: ShopProfile; error?: string }>(`/api/shops/${slug}`)
      .then(({ res, data }) => {
        if (!res.ok || !data?.shop) {
          setShop(null);
          return;
        }
        setShop(data.shop);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!shop?.id) return;
    const params = new URLSearchParams({
      status: "ACTIVE",
      shopId: shop.id,
    });
    if (q.trim()) params.set("q", q.trim());
    if (category) params.set("category", category);
    const debounce = setTimeout(() => {
      fetchJson<{ products?: Product[] }>(`/api/products?${params}`)
        .then(({ data }) => setProducts(data?.products ?? []))
        .catch(() => setProducts([]));
    }, 200);
    return () => clearTimeout(debounce);
  }, [shop?.id, q, category]);

  const categoryChips = useMemo(() => {
    if (!shop) return [];
    const known = new Set<string>(CATEGORIES.map((c) => c.id));
    return shop.categories.map((c) => ({
      id: c.id,
      count: c.count,
      label: CATEGORIES.find((x) => x.id === c.id)
        ? t(`categories.${c.id}` as MessagePath)
        : c.id,
      gradient:
        CATEGORIES.find((x) => x.id === c.id)?.gradient ??
        "from-slate-500 to-slate-700",
      known: known.has(c.id),
    }));
  }, [shop, t]);

  async function toggleLike(product: Product) {
    if (!session) {
      router.push("/auth/login");
      return;
    }
    const wasLiked = product.likedByMe;
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id
          ? {
              ...p,
              likedByMe: !wasLiked,
              likesCount: p.likesCount + (wasLiked ? -1 : 1),
            }
          : p,
      ),
    );
    const { res } = await fetchJson(`/api/products/${product.id}/like`, {
      method: "POST",
    });
    if (!res.ok) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? {
                ...p,
                likedByMe: wasLiked,
                likesCount: p.likesCount + (wasLiked ? 1 : -1),
              }
            : p,
        ),
      );
      toast.error(t("feed.likeFailed"));
    }
  }

  async function archiveProduct(product: Product) {
    setManageBusyId(product.id);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/products/${product.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "HIDDEN" }),
      },
    );
    setManageBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? t("product.unavailable"));
      return;
    }
    toast.success(t("product.archived"));
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    setShop((prev) =>
      prev
        ? { ...prev, productsCount: Math.max(0, prev.productsCount - 1) }
        : prev,
    );
  }

  async function deleteProduct(product: Product) {
    if (!confirm(t("product.deleteConfirm"))) return;
    setManageBusyId(product.id);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/products/${product.id}`,
      { method: "DELETE" },
    );
    setManageBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? t("product.deleteBlocked"));
      return;
    }
    toast.success(t("product.deleted"));
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    setShop((prev) =>
      prev
        ? { ...prev, productsCount: Math.max(0, prev.productsCount - 1) }
        : prev,
    );
  }

  async function messageSeller() {
    if (!session) {
      router.push("/auth/login");
      return;
    }
    if (!shop) return;
    const { res, data } = await fetchJson<{
      conversation?: { id: string };
      error?: string;
    }>("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopId: shop.id,
        message: `${t("shop.interestedIn")} ${shop.name}.`,
      }),
    });
    if (!res.ok || !data?.conversation) {
      toast.error(data?.error ?? t("shop.messageFailed"));
      return;
    }
    router.push(`/messages/${data.conversation.id}`);
  }

  async function uploadLogo(file: File) {
    if (!shop) return;
    setLogoBusy(true);
    try {
      const uploaded = await uploadCompressedMedia(file, "avatar");
      const { res, data } = await fetchJson<{
        shop?: { logoUrl: string | null };
        error?: string;
      }>(`/api/shops/${shop.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: uploaded.url }),
      });
      if (!res.ok) {
        toast.error(data?.error ?? t("media.moderationUnavailable"));
        return;
      }
      setShop((prev) =>
        prev ? { ...prev, logoUrl: data?.shop?.logoUrl ?? uploaded.url } : prev,
      );
      toast.success(t("shop.logoSaved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("shop.logo"));
    } finally {
      setLogoBusy(false);
    }
  }

  function copyShopLink() {
    void navigator.clipboard.writeText(shopUrl).then(
      () => toast.success(t("shop.linkCopied")),
      () => toast.error(t("common.copyImpossible")),
    );
  }

  if (loading) return <PageLoader />;

  if (!shop) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="font-heading text-lg font-bold">{t("shop.notFound")}</p>
        <Link href="/" className="mt-4 inline-block text-sm text-primary">
          {t("shop.backToFeed")}
        </Link>
      </div>
    );
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}`;
  const refCode = shop.slug.toUpperCase().slice(0, 12);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden md:h-auto md:overflow-visible">
      {/* En-tête boutique */}
      <header className="shrink-0 border-b border-border bg-background/95 px-4 pb-3 pt-1 backdrop-blur">
        <div className="flex items-start gap-3">
          <label
            className={cn(
              "relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary to-violet-600 text-xl font-bold text-white",
              isOwnShop && "cursor-pointer",
            )}
          >
            {shop.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shop.logoUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              shop.name.slice(0, 1).toUpperCase()
            )}
            {isOwnShop && (
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={logoBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadLogo(file);
                }}
              />
            )}
          </label>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-lg font-bold">
              {shop.name}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              @{shop.slug} · {t("shop.ref")} {refCode} · {shop.productsCount}{" "}
              {shop.productsCount > 1
                ? t("shop.productOther")
                : t("shop.productOne")}
              {typeof shop.followersCount === "number"
                ? ` · ${shop.followersCount} ${
                    shop.followersCount > 1
                      ? t("shopExtra.followerOther")
                      : t("shopExtra.followerOne")
                  }`
                : ""}
            </p>
            {shop.description && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {shop.description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FollowShopButton
            slug={shop.slug}
            followedByMe={Boolean(shop.followedByMe)}
            isOwnShop={isOwnShop}
            onChange={(followed) =>
              setShop((prev) =>
                prev
                  ? {
                      ...prev,
                      followedByMe: followed,
                      followersCount: Math.max(
                        0,
                        (prev.followersCount ?? 0) + (followed ? 1 : -1),
                      ),
                    }
                  : prev,
              )
            }
          />
          {shop.contactPhone ? (
            <a
              href={`tel:${shop.contactPhone}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 text-xs font-semibold text-foreground"
            >
              <Phone className="size-3.5 text-trust" />
              {shop.contactPhone}
            </a>
          ) : (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs text-muted-foreground">
              <Phone className="size-3.5" />
              {t("shop.contactUnpublished")}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0 cursor-pointer"
            onClick={() => setShowAddress((v) => !v)}
            aria-label={t("shop.seeAddress")}
            title={t("shop.seeAddress")}
          >
            <MapPin className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0 cursor-pointer"
            onClick={copyShopLink}
            aria-label={t("shop.copyLink")}
            title={t("shop.copyLink")}
          >
            <Link2 className="size-4" />
          </Button>
          <ShareMenu
            title={shop.name}
            text={`${t("shop.discoverShop")} ${shop.name} ${t("product.onShipShop")}`}
            url={shopUrl}
            triggerClassName="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-background"
          >
            <Share2 className="size-4" aria-hidden />
            <span className="sr-only">{t("shop.share")}</span>
          </ShareMenu>
          <Button
            type="button"
            size="icon"
            className="size-9 shrink-0 cursor-pointer"
            onClick={messageSeller}
            aria-label={t("shop.message")}
            title={t("shop.message")}
          >
            <MessageCircle className="size-4" />
          </Button>
        </div>

        {showAddress && (
          <div className="mt-3 rounded-2xl border border-border bg-surface p-3 text-sm">
            <p className="flex items-start gap-2 font-semibold">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              {shop.addressHint}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("shop.coordinates")} · {shop.lat.toFixed(5)}, {shop.lng.toFixed(5)}
            </p>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-xs font-bold text-primary"
            >
              {t("shop.openInMaps")}
            </a>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-surface-2 px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("shop.searchPlaceholder")}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>

        {categoryChips.length > 0 && (
          <div className="h-scroll h-scroll-fade mt-3 gap-2">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap",
                !category
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface",
              )}
            >
              {t("shop.filterAll")} ({shop.productsCount})
            </button>
            {categoryChips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  setCategory((prev) => (prev === c.id ? null : c.id))
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap",
                  category === c.id
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface",
                )}
              >
                {c.label} ({c.count})
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Feed type Pour toi */}
      {products.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <Store className="mb-3 size-10 text-muted-foreground" />
          <p className="font-heading font-bold">{t("shop.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {q || category ? t("shop.emptyFilter") : t("shop.emptyNone")}
          </p>
        </div>
      ) : (
        <div className="feed-snap min-h-0 flex-1 overflow-y-auto overscroll-y-contain md:grid md:h-auto md:flex-none md:grid-cols-2 md:gap-3 md:overflow-visible md:overscroll-auto md:p-4 md:pb-8">
          {products.map((p) => (
            <article
              key={p.id}
              className="feed-snap-item relative flex h-full min-h-full w-full shrink-0 flex-col justify-end overflow-hidden md:h-[min(520px,70dvh)] md:min-h-0 md:rounded-2xl"
            >
              <ProductImageCarousel
                images={p.images}
                overlay
                fit="cover"
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
                onActivateSound={() => activateSound(p.id)}
                onDoubleLike={() => {
                  if (p.likedByMe) return;
                  void toggleLike(p);
                }}
              />
              {p.soundtrack?.audioUrl ? (
                <FeedSoundtrackPlayer
                  audioUrl={p.soundtrack.audioUrl}
                  startMs={p.soundtrackStartMs}
                  sound={soundFor(p.id)}
                  active={audioFocusId === p.id}
                />
              ) : null}

              <div className="absolute top-3 left-3 z-10 flex max-w-[70%] flex-col gap-1.5 sm:top-4 sm:left-4 sm:gap-2">
                <span className="w-fit rounded-full border border-white/25 bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                  {p.category}
                </span>
              </div>

              <div className="absolute right-2.5 bottom-[7.5rem] z-20 flex flex-col items-center gap-3.5 sm:right-3 sm:bottom-36 sm:gap-4 md:bottom-28">
                {isOwnShop && (
                  <>
                    <Link
                      href={`/product/${p.id}`}
                      className="grid cursor-pointer place-items-center"
                      title={t("product.edit")}
                      aria-label={t("product.edit")}
                    >
                      <span className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 backdrop-blur transition hover:scale-105 active:scale-95">
                        <Pencil className="size-5 text-white" />
                      </span>
                    </Link>
                    <button
                      type="button"
                      disabled={manageBusyId === p.id}
                      onClick={() => archiveProduct(p)}
                      className="grid cursor-pointer place-items-center disabled:opacity-50"
                      title={t("product.archive")}
                      aria-label={t("product.archive")}
                    >
                      <span className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 backdrop-blur transition hover:scale-105 active:scale-95">
                        <Archive className="size-5 text-white" />
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={manageBusyId === p.id}
                      onClick={() => deleteProduct(p)}
                      className="grid cursor-pointer place-items-center disabled:opacity-50"
                      title={t("product.delete")}
                      aria-label={t("product.delete")}
                    >
                      <span className="grid size-10 place-items-center rounded-full border border-destructive/40 bg-destructive/25 backdrop-blur transition hover:scale-105 active:scale-95">
                        <Trash2 className="size-5 text-white" />
                      </span>
                    </button>
                  </>
                )}
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
                    <MessageCircle className="size-5 text-white" />
                  </span>
                  <span className="mt-0.5 text-[10px] font-bold text-white drop-shadow">
                    {p.commentsCount || 0}
                  </span>
                </button>
                <ShareMenu
                  title={p.title}
                  productId={p.id}
                  text={`${p.title} — ${formatMoney(p.priceCents, p.currency)}`}
                  url={`${typeof window !== "undefined" ? window.location.origin : ""}/product/${p.id}`}
                  align="end"
                  side="left"
                  triggerClassName="grid cursor-pointer place-items-center border-0 bg-transparent p-0 text-white"
                >
                  <span
                    className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 backdrop-blur transition hover:scale-105 active:scale-95"
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
                <Link
                  href={`/product/${p.id}`}
                  className="flex items-center gap-2.5 rounded-2xl border border-white/12 bg-black/45 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-black/55 sm:gap-3 sm:p-2.5"
                >
                  <MediaThumb
                    images={p.images}
                    className="size-11 shrink-0 rounded-xl ring-1 ring-white/10 sm:size-12"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white">
                      {p.title}
                    </p>
                    <p className="font-heading text-sm font-bold text-trust">
                      {formatMoney(p.priceCents, p.currency)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary px-3.5 py-2 text-[11px] font-bold text-white">
                    {t("common.see")}
                  </span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
      <ProductCommentsSheet
        productId={commentProductId}
        open={Boolean(commentProductId)}
        onOpenChange={(open) => {
          if (!open) setCommentProductId(null);
        }}
        onCountChange={(id, count) =>
          setProducts((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, commentsCount: count } : item,
            ),
          )
        }
      />
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ShopInner />
    </Suspense>
  );
}
