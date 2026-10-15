"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Heart, MapPin, MessageCircle, Share2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney, cn } from "@/lib/utils";
import { PageLoader } from "@/components/page-loader";
import { ProductImageCarousel } from "@/components/product-image-carousel";
import { ShareMenu } from "@/components/share-menu";
import { colorHex } from "@/lib/product-options";

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

export default function FeedPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJson<{ products?: Product[] }>("/api/products?status=ACTIVE")
      .then(({ data }) => setProducts(data?.products ?? []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

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
      toast.error(data?.error ?? "Impossible d'aimer");
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
      toast.success("Like envoyé au vendeur");
    } else if (data && !data.liked && data.messageRemoved) {
      toast.success("Like retiré — message vendeur annulé");
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
      toast.error(data?.error ?? "Impossible d'ouvrir la conversation");
      return;
    }
    router.push(`/messages/${data.conversation.id}`);
  }

  if (loading) {
    return <PageLoader className="h-[70dvh]" />;
  }

  if (products.length === 0) {
    return (
      <div className="flex h-[70dvh] flex-col items-center justify-center px-6 text-center">
        <p className="font-heading text-lg font-bold">Aucune annonce encore</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Soyez le premier à publier sur Chip Shop
        </p>
        <Link
          href="/publish"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Publier
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-center gap-6 border-b border-white/5 px-4 py-2 text-sm font-semibold">
        <span className="text-muted-foreground">Abonnements</span>
        <span className="border-b-2 border-primary pb-1 text-white">Pour toi</span>
      </div>

      <div className="feed-snap h-[calc(100dvh-8.5rem)] overflow-y-auto md:grid md:h-auto md:grid-cols-2 md:gap-3 md:overflow-visible md:p-4">
        {products.map((p) => (
          <article
            key={p.id}
            className="feed-snap-item relative flex h-[calc(100dvh-8.5rem)] flex-col justify-end overflow-hidden md:h-[520px] md:rounded-2xl"
          >
            <ProductImageCarousel
              images={p.images}
              overlay
              className="absolute inset-0"
            />

            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
              <span className="rounded-full border border-trust/30 bg-trust/15 px-2.5 py-1 text-[10px] font-semibold text-trust backdrop-blur">
                <ShieldCheck className="mr-1 inline size-3" />
                Argent protégé
              </span>
              <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] font-semibold backdrop-blur">
                {p.category}
              </span>
            </div>

            <div className="absolute right-3 bottom-28 z-20 flex flex-col items-center gap-4 md:bottom-24">
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
                      "size-5",
                      p.likedByMe && "fill-destructive text-destructive",
                    )}
                  />
                </span>
                <span className="text-[10px] font-semibold">
                  {p.likesCount || "Like"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => messageSeller(p)}
                className="flex cursor-pointer flex-col items-center gap-1"
                aria-label="Message au vendeur"
              >
                <span className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 backdrop-blur transition hover:scale-105 active:scale-95">
                  <MessageCircle className="size-5" />
                </span>
                <span className="text-[10px] font-semibold">Msg</span>
              </button>
              <ShareMenu
                title={p.title}
                text={`${p.title} — ${formatMoney(p.priceCents)} sur Chip Shop`}
                url={`${typeof window !== "undefined" ? window.location.origin : ""}/product/${p.id}`}
                align="end"
                side="left"
                triggerClassName="flex cursor-pointer flex-col items-center gap-1 border-0 bg-transparent p-0"
              >
                <span className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 backdrop-blur transition hover:scale-105 active:scale-95">
                  <Share2 className="size-5" />
                </span>
                <span className="text-[10px] font-semibold">Share</span>
              </ShareMenu>
            </div>

            <div className="relative z-10 p-4 pr-16 pb-6">
              <div className="mb-2 flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-primary to-violet-500 text-xs font-bold">
                  {p.shop.name.slice(0, 1)}
                </div>
                <div>
                  <p className="text-sm font-bold">@{p.shop.name}</p>
                  <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="size-3" />
                    {p.location ?? "Kinshasa"}
                  </p>
                </div>
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
                <p className="mb-3 line-clamp-2 text-xs text-white/85">
                  {p.description}
                </p>
              )}
              <Link
                href={`/product/${p.id}`}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 p-2.5 backdrop-blur-xl transition hover:bg-white/12"
              >
                <div
                  className="size-12 shrink-0 rounded-xl bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${p.images[0]})`,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{p.title}</p>
                  <p className="font-heading text-sm font-bold text-trust">
                    {formatMoney(p.priceCents)}
                  </p>
                </div>
                <span className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold">
                  Voir
                </span>
              </Link>
            </div>
          </article>
        ))}
      </div>

    </div>
  );
}
