"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShoppingCart, Trash2, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { composePhone, isValidContactPhone, splitPhone } from "@/lib/phone";
import { formatMoney } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { FulfillmentForm } from "@/components/fulfillment-form";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type CartItem = {
  id: string;
  productId: string;
  product: {
    id: string;
    title: string;
    priceCents: number;
    images: string[];
    status: string;
    shop: { id: string; name: string; slug: string };
  };
};

type CartPayload = {
  items?: CartItem[];
  totalCents?: number;
  count?: number;
  error?: string;
  needed?: number;
  balance?: number;
};

export default function CartPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: session } = authClient.useSession();
  const [items, setItems] = useState<CartItem[]>([]);
  const [totalCents, setTotalCents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [needed, setNeeded] = useState(0);
  const [balance, setBalance] = useState(0);
  const [profilePhone, setProfilePhone] = useState("");
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

  async function loadCart() {
    const { res, data } = await fetchJson<CartPayload>("/api/cart");
    if (!res.ok) {
      setItems([]);
      setTotalCents(0);
      return;
    }
    setItems(data?.items ?? []);
    setTotalCents(data?.totalCents ?? 0);
  }

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadCart()
      .catch(() => {
        setItems([]);
        setTotalCents(0);
      })
      .finally(() => setLoading(false));
    fetchJson<{ user?: { phone?: string | null } }>("/api/profile")
      .then(({ data }) => {
        const phone = data?.user?.phone ?? "";
        setProfilePhone(phone);
        if (phone) {
          setFulfillment((f) => ({
            ...f,
            contactPhone: f.contactPhone || phone,
          }));
        }
      })
      .catch(() => undefined);
  }, [session]);

  async function removeItem(productId: string) {
    setBusy(true);
    const { res, data } = await fetchJson<CartPayload>(
      `/api/cart?productId=${encodeURIComponent(productId)}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Suppression impossible");
      return;
    }
    setItems(data?.items ?? []);
    setTotalCents(data?.totalCents ?? 0);
    toast.success("Retiré du panier");
  }

  async function cancelCart() {
    setBusy(true);
    const { res, data } = await fetchJson<CartPayload>("/api/cart?all=1", {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Annulation impossible");
      return;
    }
    setItems([]);
    setTotalCents(0);
    toast.success("Panier annulé");
  }

  async function confirmPurchase() {
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
    setBusy(true);
    const { res, data } = await fetchJson<
      CartPayload & { orders?: { id: string }[] }
    >("/api/cart/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    });
    setBusy(false);

    if (res.status === 402) {
      setNeeded(data?.needed ?? totalCents + fulfillment.shippingCents);
      setBalance(data?.balance ?? 0);
      setShowTopUp(true);
      return;
    }
    if (!res.ok) {
      toast.error(data?.error ?? "Paiement impossible");
      await loadCart();
      return;
    }
    toast.success("Achat confirmé — solde débité");
    const first = data?.orders?.[0]?.id;
    router.push(first ? `/orders/${first}` : "/profile");
  }

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <ShoppingCart className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="font-heading text-lg font-bold">{t("cart.title")}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("cart.guestHint")}
        </p>
        <Link
          href="/auth/login"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {t("auth.login")}
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <PageLoader className="h-[40dvh]" />
    );
  }

  return (
    <div className="px-4 pb-6 pt-3 md:px-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold">{t("cart.title")}</h1>
          <p className="text-xs text-muted-foreground">
            {items.length}{" "}
            {items.length > 1 ? t("cart.itemOther") : t("cart.itemOne")}
          </p>
        </div>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={cancelCart}
            className="gap-1.5 text-muted-foreground"
          >
            <X className="size-4" />
            {t("common.cancel")}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">{t("cart.empty")}</p>
          <Link
            href="/discover"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t("nav.discover")}
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
              >
                <Link
                  href={`/product/${item.product.id}`}
                  className="size-14 shrink-0 rounded-xl bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${item.product.images[0]})`,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {item.product.title}
                  </p>
                  <Link
                    href={`/shop/${item.product.shop.slug}`}
                    className="text-[11px] text-muted-foreground hover:text-primary hover:underline"
                  >
                    @{item.product.shop.name}
                  </Link>
                  <p className="font-heading text-sm font-bold text-trust">
                    {formatMoney(item.product.priceCents)}
                  </p>
                  {item.product.status !== "ACTIVE" && (
                    <p className="text-[11px] text-destructive">
                      {t("cart.unavailable")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeItem(item.productId)}
                  className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground hover:text-destructive"
                  aria-label={t("cart.removeAria")}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-3">
            <FulfillmentForm
              shopId={items[0]?.product.shop.id ?? ""}
              productCents={totalCents}
              defaultPhone={profilePhone}
              value={fulfillment}
              onChange={setFulfillment}
            />
            <div className="rounded-2xl border border-border bg-surface p-4">
            <Button
              disabled={busy}
              onClick={confirmPurchase}
              className="h-12 w-full bg-gradient-to-r from-[#ff5722] to-[#ff7a45] text-base font-bold"
            >
              {busy ? t("product.processing") : t("cart.confirmPurchase")}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={cancelCart}
              className="mt-2 w-full text-muted-foreground"
            >
              {t("cart.cancelCart")}
            </Button>
          </div>
          </div>
        </>
      )}

      <Sheet open={showTopUp} onOpenChange={setShowTopUp}>
        <SheetContent side="bottom" className="rounded-t-3xl bg-surface">
          <SheetHeader>
            <SheetTitle className="font-heading">Solde insuffisant</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 p-4">
            <p className="text-sm text-muted-foreground">
              Solde actuel : {formatMoney(balance)}. Il vous faut{" "}
              {formatMoney(needed)} pour confirmer.
            </p>
            <Link
              href="/wallet"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground"
            >
              <Wallet className="size-4" />
              Recharger mon compte
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
