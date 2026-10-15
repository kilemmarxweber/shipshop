"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  Heart,
  MapPin,
  MessageCircle,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney, cn } from "@/lib/utils";
import { colorHex } from "@/lib/product-options";
import { PageLoader } from "@/components/page-loader";
import { ProductImageCarousel } from "@/components/product-image-carousel";
import { FulfillmentForm } from "@/components/fulfillment-form";
import { ShareMenu } from "@/components/share-menu";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
  status: string;
  likesCount: number;
  likedByMe: boolean;
  shop: { id: string; name: string; slug: string };
};

function ProductInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<"cart" | "buy" | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ product?: Product; error?: string }>(`/api/products/${id}`)
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

  async function messageSeller() {
    if (!product) return;
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
      toast.error(data?.error ?? "Impossible d'ouvrir la conversation");
      return;
    }
    router.push(`/messages/${data.conversation.id}`);
  }

  async function addToCart() {
    if (!session) {
      router.push("/auth/login");
      return;
    }
    setLoading("cart");
    const { res, data: json } = await fetchJson<{ error?: string }>("/api/cart", {
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
    router.push("/cart");
  }

  async function buyNow() {
    if (!session) {
      router.push("/auth/login");
      return;
    }
    if (!fulfillment.contactPhone.trim()) {
      toast.error("Indiquez un numéro de contact");
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
      order?: { id: string };
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
        contactPhone: fulfillment.contactPhone,
      }),
    });
    setLoading(null);

    if (res.status === 402) {
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
    toast.success("Achat réussi — solde débité");
    router.push(json?.order?.id ? `/orders/${json.order.id}` : "/profile");
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
          <p className="mt-0.5 truncate text-[11px] leading-none text-muted-foreground">
            @{product.shop.name}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleLike}
            className={cn(
              "grid size-8 cursor-pointer place-items-center rounded-full border transition hover:scale-105 active:scale-95",
              product.likedByMe
                ? "border-destructive/40 bg-destructive/15"
                : "border-white/10 bg-white/5",
            )}
            aria-label="Aimer"
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
            text={`${product.title} — ${formatMoney(product.priceCents)} sur Chip Shop`}
            url={`${typeof window !== "undefined" ? window.location.origin : ""}/product/${product.id}`}
            triggerClassName="grid size-8 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:scale-105 hover:bg-white/10 active:scale-95"
          >
            <Share2 className="size-3.5" />
          </ShareMenu>
          <button
            type="button"
            onClick={messageSeller}
            className="grid size-8 cursor-pointer place-items-center rounded-full border border-white/10 bg-white/5 transition hover:scale-105 active:scale-95"
            aria-label="Message vendeur"
          >
            <MessageCircle className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-2xl px-2 md:px-3">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#13131a] shadow-[0_8px_32px_rgba(0,0,0,0.35)] ring-1 ring-white/5">
          <ProductImageCarousel
            images={product.images}
            fit="cover"
            className="aspect-[4/3.6] w-full"
            intervalMs={2800}
          />
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-2">
        <div className="mb-3 flex items-center gap-2 text-xs text-trust">
          <ShieldCheck className="size-4" />
          Paiement depuis solde prépayé
          {product.likesCount > 0 && (
            <span className="text-muted-foreground">
              · {product.likesCount} j’aime
            </span>
          )}
        </div>

        <h1 className="font-heading text-2xl font-bold">{product.title}</h1>
        <p className="mt-1 font-heading text-3xl font-extrabold text-trust">
          {formatMoney(product.priceCents)}
        </p>
        <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5" />
          {product.location} · {product.category} · @{product.shop.name}
        </p>

        {product.colors.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              Couleur{selectedColor ? ` · ${selectedColor}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => setSelectedColor(c)}
                  className={cn(
                    "size-8 cursor-pointer rounded-full border-2 transition",
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
              Taille
            </p>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSize(s)}
                  className={cn(
                    "min-w-10 cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold",
                    selectedSize === s
                      ? "border-primary bg-primary text-white"
                      : "border-white/10 bg-[#1c1c26]",
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
            {product.status === "SOLD" ? "Déjà vendu" : "Indisponible"}
          </Button>
        ) : (
          <div className="mt-6 space-y-3">
            <FulfillmentForm
              shopId={product.shop.id}
              productCents={product.priceCents}
              defaultPhone={profilePhone}
              value={fulfillment}
              onChange={setFulfillment}
            />
            <Button
              onClick={addToCart}
              disabled={loading !== null}
              className="h-12 w-full cursor-pointer gap-2 bg-gradient-to-r from-[#ff5722] to-[#ff7a45] text-base font-bold"
            >
              <ShoppingCart className="size-4" />
              {loading === "cart" ? "Ajout…" : "Ajouter au panier"}
            </Button>
            <Button
              onClick={buyNow}
              disabled={loading !== null}
              variant="secondary"
              className="h-11 w-full cursor-pointer text-sm font-semibold"
            >
              {loading === "buy" ? "Traitement…" : "Payer maintenant"}
            </Button>
            <Button
              onClick={messageSeller}
              variant="outline"
              className="h-11 w-full cursor-pointer gap-2 text-sm font-semibold"
            >
              <MessageCircle className="size-4" />
              Contacter le vendeur
            </Button>
          </div>
        )}
      </div>

      <Sheet open={showTopUp} onOpenChange={setShowTopUp}>
        <SheetContent side="bottom" className="rounded-t-3xl bg-[#13131a]">
          <SheetHeader>
            <SheetTitle className="font-heading">Solde insuffisant</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 p-4">
            <p className="text-sm text-muted-foreground">
              Solde actuel : {formatMoney(balance)}. Il vous faut{" "}
              {formatMoney(needed)} pour cet achat.
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

export default function ProductPage() {
  return (
    <Suspense fallback={<PageLoader className="h-[60dvh]" />}>
      <ProductInner />
    </Suspense>
  );
}
