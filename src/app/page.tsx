"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Heart, MapPin, MessageCircle, Share2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney, cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { PageLoader } from "@/components/page-loader";
import { FollowShopButton } from "@/components/follow-shop-button";
import { ProductImageCarousel } from "@/components/product-image-carousel";
import { ShareMenu } from "@/components/share-menu";
import { isVideoUrl } from "@/lib/media";
import { colorHex } from "@/lib/product-options";
import type { MessagePath } from "@/components/i18n-provider";

type Product = {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  category: string;
  images: string[];
  colors: string[];
  sizes: string[];
  location: string | null;
  likesCount: number;
  likedByMe: boolean;
  shop: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    ownerUserId?: string | null;
    followedByMe?: boolean;
  };
};

type FeedTab = "foryou" | "following";

function categoryLabel(
  t: (path: MessagePath) => string,
  id: string,
): string {
  const key = `categories.${id}` as MessagePath;
  const label = t(key);
  return label === key ? id : label;
}

export default function FeedPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: session } = authClient.useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FeedTab>("foryou");

  useEffect(() => {
    if (tab === "following" && !session) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const url =
      tab === "following"
        ? "/api/products?status=ACTIVE&following=1"
        : "/api/products?status=ACTIVE";
    fetchJson<{ products?: Product[] }>(url)
      .then(({ data }) => setProducts(data?.products ?? []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [tab, session?.user?.id]);

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

  async function toggleLike(product: Product) {
    if (!session) {
      router.push("/auth/login");
      return;
    }
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

  async function messageSeller(product: Product) {
    if (!session) {
      router.push("/auth/login");
      return;
    }
    const { res, data } = await fetchJson<{
      conversation?: { id: string };
      error?: string;
    }>("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopId: product.shop.id,
        productId: product.id,
      }),
    });
    if (!res.ok || !data?.conversation) {
      toast.error(data?.error ?? t("feed.conversationFailed"));
      return;
    }
    router.push(`/messages/${data.conversation.id}`);
  }

  const tabs = (
    <div className="flex shrink-0 justify-center gap-6 border-b border-border px-4 py-2 text-sm font-semibold">
      <button
        type="button"
        onClick={() => setTab("following")}
        className={cn(
          "pb-1",
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
          "pb-1",
          tab === "foryou"
            ? "border-b-2 border-primary text-foreground"
            : "text-muted-foreground",
        )}
      >
        {t("feed.tabForYou")}
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
            />

            <div className="absolute top-3 left-3 z-10 flex max-w-[70%] flex-col gap-1.5 sm:top-4 sm:left-4 sm:gap-2">
              <span className="w-fit rounded-full border border-trust/30 bg-trust/15 px-2.5 py-1 text-[10px] font-semibold text-trust backdrop-blur">
                <ShieldCheck className="mr-1 inline size-3" />
                {t("feed.moneyProtected")}
              </span>
              <span className="w-fit rounded-full border border-white/25 bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                {categoryLabel(t, p.category)}
              </span>
            </div>

            <div className="absolute right-2.5 bottom-[7.5rem] z-20 flex flex-col items-center gap-3.5 sm:right-3 sm:bottom-36 sm:gap-4 md:bottom-28">
              <button
                type="button"
                onClick={() => toggleLike(p)}
                className="flex cursor-pointer flex-col items-center gap-1"
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
                <span className="text-[10px] font-semibold text-white drop-shadow">
                  {p.likesCount || t("feed.like")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => messageSeller(p)}
                className="flex cursor-pointer flex-col items-center gap-1"
                aria-label={t("feed.messageSeller")}
              >
                <span className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:scale-105 active:scale-95">
                  <MessageCircle className="size-5" />
                </span>
                <span className="text-[10px] font-semibold text-white drop-shadow">
                  {t("feed.msg")}
                </span>
              </button>
              <ShareMenu
                title={p.title}
                productId={p.id}
                text={`${p.title} — ${formatMoney(p.priceCents)} ${t("product.onShipShop")}`}
                url={`${typeof window !== "undefined" ? window.location.origin : ""}/product/${p.id}`}
                align="end"
                side="left"
                triggerClassName="flex cursor-pointer flex-col items-center gap-1 border-0 bg-transparent p-0"
              >
                <span className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:scale-105 active:scale-95">
                  <Share2 className="size-5" />
                </span>
                <span className="text-[10px] font-semibold text-white drop-shadow">
                  {t("feed.share")}
                </span>
              </ShareMenu>
            </div>

            <div className="relative z-10 mt-auto px-3 pb-5 pt-3 pr-14 text-white sm:px-4 sm:pb-6 sm:pr-16">
              <div className="mb-2 flex items-center gap-2">
                <Link
                  href={`/shop/${p.shop.slug}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <div className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-violet-500 text-xs font-bold text-white ring-2 ring-white/20">
                    {p.shop.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.shop.logoUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      p.shop.name.slice(0, 1)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white underline-offset-2 hover:underline">
                      @{p.shop.name}
                    </p>
                    <p className="flex items-center gap-1 text-[10px] text-white/70">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">
                        {p.location ?? t("common.kinshasa")}
                      </span>
                    </p>
                  </div>
                </Link>
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
              <Link
                href={`/product/${p.id}`}
                className="flex items-center gap-2.5 rounded-2xl border border-white/12 bg-black/45 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-black/55 sm:gap-3 sm:p-2.5"
              >
                <div
                  className="size-11 shrink-0 overflow-hidden rounded-xl bg-cover bg-center ring-1 ring-white/10 sm:size-12"
                  style={
                    p.images[0] && !isVideoUrl(p.images[0])
                      ? { backgroundImage: `url(${p.images[0]})` }
                      : undefined
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">
                    {p.title}
                  </p>
                  <p className="font-heading text-sm font-bold text-trust">
                    {formatMoney(p.priceCents)}
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
    </div>
  );
}
