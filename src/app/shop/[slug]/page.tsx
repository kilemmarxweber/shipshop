"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  Heart,
  Link2,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Share2,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { CATEGORIES } from "@/lib/categories";
import { fetchJson } from "@/lib/fetch-json";
import { colorHex } from "@/lib/product-options";
import { formatMoney, cn } from "@/lib/utils";
import { FollowShopButton } from "@/components/follow-shop-button";
import { PageLoader } from "@/components/page-loader";
import { ProductImageCarousel } from "@/components/product-image-carousel";
import { ShareMenu } from "@/components/share-menu";
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
  category: string;
  images: string[];
  colors: string[];
  sizes: string[];
  location: string | null;
  likesCount: number;
  likedByMe: boolean;
  shop: { id: string; name: string; slug: string };
};

function ShopInner() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [showAddress, setShowAddress] = useState(false);

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
    const t = setTimeout(() => {
      fetchJson<{ products?: Product[] }>(`/api/products?${params}`)
        .then(({ data }) => setProducts(data?.products ?? []))
        .catch(() => setProducts([]));
    }, 200);
    return () => clearTimeout(t);
  }, [shop?.id, q, category]);

  const categoryChips = useMemo(() => {
    if (!shop) return [];
    const known = new Set(CATEGORIES.map((c) => c.id));
    return shop.categories.map((c) => ({
      id: c.id,
      count: c.count,
      label: CATEGORIES.find((x) => x.id === c.id)?.label ?? c.id,
      gradient:
        CATEGORIES.find((x) => x.id === c.id)?.gradient ??
        "from-slate-500 to-slate-700",
      known: known.has(c.id),
    }));
  }, [shop]);

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
      toast.error("Impossible d'aimer");
    }
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
        message: `Bonjour, je suis intéressé par ${shop.name}.`,
      }),
    });
    if (!res.ok || !data?.conversation) {
      toast.error(data?.error ?? "Message impossible");
      return;
    }
    router.push(`/messages/${data.conversation.id}`);
  }

  function copyShopLink() {
    void navigator.clipboard.writeText(shopUrl).then(
      () => toast.success("Lien boutique copié"),
      () => toast.error("Copie impossible"),
    );
  }

  if (loading) return <PageLoader />;

  if (!shop) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="font-heading text-lg font-bold">Boutique introuvable</p>
        <Link href="/" className="mt-4 inline-block text-sm text-primary">
          Retour au feed
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
          <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary to-violet-600 text-xl font-bold text-white">
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
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-lg font-bold">
              {shop.name}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              @{shop.slug} · réf. {refCode} · {shop.productsCount} produit
              {shop.productsCount > 1 ? "s" : ""}
              {typeof shop.followersCount === "number"
                ? ` · ${shop.followersCount} abonné${shop.followersCount > 1 ? "s" : ""}`
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
            isOwnShop={shop.owner?.id === session?.user?.id}
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
              Contact non publié
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0 cursor-pointer"
            onClick={() => setShowAddress((v) => !v)}
            aria-label="Voir l'adresse"
            title="Voir l'adresse"
          >
            <MapPin className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0 cursor-pointer"
            onClick={copyShopLink}
            aria-label="Copier le lien"
            title="Copier le lien"
          >
            <Link2 className="size-4" />
          </Button>
          <ShareMenu
            title={shop.name}
            text={`Découvrez ${shop.name} sur Chip Shop`}
            url={shopUrl}
            triggerClassName="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-background"
          >
            <Share2 className="size-4" aria-hidden />
            <span className="sr-only">Partager</span>
          </ShareMenu>
          <Button
            type="button"
            size="icon"
            className="size-9 shrink-0 cursor-pointer"
            onClick={messageSeller}
            aria-label="Message"
            title="Message"
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
              Coordonnées · {shop.lat.toFixed(5)}, {shop.lng.toFixed(5)}
            </p>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-xs font-bold text-primary"
            >
              Ouvrir dans Maps →
            </a>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-surface-2 px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un produit…"
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
              Tout ({shop.productsCount})
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
          <p className="font-heading font-bold">Aucun produit</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {q || category
              ? "Aucun résultat pour ce filtre"
              : "Cette boutique n'a pas encore d'annonces actives"}
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
              />

              <div className="absolute top-3 left-3 z-10 flex max-w-[70%] flex-col gap-1.5 sm:top-4 sm:left-4 sm:gap-2">
                <span className="w-fit rounded-full border border-white/25 bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                  {p.category}
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
                    {p.likesCount || "Like"}
                  </span>
                </button>
                <ShareMenu
                  title={p.title}
                  productId={p.id}
                  text={`${p.title} — ${formatMoney(p.priceCents)}`}
                  url={`${typeof window !== "undefined" ? window.location.origin : ""}/product/${p.id}`}
                  align="end"
                  side="left"
                  triggerClassName="flex cursor-pointer flex-col items-center gap-1 border-0 bg-transparent p-0 text-white"
                >
                  <span className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 backdrop-blur transition hover:scale-105 active:scale-95">
                    <Share2 className="size-5" />
                  </span>
                  <span className="text-[10px] font-semibold drop-shadow">
                    Share
                  </span>
                </ShareMenu>
              </div>

              <div className="relative z-10 mt-auto px-3 pb-5 pt-3 pr-14 text-white sm:px-4 sm:pb-6 sm:pr-16">
                {p.location && (
                  <p className="mb-2 flex items-center gap-1 text-[10px] text-white/70">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{p.location}</span>
                  </p>
                )}
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
                    className="size-11 shrink-0 rounded-xl bg-cover bg-center ring-1 ring-white/10 sm:size-12"
                    style={{ backgroundImage: `url(${p.images[0]})` }}
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
                    Voir
                  </span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
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
