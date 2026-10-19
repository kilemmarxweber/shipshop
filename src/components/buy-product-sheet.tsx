"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { composePhone, isValidContactPhone, splitPhone } from "@/lib/phone";
import { colorHex } from "@/lib/product-options";
import { formatMoney, cn } from "@/lib/utils";
import { CART_UPDATED_EVENT, notifyCartUpdated } from "@/lib/cart-events";
import { notifyWalletUpdated } from "@/lib/wallet-events";
import { qrImageUrl } from "@/lib/handover";
import { AuthInline } from "@/components/auth-inline";
import { FulfillmentForm, type FulfillmentState } from "@/components/fulfillment-form";
import { WalletInlineTopUp } from "@/components/wallet-inline-topup";
import { FoxDispatchOverlay } from "@/components/fox-dispatch-overlay";
import { useI18n } from "@/components/i18n-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  inspectImageUrls,
  ProductImageZoom,
} from "@/components/product-image-zoom";
import { holdFeedAudio } from "@/lib/feed-audio-focus";

export type BuyProductTarget = {
  id: string;
  title: string;
  priceCents: number;
  currency?: string;
  images: string[];
  colors: string[];
  sizes: string[];
  shop: { id: string; name: string };
};

type Props = {
  product: BuyProductTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const emptyFulfillment = (): FulfillmentState => ({
  fulfillmentType: "PICKUP",
  deliveryCity: "Kinshasa",
  deliveryAddress: "",
  deliveryCommune: "",
  deliveryQuartier: "",
  deliveryAvenue: "",
  deliveryParcelle: "",
  deliveryLat: null,
  deliveryLng: null,
  contactPhone: "",
  shippingCents: 0,
  distanceKm: null,
});

export function BuyProductSheet({ product, open, onOpenChange }: Props) {
  const { t } = useI18n();
  const { data: session } = authClient.useSession();
  const [fulfillment, setFulfillment] = useState(emptyFulfillment);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needFunds, setNeedFunds] = useState<{
    needed: number;
    balance: number;
  } | null>(null);
  const [paid, setPaid] = useState<{
    orderId: string;
    qrPayload?: string;
    handoverId?: string;
  } | null>(null);
  const [cartBusy, setCartBusy] = useState(false);
  const [foxOpen, setFoxOpen] = useState(false);
  const paidAfterFox = useRef<{
    orderId: string;
    qrPayload?: string;
    handoverId?: string;
  } | null>(null);
  const [inCart, setInCart] = useState(false);
  const [cartHasItems, setCartHasItems] = useState(false);
  const [afterCart, setAfterCart] = useState(false);
  const [cartQty, setCartQty] = useState(1);

  useEffect(() => {
    holdFeedAudio(open);
    return () => holdFeedAudio(false);
  }, [open]);

  useEffect(() => {
    if (!open || !product) return;
    setFulfillment(emptyFulfillment());
    setColor(product.colors[0] ?? null);
    setSize(product.sizes[0] ?? null);
    setNeedFunds(null);
    setPaid(null);
    setAfterCart(false);
  }, [open, product]);

  useEffect(() => {
    if (!open || !session || !product) {
      setInCart(false);
      setCartHasItems(false);
      return;
    }
    function applyCart(items: { productId?: string }[], count?: number) {
      const list = items ?? [];
      setCartHasItems((count ?? list.length) > 0);
      setInCart(list.some((item) => item.productId === product.id));
    }
    fetchJson<{
      items?: { productId?: string }[];
      count?: number;
    }>("/api/cart")
      .then(({ data }) => applyCart(data?.items ?? [], data?.count))
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
  }, [open, session, product]);

  useEffect(() => {
    if (!open || !session) return;
    fetchJson<{ user?: { phone?: string | null } }>("/api/profile")
      .then(({ data }) => {
        const phone = data?.user?.phone ?? "";
        if (phone) {
          setFulfillment((f) => ({ ...f, contactPhone: f.contactPhone || phone }));
        }
      })
      .catch(() => undefined);
  }, [open, session]);

  async function pay() {
    if (!product) return;
    if (!session) return;
    if (product.colors.length && !color) {
      toast.error(t("product.color"));
      return;
    }
    if (product.sizes.length && !size) {
      toast.error(t("product.size"));
      return;
    }
    const contactPhone = (() => {
      const parts = splitPhone(fulfillment.contactPhone);
      return composePhone(parts.dial, parts.national);
    })();
    if (!isValidContactPhone(contactPhone)) {
      toast.error(t("buy.phoneRequired"));
      return;
    }
    if (
      fulfillment.fulfillmentType === "DELIVERY" &&
      fulfillment.deliveryLat == null
    ) {
      toast.error(t("buy.gpsRequired"));
      return;
    }
    setLoading(true);
    const { res, data } = await fetchJson<{
      error?: string;
      needed?: number;
      balance?: number;
      order?: {
        id: string;
        handoverId?: string | null;
        pickupReceipt?: { qrPayload?: string } | null;
        handover?: { id: string; qrPayload: string } | null;
      };
    }>("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
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
        optionColor: color,
        optionSize: size,
      }),
    });
    setLoading(false);
    if (res.status === 402) {
      toast.error(data?.error ?? t("product.insufficientTitle"));
      setNeedFunds({
        needed: data?.needed ?? product.priceCents + fulfillment.shippingCents,
        balance: data?.balance ?? 0,
      });
      return;
    }
    if (!res.ok) {
      toast.error(data?.error ?? t("buy.payFailed"));
      return;
    }
    notifyWalletUpdated();
    const order = data?.order;
    paidAfterFox.current = order?.id
      ? {
          orderId: order.id,
          qrPayload:
            order.handover?.qrPayload ?? order.pickupReceipt?.qrPayload,
          handoverId: order.handover?.id ?? order.handoverId ?? undefined,
        }
      : null;
    setFoxOpen(true);
  }

  async function addToCart() {
    if (!product || !session) return;
    setCartBusy(true);
    const { res, data } = await fetchJson<{
      error?: string;
      count?: number;
      items?: { productId?: string; quantity?: number }[];
    }>("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id }),
    });
    setCartBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? t("buy.payFailed"));
      return;
    }
    const qty =
      data?.items?.find((item) => item.productId === product.id)?.quantity ?? 1;
    notifyCartUpdated(data?.count);
    setInCart(true);
    setCartHasItems(true);
    setCartQty(qty);
    setAfterCart(true);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "app-sheet-width gap-0 overflow-hidden border-border bg-background p-0 shadow-[0_0_80px_rgba(255,87,34,0.12)]",
          "data-[side=bottom]:inset-x-0 data-[side=bottom]:top-auto data-[side=bottom]:bottom-0",
          "data-[side=bottom]:h-auto data-[side=bottom]:rounded-t-3xl data-[side=bottom]:border-t",
          needFunds
            ? "data-[side=bottom]:max-h-[min(68dvh,26rem)]"
            : "data-[side=bottom]:max-h-[min(82dvh,36rem)]",
        )}
      >
        {product ? (
          <>
            <div className="flex min-h-[18rem] flex-1">
              <div className="relative w-[44%] shrink-0 self-stretch overflow-hidden rounded-tl-[1.35rem] bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={inspectImageUrls(product.images)[0] ?? ""}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
                <ProductImageZoom
                  images={product.images}
                  alt={product.title}
                  trigger="button"
                  className="absolute right-2 bottom-2 z-10"
                  hint={t("buy.zoomHint")}
                  openLabel={t("buy.zoomOpen")}
                  closeLabel={t("buy.zoomClose")}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <SheetHeader className="shrink-0 space-y-0 px-3 py-3 pr-11 text-left">
                  <SheetTitle className="truncate font-heading text-sm font-bold leading-tight">
                    {product.title}
                  </SheetTitle>
                  <p className="font-heading text-sm font-bold text-trust">
                    {formatMoney(product.priceCents, product.currency)}
                  </p>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 pb-3">
                {paid ? (
                  <div className="space-y-3 text-center">
                    <p className="text-sm font-semibold text-trust">
                      {t("buy.buyOk")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t("buy.shopQr")} — {t("buy.qrUntilLast")}
                    </p>
                    {paid.qrPayload ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrImageUrl(paid.qrPayload, 180)}
                        alt=""
                        width={180}
                        height={180}
                        className="mx-auto rounded-2xl bg-white p-2"
                      />
                    ) : null}
                    <Link
                      href={
                        paid.handoverId
                          ? `/orders/ticket/${paid.handoverId}`
                          : `/orders/${paid.orderId}`
                      }
                      className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-bold text-white"
                    >
                      {t("buy.shopQr")}
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => onOpenChange(false)}
                    >
                      {t("buy.keepScrolling")}
                    </Button>
                  </div>
                ) : !session ? (
                  <AuthInline />
                ) : (
                  <div className="space-y-4">
                    {needFunds ? (
                      <WalletInlineTopUp
                        neededCents={needFunds.needed}
                        balanceCents={needFunds.balance}
                        currency={product.currency}
                        onFunded={() => {
                          setNeedFunds(null);
                          void pay();
                        }}
                      />
                    ) : null}
                    {!needFunds && product.colors.length > 0 ? (
                      <div>
                        <p className="mb-2 text-xs font-semibold">
                          {t("product.color")}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {product.colors.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setColor(c)}
                              className={cn(
                                "size-10 rounded-full border",
                                color === c
                                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                                  : "border-border",
                              )}
                              style={{ backgroundColor: colorHex(c) }}
                              aria-label={c}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {!needFunds && product.sizes.length > 0 ? (
                      <div>
                        <p className="mb-2 text-xs font-semibold">
                          {t("product.size")}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {product.sizes.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setSize(s)}
                              className={cn(
                                "min-h-11 min-w-11 rounded-xl border px-3 py-2 text-xs font-bold",
                                size === s
                                  ? "border-primary bg-primary text-white"
                                  : "border-border bg-surface-2",
                              )}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {!needFunds ? (
                      <FulfillmentForm
                        compact
                        shopId={product.shop.id}
                        productCents={product.priceCents}
                        currency={product.currency}
                        value={fulfillment}
                        onChange={setFulfillment}
                      />
                    ) : null}
                  </div>
                )}
                </div>
              </div>
            </div>
            {session && !needFunds && !paid ? (
              <SheetFooter className="flex shrink-0 flex-col gap-2 border-t border-border bg-background/92 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:flex-col">
                {afterCart ? (
                  <>
                    <p className="text-center text-sm font-semibold">
                      {cartQty > 1
                        ? `${t("buy.alreadyInCart")} · ×${cartQty}`
                        : t("buy.addedCart")}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-11 w-full font-semibold"
                      onClick={() => onOpenChange(false)}
                    >
                      {t("buy.keepScrolling")}
                    </Button>
                    <Link
                      href="/cart"
                      className={cn(
                        buttonVariants({ variant: "default" }),
                        "h-12 w-full text-base font-bold",
                      )}
                    >
                      {t("buy.goCart")}
                    </Link>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={cartBusy}
                      onClick={() => void addToCart()}
                      className="h-11 w-full font-semibold"
                    >
                      {cartBusy
                        ? t("product.adding")
                        : inCart
                          ? `${t("buy.addCart")} +1`
                          : t("buy.addCart")}
                    </Button>
                    <Button
                      type="button"
                      disabled={loading || cartHasItems}
                      onClick={() => void pay()}
                      className="h-12 w-full text-base font-bold"
                    >
                      {loading ? t("product.processing") : t("buy.payPhone")}
                    </Button>
                    {cartHasItems ? (
                      <>
                        <p className="text-center text-[11px] text-muted-foreground">
                          {t("buy.payUseCart")}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-10"
                            onClick={() => onOpenChange(false)}
                          >
                            {t("buy.keepScrolling")}
                          </Button>
                          <Link
                            href="/cart"
                            className={cn(
                              buttonVariants({ variant: "outline" }),
                              "h-10",
                            )}
                          >
                            {t("buy.goCart")}
                          </Link>
                        </div>
                      </>
                    ) : null}
                  </>
                )}
              </SheetFooter>
            ) : null}
          </>
        ) : null}
      </SheetContent>
      <FoxDispatchOverlay
        open={foxOpen}
        onFinished={() => {
          setFoxOpen(false);
          setPaid(paidAfterFox.current);
        }}
      />
    </Sheet>
  );
}
