"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  Archive,
  Heart,
  MapPin,
  MessageCircle,
  Pencil,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { useAppConfig } from "@/lib/use-app-config";
import { composePhone, isValidContactPhone, splitPhone } from "@/lib/phone";
import { parseCurrency } from "@/lib/money";
import { CART_UPDATED_EVENT, notifyCartUpdated } from "@/lib/cart-events";
import { notifyWalletUpdated } from "@/lib/wallet-events";
import { formatMoney, cn } from "@/lib/utils";
import { CurrencyPicker } from "@/components/currency-picker";
import { colorHex } from "@/lib/product-options";
import { usePageBack } from "@/components/back-nav-context";
import { useI18n } from "@/components/i18n-provider";
import { PageLoader } from "@/components/page-loader";
import { ProductCommentsSheet } from "@/components/product-comments-sheet";
import { FeedSoundtrackPlayer } from "@/components/feed-soundtrack-player";
import { ProductImageCarousel } from "@/components/product-image-carousel";
import { ProductImageZoom } from "@/components/product-image-zoom";
import { DEFAULT_VIDEO_SOUND } from "@/components/video-sound-button";
import { ShopBrand } from "@/components/shop-brand";
import { ShopHoursNotice } from "@/components/shop-hours-notice";
import { useProductDwell } from "@/lib/use-product-dwell";
import type { ShopHoursFields } from "@/lib/shop-hours";
import { AuthInline } from "@/components/auth-inline";
import { FulfillmentForm } from "@/components/fulfillment-form";
import { InsufficientFundsSheet } from "@/components/insufficient-funds-sheet";
import { FoxDispatchOverlay } from "@/components/fox-dispatch-overlay";
import { MediaUploader } from "@/components/media-uploader";
import { ShareMenu } from "@/components/share-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Product = {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  currency?: string;
  quantity: number;
  soldCount?: number;
  category: string;
  images: string[];
  imageMotions?: string[];
  colors: string[];
  sizes: string[];
  location: string | null;
  status: string;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  canDelete?: boolean;
  canManage?: boolean;
  soundtrackStartMs?: number;
  soundtrack?: { id: string; audioUrl: string } | null;
  shop: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    ownerUserId?: string | null;
  } & ShopHoursFields;
};

function ProductInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useI18n();
  const appConfig = useAppConfig();
  const { data: session } = authClient.useSession();
  usePageBack({ fallbackHref: "/" });
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<"cart" | "buy" | null>(null);
  const [foxOpen, setFoxOpen] = useState(false);
  const afterPayHref = useRef("/profile");
  const [manageBusy, setManageBusy] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [needed, setNeeded] = useState(0);
  const [balance, setBalance] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [fulfillment, setFulfillment] = useState({
    fulfillmentType: "PICKUP" as "DELIVERY" | "PICKUP",
    deliveryCity: "Kinshasa",
    deliveryAddress: "",
    deliveryCommune: "",
    deliveryQuartier: "",
    deliveryAvenue: "",
    deliveryParcelle: "",
    deliveryLat: null as number | null,
    deliveryLng: null as number | null,
    contactPhone: "",
    shippingCents: 0,
    distanceKm: null as number | null,
  });
  const [profilePhone, setProfilePhone] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(
    searchParams.get("comments") === "1",
  );
  const [cartHasItems, setCartHasItems] = useState(false);
  const [inCart, setInCart] = useState(false);
  useProductDwell(product?.id ?? id, Boolean(session && product));

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ product?: Product; error?: string }>(`/api/products/${id}`, {
      cache: "no-store",
    })
      .then(({ res, data }) => {
        if (cancelled) return;
        if (!res.ok || !data?.product) {
          setProduct(null);
          return;
        }
        setProduct(data.product);
        setSelectedColor(data.product.colors[0] ?? null);
        setSelectedSize(data.product.sizes[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setProduct(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!session) {
      setCartHasItems(false);
      setInCart(false);
      return;
    }
    fetchJson<{ items?: { productId?: string }[]; count?: number }>("/api/cart")
      .then(({ data }) => {
        const items = data?.items ?? [];
        setCartHasItems((data?.count ?? items.length) > 0);
        setInCart(items.some((item) => item.productId === id));
      })
      .catch(() => undefined);
    const onCart = (event: Event) => {
      const count = (event as CustomEvent<{ count?: number }>).detail?.count;
      if (typeof count === "number") {
        setCartHasItems(count > 0);
        if (count === 0) setInCart(false);
      }
    };
    window.addEventListener(CART_UPDATED_EVENT, onCart);
    return () => window.removeEventListener(CART_UPDATED_EVENT, onCart);
  }, [session, id]);

  useEffect(() => {
    if (!session) return;
    fetchJson<{ user?: { phone?: string | null } }>("/api/profile")
      .then(({ data }) => {
        const phone = data?.user?.phone ?? "";
        setProfilePhone(phone);
        if (phone) {
          setFulfillment((f) => ({ ...f, contactPhone: f.contactPhone || phone }));
        }
      })
      .catch(() => undefined);
  }, [session]);

  async function toggleLike() {
    if (!product) return;
    if (!session) {
      router.push("/auth/login");
      return;
    }
    const wasLiked = product.likedByMe;
    const snapshot = product;
    setProduct({
      ...product,
      likedByMe: !wasLiked,
      likesCount: Math.max(0, product.likesCount + (wasLiked ? -1 : 1)),
    });

    const method = wasLiked ? "DELETE" : "POST";
    const { res, data } = await fetchJson<{
      liked?: boolean;
      likesCount?: number;
      notified?: boolean;
      messageRemoved?: boolean;
      error?: string;
    }>(`/api/products/${product.id}/like`, { method });

    if (!res.ok) {
      setProduct(snapshot);
      toast.error(data?.error ?? "Impossible d'aimer");
      return;
    }

    setProduct((prev) =>
      prev
        ? {
            ...prev,
            likedByMe: Boolean(data?.liked),
            likesCount: data?.likesCount ?? prev.likesCount,
          }
        : prev,
    );

    if (data?.liked && data.notified) {
      toast.success("Like envoyé au vendeur");
    } else if (data && !data.liked && data.messageRemoved) {
      toast.success("Like retiré — message vendeur annulé");
    }
  }

  const isOwner = Boolean(product?.canManage);

  async function setStatus(status: "ACTIVE" | "HIDDEN") {
    if (!product) return;
    setManageBusy(true);
    const { res, data } = await fetchJson<{
      product?: Product;
      error?: string;
    }>(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setManageBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? t("product.unavailable"));
      return;
    }
    toast.success(
      status === "HIDDEN" ? t("product.archived") : t("product.republished"),
    );
    if (data?.product) {
      setProduct((prev) =>
        prev ? { ...prev, ...data.product, shop: prev.shop } : prev,
      );
    } else {
      setProduct((prev) => (prev ? { ...prev, status } : prev));
    }
  }

  async function removeProduct() {
    if (!product) return;
    if (!product.canDelete) {
      toast.error(t("product.deleteBlocked"));
      return;
    }
    if (!confirm(t("product.deleteConfirm"))) return;
    setManageBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/products/${product.id}`,
      { method: "DELETE" },
    );
    setManageBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? t("product.unavailable"));
      return;
    }
    toast.success(t("product.deleted"));
    router.replace(`/shop/${product.shop.slug}`);
  }

  async function saveEdit() {
    if (!editing) return;
    if (editing.images.length === 0) {
      toast.error("Ajoutez au moins une image ou une vidéo");
      return;
    }
    setManageBusy(true);
    const { res, data } = await fetchJson<{
      product?: Product;
      error?: string;
    }>(`/api/products/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editing.title,
        description: editing.description,
        priceCents: editing.priceCents,
        currency: editing.currency,
        quantity: editing.quantity,
        category: editing.category,
        images: editing.images,
        location: editing.location,
        status: editing.status,
      }),
    });
    setManageBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? t("product.unavailable"));
      return;
    }
    toast.success(t("product.updated"));
    setEditing(null);
    const { data: fresh } = await fetchJson<{ product?: Product }>(
      `/api/products/${id}`,
      { cache: "no-store" },
    );
    setProduct((prev) => {
      if (!prev) return prev;
      const next = fresh?.product ?? data?.product;
      if (!next) return { ...editing, shop: prev.shop };
      return {
        ...prev,
        ...next,
        shop: {
          ...prev.shop,
          ...next.shop,
          ownerUserId: prev.shop.ownerUserId,
        },
        canDelete: next.canDelete ?? prev.canDelete,
        likesCount: next.likesCount ?? prev.likesCount,
        likedByMe: next.likedByMe ?? prev.likedByMe,
      };
    });
    router.refresh();
  }

  async function addToCart() {
    if (!session) {
      toast.error(t("buy.loginTitle"));
      return;
    }
    setLoading("cart");
    const { res, data: json } = await fetchJson<{
      error?: string;
      count?: number;
    }>("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: id }),
    });
    setLoading(null);
    if (!res.ok) {
      toast.error(json?.error ?? "Impossible d'ajouter au panier");
      return;
    }
    toast.success("Ajouté au panier");
    notifyCartUpdated(json?.count);
    router.push("/cart");
  }

  async function buyNow() {
    if (!session) {
      toast.error(t("buy.loginTitle"));
      return;
    }
    const contactPhone = (() => {
      const parts = splitPhone(fulfillment.contactPhone);
      return composePhone(parts.dial, parts.national);
    })();
    if (!isValidContactPhone(contactPhone)) {
      toast.error("Indiquez un téléphone de contact avec l’indicatif pays");
      return;
    }
    if (
      fulfillment.fulfillmentType === "DELIVERY" &&
      !fulfillment.deliveryCity.trim()
    ) {
      toast.error("Ville de livraison obligatoire");
      return;
    }
    setLoading("buy");
    const { res, data: json } = await fetchJson<{
      error?: string;
      needed?: number;
      balance?: number;
      order?: {
        id: string;
        handoverId?: string | null;
        handover?: { id: string } | null;
      };
    }>("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: id,
        fulfillmentType: fulfillment.fulfillmentType,
        deliveryCity: fulfillment.deliveryCity || null,
        deliveryAddress: fulfillment.deliveryAddress || null,
        deliveryCommune: fulfillment.deliveryCommune || null,
        deliveryQuartier: fulfillment.deliveryQuartier || null,
        deliveryAvenue: fulfillment.deliveryAvenue || null,
        deliveryParcelle: fulfillment.deliveryParcelle || null,
        deliveryLat: fulfillment.deliveryLat,
        deliveryLng: fulfillment.deliveryLng,
        contactPhone,
        optionColor: selectedColor,
        optionSize: selectedSize,
      }),
    });
    setLoading(null);

    if (res.status === 402) {
      toast.error(json?.error ?? t("product.insufficientTitle"));
      setNeeded(
        json?.needed ??
          (product?.priceCents ?? 0) + fulfillment.shippingCents,
      );
      setBalance(json?.balance ?? 0);
      setShowTopUp(true);
      return;
    }
    if (!res.ok) {
      toast.error(json?.error ?? "Achat impossible");
      return;
    }
    notifyWalletUpdated();
    const handoverId = json?.order?.handover?.id ?? json?.order?.handoverId;
    afterPayHref.current = handoverId
      ? `/orders/ticket/${handoverId}`
      : json?.order?.id
        ? `/orders/${json.order.id}`
        : "/profile";
    setFoxOpen(true);
  }

  if (!product) {
    return (
      <PageLoader />
    );
  }

  return (
    <div className="pb-8 pt-1">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 pb-1">
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-bold leading-none">
            {product.title}
          </p>
          <ShopBrand
            name={product.shop.name}
            slug={product.shop.slug}
            logoUrl={product.shop.logoUrl}
            className="mt-1"
            avatarClassName="size-5 ring-1 ring-border"
            nameClassName="text-[11px] font-semibold text-muted-foreground hover:text-primary"
          />
          <ShopHoursNotice hours={product.shop} className="mt-1" />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleLike}
            className={cn(
              "grid size-8 cursor-pointer place-items-center rounded-full border transition hover:scale-105 active:scale-95",
              product.likedByMe
                ? "border-destructive/40 bg-destructive/15"
                : "border-border bg-muted/40",
            )}
            aria-label={t("product.likeAria")}
          >
            <Heart
              className={cn(
                "size-3.5",
                product.likedByMe && "fill-destructive text-destructive",
              )}
            />
          </button>
          <ShareMenu
            title={product.title}
            productId={product.id}
            text={`${product.title} — ${formatMoney(product.priceCents, product.currency)} ${t("product.onShipShop")}`}
            url={`${typeof window !== "undefined" ? window.location.origin : ""}/product/${product.id}`}
            triggerClassName="grid size-8 place-items-center rounded-full border border-border bg-muted/40 transition hover:scale-105 hover:bg-muted active:scale-95"
          >
            <Share2 className="size-3.5" />
          </ShareMenu>
          <button
            type="button"
            onClick={() => setCommentsOpen(true)}
            className="grid size-8 cursor-pointer place-items-center rounded-full border border-border bg-muted/40 transition hover:scale-105 active:scale-95"
            aria-label={t("product.commentAria")}
          >
            <MessageCircle className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-2xl px-2 md:px-3">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_8px_32px_rgba(0,0,0,0.35)] ring-1 ring-white/5">
          <ProductImageCarousel
            key={product.images.join("|")}
            images={product.images}
            eager
            className="aspect-[4/5] w-full max-h-[min(78dvh,720px)]"
            intervalMs={2800}
            hasSoundtrack={Boolean(product.soundtrack?.audioUrl)}
            clipMs={product.soundtrack?.audioUrl ? appConfig.clipMs : undefined}
            motions={product.imageMotions}
            onDoubleLike={() => {
              if (!product.likedByMe) void toggleLike();
            }}
          />
          <ProductImageZoom
            images={product.images}
            alt={product.title}
            trigger="button"
            className="absolute top-3 right-3 z-20"
            hint={t("buy.zoomHint")}
            openLabel={t("buy.zoomOpen")}
            closeLabel={t("buy.zoomClose")}
            sold={product.soldCount ?? 0}
            remaining={product.quantity}
            taking={1}
          />
          {product.soundtrack?.audioUrl ? (
            <FeedSoundtrackPlayer
              audioUrl={product.soundtrack.audioUrl}
              startMs={product.soundtrackStartMs}
              sound={DEFAULT_VIDEO_SOUND}
              active
            />
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-2">
        <div className="mb-3 flex items-center gap-2 text-xs text-trust">
          <ShieldCheck className="size-4" />
          {t("product.payFromWallet")}
          {product.likesCount > 0 && (
            <span className="text-muted-foreground">
              · {product.likesCount} {t("product.likes")}
            </span>
          )}
          {(product.commentsCount ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => setCommentsOpen(true)}
              className="text-muted-foreground hover:underline"
            >
              · {product.commentsCount} {t("product.comments")}
            </button>
          )}
        </div>

        {isOwner && (
          <div className="mb-4 rounded-2xl border border-border bg-surface p-3">
            <p className="mb-2 text-[11px] font-semibold text-muted-foreground">
              {t("product.manageOwn")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                className="gap-1"
                disabled={manageBusy}
                onClick={() => setEditing({ ...product })}
              >
                <Pencil className="size-3" />
                {t("product.edit")}
              </Button>
              {product.status === "ACTIVE" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={manageBusy}
                  onClick={() => setStatus("HIDDEN")}
                >
                  <Archive className="size-3" />
                  {t("product.archive")}
                </Button>
              )}
              {(product.status === "HIDDEN" || product.status === "DRAFT") && (
                <Button
                  size="sm"
                  className="gap-1"
                  disabled={manageBusy}
                  onClick={() => setStatus("ACTIVE")}
                >
                  {t("product.republish")}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  "gap-1",
                  product.canDelete
                    ? "border-destructive/40 text-destructive"
                    : "opacity-50",
                )}
                disabled={manageBusy || !product.canDelete}
                onClick={removeProduct}
              >
                <Trash2 className="size-3" />
                {t("product.delete")}
              </Button>
            </div>
          </div>
        )}

        <h1 className="font-heading text-2xl font-bold">{product.title}</h1>
        <p className="mt-1 font-heading text-3xl font-extrabold text-trust">
          {formatMoney(product.priceCents, product.currency)}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span>
            {product.location} · {product.category} ·{" "}
            <ShopBrand
              name={product.shop.name}
              slug={product.shop.slug}
              logoUrl={product.shop.logoUrl}
              className="inline-flex"
              avatarClassName="size-5 ring-1 ring-border"
              nameClassName="text-sm font-semibold text-foreground hover:text-primary"
            />
          </span>
        </p>

        {product.colors.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              {t("product.color")}
              {selectedColor ? ` · ${selectedColor}` : ""}
            </p>
            <div className="h-scroll gap-2">
              {product.colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => setSelectedColor(c)}
                  className={cn(
                    "size-8 shrink-0 cursor-pointer rounded-full border-2 transition",
                    selectedColor === c
                      ? "border-primary scale-110"
                      : "border-white/20",
                  )}
                  style={{ backgroundColor: colorHex(c) }}
                />
              ))}
            </div>
          </div>
        )}

        {product.sizes.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              {t("product.size")}
            </p>
            <div className="h-scroll gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSize(s)}
                  className={cn(
                    "min-w-10 shrink-0 cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold whitespace-nowrap",
                    selectedSize === s
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-surface-2",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {product.description && (
          <p className="mt-4 text-sm leading-relaxed text-white/85">
            {product.description}
          </p>
        )}

        {product.status !== "ACTIVE" ? (
          <Button disabled className="mt-6 h-12 w-full">
            {product.status === "SOLD"
              ? t("product.sold")
              : t("product.unavailable")}
          </Button>
        ) : (
          <div className="mt-6 space-y-3">
            {!session ? (
              <AuthInline />
            ) : (
              <>
            <FulfillmentForm
              compact
              shopId={product.shop.id}
              productCents={product.priceCents}
              currency={product.currency}
              defaultPhone={profilePhone}
              value={fulfillment}
              onChange={setFulfillment}
            />
            <Button
              onClick={buyNow}
              disabled={loading !== null || cartHasItems}
              className="h-12 w-full cursor-pointer text-base font-bold"
            >
              {loading === "buy" ? t("product.processing") : t("buy.payPhone")}
            </Button>
            {cartHasItems ? (
              <p className="text-center text-[11px] text-muted-foreground">
                {t("buy.payUseCart")}
              </p>
            ) : null}
            <Button
              onClick={addToCart}
              disabled={loading !== null}
              variant="secondary"
              className="h-11 w-full cursor-pointer gap-2 text-sm font-semibold"
            >
              <ShoppingCart className="size-4" />
              {loading === "cart"
                ? t("product.adding")
                : inCart
                  ? `${t("product.addToCart")} +1`
                  : t("product.addToCart")}
            </Button>
              </>
            )}
            <Button
              onClick={() => setCommentsOpen(true)}
              variant="outline"
              className="h-11 w-full cursor-pointer gap-2 text-sm font-semibold"
            >
              <MessageCircle className="size-4" />
              {t("feed.commentsTitle")}
            </Button>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-3 font-heading text-lg font-bold">
              {t("product.editTitle")}
            </h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Titre</Label>
                <Input
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                  className="bg-surface-2"
                />
              </div>
              <div className="space-y-1">
                <Label>Monnaie</Label>
                <CurrencyPicker
                  value={parseCurrency(editing.currency)}
                  onChange={(next) =>
                    setEditing({ ...editing, currency: next })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Prix ({editing.currency ?? "USD"})</Label>
                  <Input
                    type="number"
                    value={(editing.priceCents / 100).toString()}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        priceCents: Math.round(
                          parseFloat(e.target.value || "0") * 100,
                        ),
                      })
                    }
                    className="bg-surface-2"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Stock</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editing.quantity}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        quantity: parseInt(e.target.value || "0", 10) || 0,
                      })
                    }
                    className="bg-surface-2"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Statut</Label>
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value })
                  }
                  className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm"
                >
                  <option value="DRAFT">Brouillon</option>
                  <option value="ACTIVE">Publié</option>
                  <option value="HIDDEN">Archivé</option>
                  <option value="SOLD">Épuisé</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  className="min-h-20 bg-surface-2"
                />
              </div>
              <div className="space-y-1">
                <Label>Médias</Label>
                <MediaUploader
                  urls={editing.images}
                  onChange={(images) => setEditing({ ...editing, images })}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setEditing(null)}
              >
                {t("product.cancel")}
              </Button>
              <Button
                className="flex-[2]"
                disabled={manageBusy}
                onClick={saveEdit}
              >
                {manageBusy ? "…" : t("product.save")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ProductCommentsSheet
        productId={product.id}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        onCountChange={(_id, count) =>
          setProduct((prev) =>
            prev ? { ...prev, commentsCount: count } : prev,
          )
        }
      />

      <InsufficientFundsSheet
        open={showTopUp}
        onOpenChange={setShowTopUp}
        neededCents={needed}
        balanceCents={balance}
        currency={product.currency}
        onFunded={() => {
          setShowTopUp(false);
          void buyNow();
        }}
      />
      <FoxDispatchOverlay
        open={foxOpen}
        onFinished={() => {
          setFoxOpen(false);
          router.push(afterPayHref.current);
        }}
      />
    </div>
  );
}

export default function ProductPage() {
  return (
    <Suspense fallback={<PageLoader className="h-[60dvh]" />}>
      <ProductInner />
    </Suspense>
  );
}
