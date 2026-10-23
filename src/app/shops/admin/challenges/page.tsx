"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { CATEGORIES } from "@/lib/categories";
import { cn, formatMoney } from "@/lib/utils";
import { refreshGrowthSurface } from "@/lib/growth/use-growth-surface";
import {
  parseChallengeTeaser,
  type ChallengeProductFocus,
  type ChallengeTeaser,
} from "@/lib/growth/challenge-product";
import type { ChallengeQualityReport } from "@/lib/growth/challenge-report";
import {
  parseChallengeSpotlight,
  type ChallengeSpotlight,
} from "@/lib/growth/challenge-spotlight";
import { uploadCompressedMedia } from "@/lib/compress-media";
import {
  categoryLook,
  isProbablyVideo,
} from "@/lib/growth/challenge-look";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/page-loader";
import { usePageBack } from "@/components/back-nav-context";

type LinkedProduct = {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  priceCents: number;
  currency: string;
  category: string;
  shop: { name: string };
};

type ChallengeRow = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  city: string | null;
  startsAt: string;
  endsAt: string;
  completions: number;
  productFocus?: ChallengeProductFocus | string | null;
  productId?: string | null;
  productTeaser?: unknown;
  spotlight?: unknown;
  product?: LinkedProduct | null;
};

type CatalogItem = {
  title: string;
  body: string;
  category: string;
};

type ProductHit = {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  priceCents: number;
  currency: string;
  category: string;
  status: string;
  shop: { name: string };
};

const FOCUS_OPTIONS: {
  id: ChallengeProductFocus;
  label: string;
  hint: string;
  icon: typeof Target;
}[] = [
  {
    id: "none",
    label: "Mission libre",
    hint: "Engagement catégorie / ville — sans produit",
    icon: Target,
  },
  {
    id: "catalog",
    label: "Produit boutique",
    hint: "Lien vers une fiche publiée (achat)",
    icon: ShoppingBag,
  },
  {
    id: "teaser",
    label: "Hors catalogue",
    hint: "Produit pas encore enregistré — aperçu",
    icon: Package,
  },
];

function ChallengeLivePreview({
  title,
  body,
  category,
  city,
  hours,
  focus,
  product,
  teaser,
  spotlight,
}: {
  title: string;
  body: string;
  category: string;
  city: string;
  hours: number;
  focus: ChallengeProductFocus;
  product: ProductHit | null;
  teaser: ChallengeTeaser;
  spotlight: ChallengeSpotlight | null;
}) {
  const look = categoryLook(category);
  const headline = title.trim() || "Titre du challenge";
  const copy =
    body.trim() ||
    "La consigne s’affiche ici — like, commente, partage.";
  const cover =
    spotlight?.url ||
    product?.images[0] ||
    teaser.image ||
    null;
  const productLabel =
    focus === "catalog" && product
      ? product.title
      : focus === "teaser" && teaser.title.trim()
        ? `Aperçu · ${teaser.title.trim()}`
        : null;

  return (
    <div className="w-full max-w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-[#121218] shadow-xl shadow-black/40">
      <div className="relative aspect-[4/5] overflow-hidden">
        {cover ? (
          spotlight?.kind === "video" ? (
            <video
              src={cover}
              poster={spotlight.posterUrl ?? undefined}
              className="absolute inset-0 size-full object-cover"
              muted
              playsInline
              autoPlay
              loop
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          )
        ) : (
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-br",
              look.wash,
            )}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2.5">
          <span className="rounded-full bg-black/45 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/85 backdrop-blur-sm">
            Challenge
          </span>
          <span className="rounded-full bg-black/45 px-2 py-0.5 text-[9px] font-semibold tabular-nums text-white/70 backdrop-blur-sm">
            {hours}h · {city || "Kinshasa"}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 space-y-2 p-3 pt-10">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
            {category}
          </p>
          <p className="line-clamp-2 text-[15px] font-bold leading-snug text-balance text-white">
            {headline}
          </p>
          <p className="line-clamp-2 text-[11px] leading-snug text-pretty text-white/70">
            {copy}
          </p>
          {productLabel ? (
            <span
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                focus === "teaser"
                  ? "bg-amber-400/15 text-amber-100 ring-amber-300/25"
                  : "bg-white/10 text-[#7dffb3] ring-white/15",
              )}
            >
              <ShoppingBag className="size-3 shrink-0" />
              <span className="truncate">{productLabel}</span>
            </span>
          ) : null}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="inline-flex h-8 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-[#ff4f8b] via-[#ff7d86] to-[#ffb48c] text-[11px] font-semibold text-white">
              Je participe
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function focusOf(row: ChallengeRow): ChallengeProductFocus {
  if (row.productFocus === "catalog" || row.productFocus === "teaser") {
    return row.productFocus;
  }
  if (row.productId || row.product) return "catalog";
  if (parseChallengeTeaser(row.productTeaser)) return "teaser";
  return "none";
}

export default function ChallengesAdminPage() {
  const { data: session, isPending } = authClient.useSession();
  usePageBack({ fallbackHref: "/shops" });
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [active, setActive] = useState<ChallengeRow[]>([]);
  const [recent, setRecent] = useState<ChallengeRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("Mode");
  const [city, setCity] = useState("Kinshasa");
  const [hours, setHours] = useState(24);
  const [focus, setFocus] = useState<ChallengeProductFocus>("none");
  const [product, setProduct] = useState<ProductHit | null>(null);
  const [teaser, setTeaser] = useState<ChallengeTeaser>({
    title: "",
    image: null,
    priceCents: null,
    currency: "USD",
    shopName: "",
    note: "",
  });
  const [spotlight, setSpotlight] = useState<ChallengeSpotlight | null>(null);
  const [productQ, setProductQ] = useState("");
  const [productHits, setProductHits] = useState<ProductHit[]>([]);
  const [productOpen, setProductOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ChallengeQualityReport | null>(null);
  const [reportBusy, setReportBusy] = useState(false);

  async function syncSurface() {
    await refreshGrowthSurface();
  }

  async function openReport(id: string) {
    setReportBusy(true);
    setReport(null);
    const { res, data } = await fetchJson<{
      report?: ChallengeQualityReport;
      error?: string;
    }>(`/api/admin/challenges/${id}/report`);
    setReportBusy(false);
    if (!res.ok || !data?.report) {
      toast.error(data?.error ?? "Rapport impossible");
      return;
    }
    setReport(data.report);
  }

  async function copyReportContacts() {
    if (!report) return;
    const text = [
      `Rapport challenge — ${report.challenge.title}`,
      report.challenge.productLabel
        ? `Produit : ${report.challenge.productLabel}`
        : null,
      report.quality.summary,
      "",
      "Réf\tNom\tTéléphone\tEmail\tDate",
      ...report.participants.map(
        (p) =>
          `${p.reference}\t${p.name}\t${p.phone ?? "—"}\t${p.email ?? "—"}\t${new Date(p.joinedAt).toLocaleString()}`,
      ),
    ]
      .filter((line) => line !== null)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Rapport copié — à partager au demandeur");
    } catch {
      toast.error("Copie impossible");
    }
  }

  async function load() {
    const { res, data } = await fetchJson<{
      active?: ChallengeRow[];
      recent?: ChallengeRow[];
      catalog?: CatalogItem[];
      error?: string;
    }>("/api/admin/challenges");
    if (res.status === 403) {
      setAllowed(false);
      return;
    }
    if (!res.ok) {
      setAllowed(true);
      toast.error(data?.error ?? "Impossible de charger les challenges");
      return;
    }
    setAllowed(true);
    setActive(data?.active ?? []);
    setRecent(data?.recent ?? []);
    setCatalog(data?.catalog ?? []);
  }

  useEffect(() => {
    if (session) void load();
  }, [session?.user?.id]);

  useEffect(() => {
    if (!productOpen || focus !== "catalog") return;
    const t = window.setTimeout(() => {
      void (async () => {
        const params = new URLSearchParams({ status: "ACTIVE" });
        if (productQ.trim()) params.set("q", productQ.trim());
        const { data } = await fetchJson<{ products?: ProductHit[] }>(
          `/api/admin/products?${params}`,
        );
        setProductHits((data?.products ?? []).slice(0, 12));
      })();
    }, 200);
    return () => window.clearTimeout(t);
  }, [productOpen, productQ, focus]);

  if (isPending || (session && allowed === null)) return <PageLoader />;
  if (!session || allowed === false) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        Réservé à l’owner ShipShop.
      </p>
    );
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setCategory("Mode");
    setCity("Kinshasa");
    setHours(24);
    setFocus("none");
    setProduct(null);
    setTeaser({
      title: "",
      image: null,
      priceCents: null,
      currency: "USD",
      shopName: "",
      note: "",
    });
    setSpotlight(null);
    setProductQ("");
    setProductOpen(false);
  }

  function fillFromCatalog(item: CatalogItem) {
    setTitle(item.title);
    setBody(item.body);
    setCategory(item.category);
    setFocus("none");
    setProduct(null);
  }

  function pickProduct(p: ProductHit) {
    setProduct(p);
    setCategory(p.category || category);
    if (!title.trim()) setTitle(`Challenge · ${p.title}`.slice(0, 120));
    if (!body.trim()) {
      const desc = (p.description ?? "").trim();
      setBody(
        desc
          ? `Découvre « ${p.title} » — ${desc.slice(0, 220)}`.slice(0, 400)
          : `Découvre « ${p.title} », like et commente ton avis.`,
      );
    }
    setProductOpen(false);
    setProductQ("");
  }

  function applyFocus(next: ChallengeProductFocus) {
    setFocus(next);
    if (next !== "catalog") {
      setProduct(null);
      setProductOpen(false);
    }
    if (next !== "teaser") {
      /* keep teaser draft in state but unused */
    }
  }

  function startEdit(row: ChallengeRow) {
    setEditingId(row.id);
    setTitle(row.title);
    setBody(row.body);
    setCategory(row.category || "Mode");
    setCity(row.city || "Kinshasa");
    setHours(24);
    const f = focusOf(row);
    setFocus(f);
    if (f === "catalog" && row.product) {
      setProduct({
        id: row.product.id,
        title: row.product.title,
        description: row.product.description,
        images: row.product.images,
        priceCents: row.product.priceCents,
        currency: row.product.currency,
        category: row.product.category,
        status: "ACTIVE",
        shop: row.product.shop,
      });
    } else {
      setProduct(null);
    }
    const t = parseChallengeTeaser(row.productTeaser);
    setTeaser(
      t ?? {
        title: "",
        image: null,
        priceCents: null,
        currency: "USD",
        shopName: "",
        note: "",
      },
    );
    setSpotlight(parseChallengeSpotlight(row.spotlight));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSpotlightMedia(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadCompressedMedia(file, "product");
      const kind =
        uploaded.kind === "video" || isProbablyVideo(uploaded.url)
          ? "video"
          : "image";
      setSpotlight({
        url: uploaded.url,
        kind,
        posterUrl: uploaded.posterUrl ?? null,
      });
      toast.success(
        kind === "video"
          ? "Spotlight vidéo ajouté"
          : file.type.includes("webp") || /\.webp$/i.test(file.name)
            ? "Spotlight WebP ajouté"
            : "Spotlight image ajouté",
      );
    } catch {
      toast.error("Upload spotlight impossible");
    }
    setUploading(false);
  }

  async function onTeaserImage(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadCompressedMedia(file, "product");
      setTeaser((prev) => ({
        ...prev,
        image: uploaded.posterUrl ?? uploaded.url,
      }));
    } catch {
      toast.error("Upload image impossible");
    }
    setUploading(false);
  }

  function payloadFocus() {
    if (focus === "catalog") {
      return {
        productFocus: "catalog" as const,
        productId: product?.id ?? null,
        productTeaser: null,
      };
    }
    if (focus === "teaser") {
      return {
        productFocus: "teaser" as const,
        productId: null,
        productTeaser: {
          title: teaser.title.trim(),
          image: teaser.image || null,
          priceCents:
            teaser.priceCents != null && Number.isFinite(teaser.priceCents)
              ? Math.round(teaser.priceCents)
              : null,
          currency: teaser.currency || "USD",
          shopName: teaser.shopName?.trim() || null,
          note: teaser.note?.trim() || null,
        },
      };
    }
    return {
      productFocus: "none" as const,
      productId: null,
      productTeaser: null,
    };
  }

  function payloadSpotlight() {
    return { spotlight: spotlight ?? null };
  }

  async function saveChallenge() {
    if (focus === "catalog" && !product) {
      toast.error("Choisissez un produit publié");
      return;
    }
    if (focus === "teaser" && teaser.title.trim().length < 2) {
      toast.error("Nom du produit (hors catalogue) requis");
      return;
    }
    if (!title.trim() && focus === "none") {
      toast.error("Titre requis pour une mission libre");
      return;
    }
    if (!body.trim() && focus === "none") {
      toast.error("Consigne requise pour une mission libre");
      return;
    }

    setBusy(true);
    const focusPayload = payloadFocus();

    if (editingId) {
      const { res, data } = await fetchJson<{ error?: string }>(
        "/api/admin/challenges",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            title: title.trim() || undefined,
            body: body.trim() || undefined,
            category,
            city: city.trim() || "Kinshasa",
            ...focusPayload,
            ...payloadSpotlight(),
          }),
        },
      );
      setBusy(false);
      if (!res.ok) {
        toast.error(data?.error ?? "Modification impossible");
        return;
      }
      await syncSurface();
      toast.success("Challenge mis à jour");
      resetForm();
      await load();
      return;
    }

    const { res, data } = await fetchJson<{ error?: string }>(
      "/api/admin/challenges",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          body: body.trim() || undefined,
          category,
          city: city.trim() || "Kinshasa",
          hours,
          ...focusPayload,
          ...payloadSpotlight(),
        }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Création impossible");
      return;
    }
    await syncSurface();
    toast.success("Challenge publié — sync feed / Découvrir");
    resetForm();
    await load();
  }

  async function seedCatalog() {
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      "/api/admin/challenges",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_catalog" }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Seed impossible");
      return;
    }
    await syncSurface();
    toast.success("Catalogue du jour synchronisé");
    await load();
  }

  async function endChallenge(id: string) {
    const { res, data } = await fetchJson<{ error?: string }>(
      "/api/admin/challenges",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, endNow: true }),
      },
    );
    if (!res.ok) {
      toast.error(data?.error ?? "Fin impossible");
      return;
    }
    await syncSurface();
    toast.message("Challenge terminé");
    if (editingId === id) resetForm();
    await load();
  }

  async function prolong(id: string, nextHours = 24) {
    const { res, data } = await fetchJson<{ error?: string }>(
      "/api/admin/challenges",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, hours: nextHours }),
      },
    );
    if (!res.ok) {
      toast.error(data?.error ?? "Prolongation impossible");
      return;
    }
    await syncSurface();
    toast.success(`+${nextHours} h — remis en avant`);
    await load();
  }

  async function reactivate(id: string, nextHours = 24) {
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      "/api/admin/challenges",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reactivate: true, hours: nextHours }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Réactivation impossible");
      return;
    }
    await syncSurface();
    toast.success(`Challenge réactivé (+${nextHours} h)`);
    await load();
  }

  async function removeChallenge(id: string) {
    if (!window.confirm("Supprimer définitivement ce challenge ?")) return;
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/admin/challenges?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Suppression impossible");
      return;
    }
    await syncSurface();
    toast.success("Challenge supprimé");
    if (editingId === id) resetForm();
    await load();
  }

  function focusBadge(row: ChallengeRow) {
    const f = focusOf(row);
    if (f === "catalog" && row.product) {
      return `Boutique · ${row.product.title}`;
    }
    if (f === "teaser") {
      const t = parseChallengeTeaser(row.productTeaser);
      return t ? `Aperçu · ${t.title}` : "Aperçu";
    }
    return "Mission libre";
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 pb-10 sm:px-6">
      <div>
        <Link
          href="/shops"
          className="mb-2 inline-flex items-center gap-1 text-xs text-primary"
        >
          <ArrowLeft className="size-3" /> Boutiques
        </Link>
        <h1 className="font-heading text-xl font-bold text-balance sm:text-2xl">
          Challenges
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-pretty text-muted-foreground">
          Trois ancrages : mission libre, produit boutique, ou teaser hors
          catalogue. Aperçu live à droite.
        </p>
        <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
          {active.length} actif{active.length === 1 ? "" : "s"} · {recent.length}{" "}
          terminé{recent.length === 1 ? "" : "s"} récemment
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="grid gap-0 lg:grid-cols-[1fr_minmax(240px,280px)]">
          <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold">
            {editingId ? "Modifier le challenge" : "Nouveau challenge"}
          </h2>
          {editingId ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => resetForm()}
            >
              Annuler
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void seedCatalog()}
            >
              Sync catalogue
            </Button>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Ancrage
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {FOCUS_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => applyFocus(opt.id)}
                  className={cn(
                    "rounded-xl px-2 py-2.5 text-left transition",
                    focus === opt.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-2 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="mb-1 size-3.5 opacity-80" />
                  <span className="block text-[10px] font-bold leading-tight">
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] text-pretty text-muted-foreground">
            {FOCUS_OPTIONS.find((o) => o.id === focus)?.hint}
          </p>
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Spotlight (hero)
          </p>
          <p className="text-[10px] text-pretty text-muted-foreground">
            JPG, PNG, WebP ou courte vidéo — prioritaire sur la cover produit.
          </p>
          {spotlight ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2">
              {spotlight.kind === "video" ? (
                <video
                  src={spotlight.url}
                  poster={spotlight.posterUrl ?? undefined}
                  className="size-14 rounded-lg object-cover"
                  muted
                  playsInline
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={spotlight.url}
                  alt=""
                  className="size-14 rounded-lg object-cover outline outline-1 outline-black/10"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold">
                  {spotlight.kind === "video"
                    ? "Vidéo"
                    : /\.webp(\?|$)/i.test(spotlight.url)
                      ? "WebP"
                      : "Image"}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  Prêt pour la carte
                </p>
              </div>
              <button
                type="button"
                className="text-[11px] font-semibold text-destructive"
                onClick={() => setSpotlight(null)}
              >
                Retirer
              </button>
            </div>
          ) : null}
          <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-surface px-3 py-2.5 text-[11px] font-semibold transition hover:border-primary/40">
            {uploading
              ? "Upload…"
              : spotlight
                ? "Changer le spotlight"
                : "Ajouter JPG / PNG / WebP / vidéo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,.webp"
              className="hidden"
              disabled={uploading}
              onChange={(e) =>
                void onSpotlightMedia(e.target.files?.[0] ?? null)
              }
            />
          </label>
        </div>

        {focus === "catalog" ? (
          <div className="space-y-2">
            {product ? (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-2">
                {product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.images[0]}
                    alt=""
                    className="size-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="grid size-12 place-items-center rounded-lg bg-surface">
                    <ShoppingBag className="size-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{product.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {product.shop.name} ·{" "}
                    {formatMoney(product.priceCents, product.currency)}
                  </p>
                </div>
                <button
                  type="button"
                  className="grid size-8 place-items-center rounded-full hover:bg-surface"
                  onClick={() => setProduct(null)}
                  aria-label="Retirer"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setProductOpen((v) => !v)}
              >
                <ShoppingBag className="size-4" />
                Choisir un produit publié
              </Button>
            )}
            {productOpen ? (
              <div className="rounded-xl border border-border bg-surface-2 p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={productQ}
                    onChange={(e) => setProductQ(e.target.value)}
                    placeholder="Rechercher…"
                    className="bg-surface pl-8"
                    autoFocus
                  />
                </div>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {productHits.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface"
                        onClick={() => pickProduct(p)}
                      >
                        {p.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.images[0]}
                            alt=""
                            className="size-9 rounded-md object-cover"
                          />
                        ) : (
                          <div className="size-9 rounded-md bg-surface" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-semibold">
                            {p.title}
                          </span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {p.shop.name}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {focus === "teaser" ? (
          <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200/90">
              <Sparkles className="size-3.5" />
              Produit non enregistré — teasing avant fiche boutique
            </p>
            <Input
              value={teaser.title}
              onChange={(e) =>
                setTeaser((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Nom du produit"
              className="bg-surface-2"
              maxLength={120}
            />
            <Input
              value={teaser.shopName ?? ""}
              onChange={(e) =>
                setTeaser((prev) => ({ ...prev, shopName: e.target.value }))
              }
              placeholder="Boutique / marque (optionnel)"
              className="bg-surface-2"
              maxLength={80}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={
                  teaser.priceCents != null ? teaser.priceCents / 100 : ""
                }
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setTeaser((prev) => ({
                    ...prev,
                    priceCents: Number.isFinite(n) ? Math.round(n * 100) : null,
                  }));
                }}
                placeholder="Prix indicatif"
                className="bg-surface-2"
              />
              <Input
                value={teaser.currency ?? "USD"}
                onChange={(e) =>
                  setTeaser((prev) => ({
                    ...prev,
                    currency: e.target.value.toUpperCase().slice(0, 8),
                  }))
                }
                placeholder="Devise"
                className="bg-surface-2"
              />
            </div>
            <textarea
              value={teaser.note ?? ""}
              onChange={(e) =>
                setTeaser((prev) => ({ ...prev, note: e.target.value }))
              }
              placeholder="Note courte (arrivage, drop, promo…)"
              rows={2}
              maxLength={220}
              className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none"
            />
            <div className="flex items-center gap-2">
              {teaser.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={teaser.image}
                  alt=""
                  className="size-14 rounded-lg object-cover"
                />
              ) : null}
              <label className="inline-flex cursor-pointer items-center rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[11px] font-semibold">
                {uploading ? "Upload…" : teaser.image ? "Changer l’image" : "Image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) =>
                    void onTeaserImage(e.target.files?.[0] ?? null)
                  }
                />
              </label>
              {teaser.image ? (
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground"
                  onClick={() =>
                    setTeaser((prev) => ({ ...prev, image: null }))
                  }
                >
                  Retirer
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {!editingId && focus === "none" && catalog.length > 0 ? (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Modèles mission libre
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {catalog.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => fillFromCatalog(item)}
                  className="shrink-0 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[10px] font-semibold transition hover:border-primary/40"
                >
                  {item.title}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Titre
            </span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre du challenge"
              className="bg-surface-2"
              maxLength={120}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Consigne
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Consigne (préremplie si produit / teaser)"
              rows={3}
              maxLength={400}
              className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="mt-0.5 block text-right text-[10px] tabular-nums text-muted-foreground">
              {body.length}/400
            </span>
          </label>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Catégorie
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-bold transition",
                  category === c.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-2 text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ville
            </span>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ville"
              className="bg-surface-2"
            />
          </label>
          {!editingId ? (
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Durée (h)
              </span>
              <Input
                type="number"
                min={1}
                max={168}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value) || 24)}
                placeholder="Durée (h)"
                className="bg-surface-2"
              />
            </label>
          ) : (
            <div className="flex flex-col justify-end">
              <div className="flex h-10 items-center rounded-xl border border-border bg-surface-2 px-3 text-[11px] text-muted-foreground">
                Durée via +24 h
              </div>
            </div>
          )}
        </div>

        <Button
          className="w-full"
          disabled={
            busy ||
            uploading ||
            (focus === "catalog" && !product) ||
            (focus === "teaser" && teaser.title.trim().length < 2) ||
            (focus === "none" && (!title.trim() || !body.trim()))
          }
          onClick={() => void saveChallenge()}
        >
          {busy
            ? "Enregistrement…"
            : editingId
              ? "Enregistrer"
              : "Publier le challenge"}
        </Button>
          </div>

          <aside className="flex flex-col items-center justify-start gap-3 border-t border-border bg-[#0e0e12] p-5 lg:border-t-0 lg:border-l">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
              Aperçu feed
            </p>
            <ChallengeLivePreview
              title={title}
              body={body}
              category={category}
              city={city}
              hours={hours}
              focus={focus}
              product={product}
              teaser={teaser}
              spotlight={spotlight}
            />
            <p className="max-w-[240px] text-center text-[9px] leading-snug text-white/40">
              {FOCUS_OPTIONS.find((o) => o.id === focus)?.label}
              {product ? ` · ${product.title}` : null}
              {focus === "teaser" && teaser.title.trim()
                ? ` · ${teaser.title.trim()}`
                : null}
            </p>
          </aside>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-sm font-bold">Actifs ({active.length})</h2>
          <Link
            href="/discover"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary"
          >
            Voir Découvrir
            <ExternalLink className="size-3" />
          </Link>
        </div>
        {active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
            <Sparkles className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-xs text-muted-foreground">
              Aucun challenge en cours — publiez-en un ci-dessus.
            </p>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {active.map((row) => {
              const spot = parseChallengeSpotlight(row.spotlight);
              const thumb =
                spot?.url ||
                row.product?.images[0] ||
                parseChallengeTeaser(row.productTeaser)?.image ||
                null;
              return (
              <li
                key={row.id}
                className="overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <div className="flex gap-3 p-3">
                  {thumb ? (
                    spot?.kind === "video" ? (
                      <video
                        src={thumb}
                        poster={spot.posterUrl ?? undefined}
                        className="size-16 shrink-0 rounded-xl object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        className="size-16 shrink-0 rounded-xl object-cover outline outline-1 outline-black/10"
                      />
                    )
                  ) : (
                    <div
                      className={cn(
                        "size-16 shrink-0 rounded-xl bg-gradient-to-br",
                        categoryLook(row.category).wash,
                      )}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{row.title}</p>
                <p className="mt-0.5 text-[11px] font-medium text-primary">
                  {focusBadge(row)}
                </p>
                <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {row.category ?? "—"} · {row.completions} participants
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] text-pretty text-muted-foreground">
                  {row.body}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    className="h-7 text-[10px]"
                    disabled={busy || reportBusy}
                    onClick={() => void openReport(row.id)}
                  >
                    Rapport
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    disabled={busy}
                    onClick={() => startEdit(row)}
                  >
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    disabled={busy}
                    onClick={() => void prolong(row.id, 24)}
                  >
                    +24 h
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px] text-destructive"
                    disabled={busy}
                    onClick={() => void endChallenge(row.id)}
                  >
                    Terminer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px] text-destructive"
                    disabled={busy}
                    onClick={() => void removeChallenge(row.id)}
                  >
                    Supprimer
                  </Button>
                </div>
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      {recent.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold">Terminés récemment</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {recent.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-border/60 bg-surface/60 p-3"
              >
                <p className="truncate text-sm font-semibold">{row.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {focusBadge(row)} · {row.completions} participants
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    disabled={busy || reportBusy}
                    onClick={() => void openReport(row.id)}
                  >
                    Rapport
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-[10px]"
                    disabled={busy}
                    onClick={() => void reactivate(row.id, hours)}
                  >
                    Réactiver
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    disabled={busy}
                    onClick={() => startEdit(row)}
                  >
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px] text-destructive"
                    disabled={busy}
                    onClick={() => void removeChallenge(row.id)}
                  >
                    Supprimer
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report || reportBusy ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-xl sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-heading text-lg font-bold">
                  Rapport challengeurs
                </h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Pour le demandeur — qualité d’engagement produit
                </p>
              </div>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-full bg-surface-2"
                onClick={() => setReport(null)}
                aria-label="Fermer"
              >
                <X className="size-4" />
              </button>
            </div>

            {reportBusy && !report ? (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Chargement…
              </p>
            ) : report ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-border bg-surface-2 p-3">
                  <p className="text-sm font-semibold">{report.challenge.title}</p>
                  {report.challenge.productLabel ? (
                    <p className="mt-0.5 text-[11px] text-primary">
                      Produit · {report.challenge.productLabel}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    {report.quality.summary}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold">
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">
                      Score {report.quality.score}/100 · {report.quality.label}
                    </span>
                    <span className="rounded-full bg-surface px-2 py-0.5">
                      {report.quality.participants} participants
                    </span>
                    <span className="rounded-full bg-surface px-2 py-0.5">
                      {report.quality.contactCoveragePct}% contacts
                    </span>
                    <span className="rounded-full bg-surface px-2 py-0.5">
                      {report.quality.withPhone} tél.
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    className="h-8 text-[11px]"
                    onClick={() => void copyReportContacts()}
                  >
                    Copier pour le demandeur
                  </Button>
                  <a
                    href={`/api/admin/challenges/${report.challenge.id}/report?format=csv`}
                    className="inline-flex h-8 items-center rounded-full border border-border bg-surface-2 px-3 text-[11px] font-semibold"
                  >
                    Export CSV
                  </a>
                </div>

                {report.participants.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Pas encore de participation.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {report.participants.map((p) => (
                      <li
                        key={p.reference}
                        className="rounded-xl border border-border/70 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-semibold">{p.name}</p>
                          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-primary">
                            {p.reference}
                          </code>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {p.phone ?? "Pas de tél."} · {p.email ?? "Pas d’email"}
                          {p.emailVerified ? " · vérifié" : ""}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(p.joinedAt).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
