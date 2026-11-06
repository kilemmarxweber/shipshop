"use client";

import { Link2, MapPin, MessageCircle, Phone, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { matchOpenLive } from "@/components/feed-live-badge";
import { FollowShopButton } from "@/components/follow-shop-button";
import { useI18n } from "@/components/i18n-provider";
import { ShareMenu } from "@/components/share-menu";
import { ShopLiveAvatar } from "@/components/shop-brand";
import { ShopHoursNotice } from "@/components/shop-hours-notice";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { compactCount } from "@/lib/growth/challenge-look";
import { useOpenLives } from "@/lib/growth/use-open-lives";
import type { ShopHoursFields } from "@/lib/shop-hours";
import { cn, formatMoney } from "@/lib/utils";

export type ShopProfileTarget = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  ownerUserId?: string | null;
  followedByMe?: boolean;
  followersCount?: number;
};

type ShopDetail = ShopProfileTarget &
  ShopHoursFields & {
    description?: string | null;
    productsCount?: number;
    contactPhone?: string | null;
    addressHint?: string | null;
    lat?: number | null;
    lng?: number | null;
    categories?: { id: string; count: number }[];
  };

type ProductRow = {
  id: string;
  title: string;
  priceCents: number;
  currency?: string;
  images: string[];
};

const PRODUCT_PREVIEW = 6;

type Props = {
  shop: ShopProfileTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFollowChange?: (
    shopId: string,
    followed: boolean,
    followersCount?: number,
  ) => void;
};

export function ShopProfileSheet({
  shop,
  open,
  onOpenChange,
  onFollowChange,
}: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const openLives = useOpenLives();

  const [detail, setDetail] = useState<ShopDetail | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [showAddress, setShowAddress] = useState(false);

  useEffect(() => {
    if (!open || !shop?.slug) return;
    let alive = true;
    setLoading(true);
    setShowAllProducts(false);
    setShowAddress(false);
    void (async () => {
      try {
        const [shopRes, productsRes] = await Promise.all([
          fetchJson<{ shop?: ShopDetail }>(`/api/shops/${shop.slug}`),
          fetchJson<{ products?: ProductRow[] }>(
            `/api/products?shopId=${encodeURIComponent(shop.id)}&limit=48&status=ACTIVE`,
          ),
        ]);
        if (!alive) return;
        setDetail(
          shopRes.data?.shop
            ? {
                ...shop,
                ...shopRes.data.shop,
                followedByMe:
                  shopRes.data.shop.followedByMe ?? shop.followedByMe,
                followersCount:
                  shopRes.data.shop.followersCount ?? shop.followersCount,
              }
            : { ...shop },
        );
        setProducts(productsRes.data?.products ?? []);
      } catch {
        if (!alive) return;
        setDetail({ ...shop });
        setProducts([]);
        toast.error(t("shop.notFound"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, shop, t]);

  const live = useMemo(
    () =>
      matchOpenLive(openLives, {
        ownerUserId: detail?.ownerUserId ?? shop?.ownerUserId,
      }),
    [openLives, detail?.ownerUserId, shop?.ownerUserId],
  );

  const shopUrl =
    typeof window !== "undefined" && shop
      ? `${window.location.origin}/shop/${shop.slug}`
      : shop
        ? `/shop/${shop.slug}`
        : "";

  const followers = detail?.followersCount ?? shop?.followersCount ?? 0;
  const productsCount = detail?.productsCount ?? products.length;
  const phone = detail?.contactPhone?.trim() || null;
  const mapsUrl =
    detail?.lat != null && detail?.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${detail.lat},${detail.lng}`
      : null;
  const visibleProducts = showAllProducts
    ? products
    : products.slice(0, PRODUCT_PREVIEW);
  const followed = Boolean(detail?.followedByMe ?? shop?.followedByMe);

  function openShopPage() {
    if (!shop) return;
    onOpenChange(false);
    router.push(`/shop/${shop.slug}#produits`);
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
    onOpenChange(false);
    router.push(`/messages/${data.conversation.id}`);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] gap-0 overflow-hidden rounded-t-3xl bg-surface p-0"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{shop?.name ?? t("shop.notFound")}</SheetTitle>
        </SheetHeader>

        {shop ? (
          <div className="flex max-h-[92vh] flex-col overflow-y-auto overscroll-contain px-5 pb-6 pt-2">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />

            <div className="flex flex-col items-center gap-3 text-center">
              {live ? (
                <Link
                  href={`/live/${live.id}`}
                  onClick={() => onOpenChange(false)}
                >
                  <ShopLiveAvatar
                    name={shop.name}
                    logoUrl={detail?.logoUrl ?? shop.logoUrl}
                    live
                    className="size-20 text-2xl ring-0"
                  />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={openShopPage}
                  className="cursor-pointer border-0 bg-transparent p-0"
                  aria-label={shop.name}
                >
                  <ShopLiveAvatar
                    name={shop.name}
                    logoUrl={detail?.logoUrl ?? shop.logoUrl}
                    live={false}
                    className="size-20 text-2xl ring-0"
                  />
                </button>
              )}

              <button
                type="button"
                onClick={openShopPage}
                className="cursor-pointer border-0 bg-transparent p-0"
              >
                <h2 className="font-heading text-xl font-extrabold">
                  {shop.name}
                </h2>
              </button>

              <p className="text-xs text-muted-foreground">
                @{shop.slug} · {compactCount(followers, locale)}{" "}
                {followers > 1
                  ? t("shopExtra.followerOther")
                  : t("shopExtra.followerOne")}
                {productsCount > 0
                  ? ` · ${compactCount(productsCount, locale)} ${
                      productsCount > 1
                        ? t("shop.productOther")
                        : t("shop.productOne")
                    }`
                  : ""}
              </p>

              {detail?.description ? (
                <p className="line-clamp-3 text-xs text-muted-foreground">
                  {detail.description}
                </p>
              ) : null}

              <ShopHoursNotice hours={detail} className="mt-0.5" />

              {(detail?.categories?.length ?? 0) > 0 ? (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {(detail?.categories ?? []).slice(0, 6).map((cat) => (
                    <span
                      key={cat.id}
                      className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold"
                    >
                      {cat.id} · {cat.count}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <FollowShopButton
                slug={shop.slug}
                followedByMe={followed}
                onChange={(next, count) => {
                  setDetail((prev) =>
                    prev
                      ? {
                          ...prev,
                          followedByMe: next,
                          followersCount:
                            typeof count === "number"
                              ? count
                              : Math.max(
                                  0,
                                  (prev.followersCount ?? 0) + (next ? 1 : -1),
                                ),
                        }
                      : prev,
                  );
                  onFollowChange?.(shop.id, next, count);
                }}
              />
              {phone ? (
                <a
                  href={`tel:${phone}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 text-xs font-semibold"
                >
                  <Phone className="size-3.5 text-trust" />
                  {phone}
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
                className="size-9"
                onClick={() => setShowAddress((v) => !v)}
                aria-label={t("shop.seeAddress")}
              >
                <MapPin className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9"
                onClick={() => {
                  void navigator.clipboard.writeText(shopUrl).then(
                    () => toast.success(t("shop.linkCopied")),
                    () => toast.error(t("common.copyImpossible")),
                  );
                }}
                aria-label={t("shop.copyLink")}
              >
                <Link2 className="size-4" />
              </Button>
              <ShareMenu
                title={shop.name}
                text={`${t("shop.discoverShop")} ${shop.name} ${t("product.onShipShop")}`}
                url={shopUrl}
                triggerClassName="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background"
              >
                <Share2 className="size-4" aria-hidden />
                <span className="sr-only">{t("shop.share")}</span>
              </ShareMenu>
              <Button
                type="button"
                size="icon"
                className="size-9"
                onClick={() => void messageSeller()}
                aria-label={t("shop.message")}
              >
                <MessageCircle className="size-4" />
              </Button>
            </div>

            {showAddress ? (
              <div className="mt-3 rounded-2xl border border-border bg-background p-3 text-sm">
                <p className="flex items-start gap-2 font-semibold">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  {detail?.addressHint?.trim() || t("shop.contactUnpublished")}
                </p>
                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-xs font-bold text-primary"
                  >
                    {t("shop.openInMaps")}
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-heading text-sm font-extrabold">
                  {t("shop.productOther")}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {compactCount(productsCount, locale)}
                </span>
              </div>

              {loading ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  …
                </p>
              ) : products.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("shop.emptyNone")}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {visibleProducts.map((product) => {
                      const cover = product.images?.[0];
                      return (
                        <Link
                          key={product.id}
                          href={`/product/${product.id}`}
                          onClick={() => onOpenChange(false)}
                          className="overflow-hidden rounded-2xl border border-border bg-background"
                        >
                          {cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={cover}
                              alt=""
                              className="aspect-square w-full object-cover bg-muted"
                            />
                          ) : (
                            <div className="aspect-square w-full bg-muted" />
                          )}
                          <div className="space-y-1 p-2">
                            <p className="line-clamp-2 text-[11px] font-semibold">
                              {product.title}
                            </p>
                            <p className="text-[11px] font-extrabold text-trust">
                              {formatMoney(
                                product.priceCents,
                                product.currency,
                              )}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  {products.length > PRODUCT_PREVIEW ? (
                    <button
                      type="button"
                      onClick={() => setShowAllProducts((v) => !v)}
                      className={cn(
                        "mt-3 w-full rounded-full border border-border py-2 text-xs font-bold",
                      )}
                    >
                      {showAllProducts
                        ? t("shop.seeLess")
                        : `${t("shop.seeMore")} (${products.length - PRODUCT_PREVIEW})`}
                    </button>
                  ) : null}
                </>
              )}
            </div>

            <Button
              type="button"
              className="mt-5 h-11 w-full rounded-full font-bold"
              onClick={openShopPage}
            >
              {t("shop.seeShop")}
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
