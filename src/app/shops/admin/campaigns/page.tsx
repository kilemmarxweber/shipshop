"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  ImagePlus,
  Link2,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { uploadCompressedMedia } from "@/lib/compress-media";
import { formatMoney, cn } from "@/lib/utils";
import {
  STORY_TEMPLATES,
  normalizeStoryTemplate,
  type StoryTemplateId,
} from "@/lib/growth/story-templates";
import { refreshGrowthSurface } from "@/lib/growth/use-growth-surface";
import { PartnerStoryFrame } from "@/components/growth/partner-story-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/page-loader";
import { usePageBack } from "@/components/back-nav-context";

type Pack = {
  objective: "DISCOVERY" | "ENGAGEMENT" | "CONVERSION";
  kind: string;
  minBudgetCents: number;
  maxBudgetCents: number;
};

type Campaign = {
  id: string;
  title: string;
  kind: string;
  objective: string;
  status: string;
  budgetCents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  body?: string | null;
  mediaUrl?: string | null;
  ctaUrl?: string | null;
  productId?: string | null;
  category?: string | null;
};

type ProductHit = {
  id: string;
  title: string;
  images: string[];
  priceCents: number;
  currency: string;
  shop: { name: string };
};

type DestMode = "product" | "link" | "discover";

const DEST_OPTIONS: {
  id: DestMode;
  label: string;
  hint: string;
  icon: typeof ShoppingBag;
}[] = [
  {
    id: "product",
    label: "Produit",
    hint: "Ouvre une fiche boutique",
    icon: ShoppingBag,
  },
  {
    id: "link",
    label: "Lien",
    hint: "/discover, /product/… ou https://",
    icon: Link2,
  },
  {
    id: "discover",
    label: "Découvrir",
    hint: "Fallback sûr — jamais de 404",
    icon: Sparkles,
  },
];

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-[#7dffb3]/15 text-[#3d9a68]",
  PAUSED: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  ENDED: "bg-muted text-muted-foreground",
  DRAFT: "bg-surface-2 text-muted-foreground",
};

function TemplateThumb({
  id,
  active,
  onSelect,
}: {
  id: StoryTemplateId;
  active: boolean;
  onSelect: () => void;
}) {
  const meta = STORY_TEMPLATES.find((t) => t.id === id)!;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group overflow-hidden rounded-xl border text-left transition",
        active
          ? "border-primary ring-2 ring-primary/25"
          : "border-border hover:border-primary/40",
      )}
    >
      <div className="relative aspect-[3/4] bg-[#1a1a22]">
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-[#3a3550] to-[#121218]",
            id === "quote" && "brightness-75",
          )}
        />
        {id === "quote" ? (
          <div className="absolute inset-0 flex items-center justify-center px-1.5">
            <span className="line-clamp-3 text-center text-[8px] font-bold leading-tight text-white/90">
              « Citation »
            </span>
          </div>
        ) : null}
        {id === "split" ? (
          <div className="absolute inset-x-0 bottom-0 h-[40%] bg-black/80 px-1 pt-1">
            <span className="block h-1.5 w-3/4 rounded-sm bg-white/80" />
            <span className="mt-1 block h-1 w-1/2 rounded-sm bg-white/40" />
          </div>
        ) : null}
        {id === "product" ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1 pt-4">
            <span className="block h-1.5 w-4/5 rounded-sm bg-white/85" />
            <span className="mt-1 inline-block h-2.5 w-6 rounded-full bg-[#7dffb3]" />
          </div>
        ) : null}
        {id === "cover" ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4">
            <span className="block h-1.5 w-3/4 rounded-sm bg-white/85" />
            <span className="mt-1 block h-1 w-1/2 rounded-sm bg-white/45" />
          </div>
        ) : null}
      </div>
      <div className="border-t border-border bg-surface px-1.5 py-1.5">
        <p className="text-[10px] font-bold leading-tight">{meta.label}</p>
        <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-muted-foreground">
          {meta.hint}
        </p>
      </div>
    </button>
  );
}

export default function CampaignsAdminPage() {
  const { data: session, isPending } = authClient.useSession();
  usePageBack({ fallbackHref: "/shops" });
  const fileRef = useRef<HTMLInputElement>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [rows, setRows] = useState<Campaign[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [template, setTemplate] = useState<StoryTemplateId>("cover");
  const [dest, setDest] = useState<DestMode>("product");
  const [product, setProduct] = useState<ProductHit | null>(null);
  const [productQ, setProductQ] = useState("");
  const [productHits, setProductHits] = useState<ProductHit[]>([]);
  const [productOpen, setProductOpen] = useState(false);
  const [objective, setObjective] =
    useState<Pack["objective"]>("DISCOVERY");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const { res, data } = await fetchJson<{
      campaigns?: Campaign[];
      packs?: Pack[];
    }>("/api/admin/brand-campaigns");
    if (res.status === 403) {
      setAllowed(false);
      return;
    }
    setAllowed(true);
    setRows(data?.campaigns ?? []);
    setPacks(data?.packs ?? []);
  }

  useEffect(() => {
    if (session) void load();
  }, [session?.user?.id]);

  useEffect(() => {
    if (!productOpen || dest !== "product") return;
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
  }, [productOpen, productQ, dest]);

  if (isPending || (session && allowed === null)) return <PageLoader />;
  if (!session || allowed === false) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        Réservé à l’owner ShipShop.
      </p>
    );
  }

  const pack = packs.find((p) => p.objective === objective);
  const stories = rows.filter((r) => r.kind === "STORY");
  const activeCount = stories.filter((r) => r.status === "ACTIVE").length;

  function resetForm() {
    setTitle("");
    setBody("");
    setCtaUrl("");
    setMediaUrl(null);
    setTemplate("cover");
    setDest("product");
    setProduct(null);
    setProductQ("");
    setProductOpen(false);
    setObjective("DISCOVERY");
  }

  function pickProduct(p: ProductHit) {
    setProduct(p);
    if (!title.trim()) setTitle(p.title.slice(0, 120));
    if (!mediaUrl && p.images[0]) setMediaUrl(p.images[0]);
    setProductOpen(false);
    setProductQ("");
  }

  async function onPickImage(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadCompressedMedia(file, "product");
      setMediaUrl(uploaded.posterUrl ?? uploaded.url);
      toast.success("Image ajoutée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload impossible");
    } finally {
      setUploading(false);
    }
  }

  async function createStory() {
    if (!title.trim()) {
      toast.error("Titre requis");
      return;
    }
    if (dest === "product" && !product) {
      toast.error("Choisissez un produit publié, ou passez en Lien / Découvrir");
      return;
    }
    if (dest === "link" && !ctaUrl.trim()) {
      toast.error("Indiquez un lien CTA");
      return;
    }

    setBusy(true);
    const { res, data } = await fetchJson<{
      campaign?: Campaign;
      error?: string;
    }>("/api/admin/brand-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        objective,
        kind: "STORY",
        status: "ACTIVE",
        budgetCents: pack?.minBudgetCents,
        body: body.trim() || null,
        mediaUrl,
        ctaUrl: dest === "link" ? ctaUrl.trim() : dest === "discover" ? "/discover" : null,
        productId: dest === "product" ? product?.id ?? null : null,
        category: template,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Story impossible");
      return;
    }
    await refreshGrowthSurface();
    toast.success("Story active sur Découvrir");
    resetForm();
    await load();
  }

  async function setStatus(id: string, status: Campaign["status"]) {
    const { res, data } = await fetchJson<{ error?: string }>(
      "/api/admin/brand-campaigns",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      },
    );
    if (!res.ok) {
      toast.error(data?.error ?? "Mise à jour impossible");
      return;
    }
    await refreshGrowthSurface();
    await load();
  }

  const destHint = DEST_OPTIONS.find((o) => o.id === dest)?.hint;

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
          Stories partenaires
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-pretty text-muted-foreground">
          Composez une carte 3:4 — elle apparaît dans Découvrir. Aperçu live à
          droite (ou en haut sur mobile).
        </p>
        <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
          {activeCount} active{activeCount === 1 ? "" : "s"} · {stories.length}{" "}
          au total
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="grid gap-0 lg:grid-cols-[1fr_200px]">
          <div className="space-y-4 p-4 sm:p-5">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Template
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {STORY_TEMPLATES.map((t) => (
                  <TemplateThumb
                    key={t.id}
                    id={t.id}
                    active={template === t.id}
                    onSelect={() => setTemplate(t.id)}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Visuel
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
              />
              {mediaUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaUrl}
                    alt=""
                    className="size-14 shrink-0 rounded-lg object-cover outline outline-1 outline-black/10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">Image prête</p>
                    <p className="text-[10px] text-muted-foreground">
                      Format vertical recommandé
                    </p>
                    <div className="mt-1.5 flex gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px]"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                      >
                        Remplacer
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] text-destructive"
                        onClick={() => setMediaUrl(null)}
                      >
                        <Trash2 className="mr-1 size-3" />
                        Retirer
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 px-3 py-5 text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                >
                  <ImagePlus className="size-5" />
                  <span className="text-xs font-semibold">
                    {uploading ? "Upload…" : "Ajouter une image"}
                  </span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Titre
                </span>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex. Drop mode Kin"
                  className="bg-surface-2"
                  maxLength={120}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Accroche
                </span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Promo, citation, mode d’emploi…"
                  rows={3}
                  maxLength={280}
                  className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="mt-0.5 block text-right text-[10px] tabular-nums text-muted-foreground">
                  {body.length}/280
                </span>
              </label>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Destination au clic
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {DEST_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setDest(opt.id);
                        if (opt.id !== "product") setProductOpen(false);
                      }}
                      className={cn(
                        "rounded-xl px-2 py-2.5 text-left transition",
                        dest === opt.id
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
                {destHint}
              </p>

              {dest === "product" ? (
                <div className="mt-2 space-y-2">
                  {product ? (
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-2">
                      {product.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.images[0]}
                          alt=""
                          className="size-10 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
                          <ShoppingBag className="size-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">
                          {product.title}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {product.shop.name} ·{" "}
                          {formatMoney(product.priceCents, product.currency)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                        onClick={() => setProduct(null)}
                        aria-label="Retirer le produit"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => setProductOpen(true)}
                    >
                      <Search className="size-3.5" />
                      Choisir un produit ACTIVE
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
                      <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                        {productHits.length === 0 ? (
                          <li className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                            Aucun produit
                          </li>
                        ) : (
                          productHits.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                onClick={() => pickProduct(p)}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface"
                              >
                                {p.images[0] ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={p.images[0]}
                                    alt=""
                                    className="size-8 shrink-0 rounded-md object-cover"
                                  />
                                ) : (
                                  <div className="size-8 shrink-0 rounded-md bg-muted" />
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-semibold">
                                    {p.title}
                                  </span>
                                  <span className="block truncate text-[10px] text-muted-foreground">
                                    {p.shop.name}
                                  </span>
                                </span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-7 w-full text-[10px]"
                        onClick={() => setProductOpen(false)}
                      >
                        Fermer
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {dest === "link" ? (
                <div className="mt-2">
                  <Input
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="/discover ou https://…"
                    className="bg-surface-2"
                  />
                </div>
              ) : null}
            </div>

            <details className="rounded-xl border border-border bg-surface-2/60 px-3 py-2">
              <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">
                Pack budget (optionnel)
              </summary>
              <div className="mt-2 flex flex-wrap gap-2 pb-1">
                {packs.map((p) => (
                  <button
                    key={p.objective}
                    type="button"
                    onClick={() => setObjective(p.objective)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[10px] font-bold tabular-nums transition",
                      objective === p.objective
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p.objective} · {formatMoney(p.minBudgetCents)}+
                  </button>
                ))}
              </div>
            </details>

            <Button
              className="w-full"
              disabled={busy || uploading || !title.trim()}
              onClick={() => void createStory()}
            >
              {busy ? "Publication…" : "Publier la story"}
            </Button>
          </div>

          <aside className="flex flex-col items-center justify-start gap-3 border-t border-border bg-[#0e0e12] p-5 lg:border-t-0 lg:border-l">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
              Aperçu Découvrir
            </p>
            <PartnerStoryFrame
              title={title}
              body={body}
              mediaUrl={mediaUrl}
              template={template}
              className="w-[160px] shadow-lg shadow-black/40 sm:w-[172px]"
            />
            <p className="max-w-[172px] text-center text-[9px] leading-snug text-white/40">
              {dest === "product" && product
                ? `→ ${product.title}`
                : dest === "link" && ctaUrl.trim()
                  ? `→ ${ctaUrl.trim()}`
                  : "→ Découvrir"}
            </p>
          </aside>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-sm font-bold">Bibliothèque</h2>
          <Link
            href="/discover"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary"
          >
            Voir Découvrir
            <ExternalLink className="size-3" />
          </Link>
        </div>

        {stories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
            <Sparkles className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-xs text-muted-foreground">
              Aucune story — publiez-en une ci-dessus.
            </p>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {stories.map((row) => {
              const tpl = normalizeStoryTemplate(row.category);
              const tplLabel =
                STORY_TEMPLATES.find((t) => t.id === tpl)?.label ?? tpl;
              return (
                <li
                  key={row.id}
                  className="overflow-hidden rounded-2xl border border-border bg-surface"
                >
                  <div className="flex gap-3 p-2.5">
                    <div className="w-14 shrink-0">
                      <PartnerStoryFrame
                        title={row.title}
                        body={row.body}
                        mediaUrl={row.mediaUrl}
                        category={row.category}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-semibold">
                          {row.title}
                        </p>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                            STATUS_STYLE[row.status] ?? STATUS_STYLE.DRAFT,
                          )}
                        >
                          {row.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {tplLabel}
                        {row.productId ? " · fiche produit" : null}
                        {row.ctaUrl ? ` · ${row.ctaUrl}` : null}
                      </p>
                      <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                        {row.impressions} vues · {row.clicks} clics
                      </p>
                      {row.body ? (
                        <p className="mt-1 line-clamp-2 text-[11px] text-pretty text-muted-foreground">
                          {row.body}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {row.status === "ACTIVE" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px]"
                            onClick={() => void setStatus(row.id, "PAUSED")}
                          >
                            Pause
                          </Button>
                        ) : row.status !== "ENDED" ? (
                          <Button
                            size="sm"
                            className="h-7 text-[10px]"
                            onClick={() => void setStatus(row.id, "ACTIVE")}
                          >
                            Activer
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 text-[10px]"
                            onClick={() => void setStatus(row.id, "ACTIVE")}
                          >
                            Réactiver
                          </Button>
                        )}
                        {row.status !== "ENDED" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[10px] text-destructive"
                            onClick={() => void setStatus(row.id, "ENDED")}
                          >
                            Terminer
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
