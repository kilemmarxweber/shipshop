"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { composePhone, isValidContactPhone, splitPhone } from "@/lib/phone";
import { colorHex } from "@/lib/product-options";
import { formatMoney, cn } from "@/lib/utils";
import { notifyWalletUpdated } from "@/lib/wallet-events";
import { AuthInline } from "@/components/auth-inline";
import { FulfillmentForm, type FulfillmentState } from "@/components/fulfillment-form";
import { WalletInlineTopUp } from "@/components/wallet-inline-topup";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ProductImageZoom } from "@/components/product-image-zoom";
import { productHasVideo } from "@/components/video-sound-button";
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
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [fulfillment, setFulfillment] = useState(emptyFulfillment);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needFunds, setNeedFunds] = useState<{
    needed: number;
    balance: number;
  } | null>(null);

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
  }, [open, product]);

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
      order?: { id: string };
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
    toast.success(t("buy.buyOk"));
    notifyWalletUpdated();
    onOpenChange(false);
    router.push(data?.order?.id ? `/orders/${data.order.id}` : "/profile");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "gap-0 overflow-hidden border-border bg-background p-0 shadow-[0_0_80px_rgba(255,87,34,0.12)]",
          "data-[side=bottom]:inset-x-0 data-[side=bottom]:top-0 data-[side=bottom]:bottom-0",
          "data-[side=bottom]:mx-auto data-[side=bottom]:h-[100dvh] data-[side=bottom]:max-h-[100dvh]",
          "data-[side=bottom]:w-full data-[side=bottom]:max-w-[480px] data-[side=bottom]:rounded-none data-[side=bottom]:border-x",
          "md:data-[side=bottom]:inset-x-3 md:data-[side=bottom]:inset-y-4 md:data-[side=bottom]:h-[calc(100dvh-2rem)] md:data-[side=bottom]:max-h-[calc(100dvh-2rem)]",
          "md:data-[side=bottom]:max-w-[960px] md:data-[side=bottom]:rounded-[1.5rem] md:data-[side=bottom]:border",
          "lg:data-[side=bottom]:max-w-[1024px]",
        )}
      >
        <SheetHeader className="shrink-0 border-b border-border bg-background/92 px-4 py-3 pr-12 backdrop-blur-xl">
          <SheetTitle className="truncate font-heading text-base font-bold">
            {product ? product.title : t("buy.cta")}
          </SheetTitle>
          {product ? (
            <p className="font-heading text-sm font-bold text-trust">
              {formatMoney(product.priceCents, product.currency)}
            </p>
          ) : null}
        </SheetHeader>
        {product ? (
          <>
            <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden md:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] md:grid-rows-1">
              <div className="relative h-[min(42dvh,18rem)] shrink-0 overflow-hidden bg-black md:h-full md:border-r md:border-border">
                <ProductImageZoom
                  images={product.images}
                  alt={product.title}
                  className="absolute inset-0 size-full"
                  hint={t("buy.zoomHint")}
                  openLabel={t("buy.zoomOpen")}
                  closeLabel={t("buy.zoomClose")}
                />
                {productHasVideo(product.images) ? (
                  <span className="absolute top-3 left-3 rounded-full border border-white/25 bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                    {t("buy.realVideo")}
                  </span>
                ) : null}
              </div>

              <div className="min-h-0 overflow-y-auto overscroll-y-contain px-4 py-4">
                {!session ? (
                  <AuthInline />
                ) : (
                  <div className="space-y-4">
                    {product.colors.length > 0 ? (
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
                    {product.sizes.length > 0 ? (
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

                    <FulfillmentForm
                      compact
                      shopId={product.shop.id}
                      productCents={product.priceCents}
                      currency={product.currency}
                      value={fulfillment}
                      onChange={setFulfillment}
                    />

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
                  </div>
                )}
              </div>
            </div>
            {session && !needFunds ? (
              <SheetFooter className="shrink-0 border-t border-border bg-background/92 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => void pay()}
                  className="h-12 w-full text-base font-bold"
                >
                  {loading ? t("product.processing") : t("buy.payPhone")}
                </Button>
              </SheetFooter>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
