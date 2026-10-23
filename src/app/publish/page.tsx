"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { CATEGORIES } from "@/lib/categories";
import { PRESET_COLORS, PRESET_SIZES, colorHex } from "@/lib/product-options";
import { fetchJson } from "@/lib/fetch-json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShopPicker } from "@/components/shop-picker";
import { usePageBack } from "@/components/back-nav-context";
import { PageLoader } from "@/components/page-loader";
import { MediaUploader } from "@/components/media-uploader";
import {
  PublishMontage,
  type LocalMontageClip,
} from "@/components/publish-montage";
import {
  LOCAL_SOUNDTRACK_ID,
  looksUnspecifiedMotions,
  normalizeMotions,
} from "@/lib/montage";
import { useAppConfig } from "@/lib/use-app-config";
import { type AddressState } from "@/components/kinshasa-address-form";
import { composeAddress } from "@/lib/address";
import { reverseGeocode } from "@/lib/browser-geolocation";
import { APP_CURRENCIES, type AppCurrency, parseCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n, type MessagePath } from "@/components/i18n-provider";
import { notifyNewListing } from "@/lib/new-listing-events";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Car,
  Check,
  Clapperboard,
  ChevronDown,
  ChevronRight,
  Cpu,
  Dumbbell,
  Footprints,
  Gamepad2,
  Home,
  Music2,
  PackagePlus,
  Palette,
  Search,
  Shirt,
  Sparkles,
} from "lucide-react";
import { isPublicUploadPath } from "@/lib/upload-url";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  Tech: Cpu,
  Mode: Shirt,
  Maison: Home,
  Gaming: Gamepad2,
  Beauté: Sparkles,
  Auto: Car,
  Livres: BookOpen,
  Sport: Dumbbell,
};

const CLOTHING_SIZES = PRESET_SIZES.filter((s) =>
  ["XS", "S", "M", "L", "XL", "XXL", "Unique"].includes(s),
);
const SHOE_SIZES = PRESET_SIZES.filter((s) => /^\d+$/.test(s));

/** Chiffres + au plus un point décimal (max 2 décimales). */
function sanitizePriceInput(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  const whole = cleaned.slice(0, dot);
  const fraction = cleaned
    .slice(dot + 1)
    .replace(/\./g, "")
    .slice(0, 2);
  return `${whole}.${fraction}`;
}

type Shop = {
  id: string;
  name: string;
  logoUrl?: string | null;
  currency?: string;
  lat?: number | null;
  lng?: number | null;
  owner?: { name: string } | null;
};

function PublishInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const appConfig = useAppConfig();
  const { data: session, isPending } = authClient.useSession();
  const mode = searchParams.get("mode");
  const [step, setStep] = useState(1);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState(searchParams.get("shopId") ?? "");
  const [title, setTitle] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<AppCurrency>("USD");
  const [quantity, setQuantity] = useState("1");
  const [category, setCategory] = useState("Tech");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState<AddressState>({
    city: "Kinshasa",
    commune: "",
    quartier: "",
    avenue: "",
    parcelle: "",
  });
  const [colors, setColors] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [soundtrackId, setSoundtrackId] = useState<string | null>(null);
  const [soundtrackStartMs, setSoundtrackStartMs] = useState(0);
  const [localClip, setLocalClip] = useState<LocalMontageClip | null>(null);
  const [montageOpen, setMontageOpen] = useState(false);
  const [imageMotions, setImageMotions] = useState<string[]>([]);
  const localClipRef = useRef<LocalMontageClip | null>(null);
  const [loading, setLoading] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);

  function replaceLocalClip(next: LocalMontageClip | null) {
    const prev = localClipRef.current;
    if (prev?.audioUrl && prev.audioUrl !== next?.audioUrl) {
      URL.revokeObjectURL(prev.audioUrl);
    }
    localClipRef.current = next;
    setLocalClip(next);
  }

  useEffect(() => {
    return () => {
      const prev = localClipRef.current;
      if (prev?.audioUrl) URL.revokeObjectURL(prev.audioUrl);
    };
  }, []);

  usePageBack({
    onBack: step > 1 ? () => setStep((s) => s - 1) : undefined,
    fallbackHref: "/",
  });

  useEffect(() => {
    async function load() {
      const { data } = await fetchJson<{ shops?: Shop[] }>("/api/shops?mine=1");
      const list = data?.shops ?? [];
      setShops(list);
      const selected =
        list.find((s) => s.id === shopId) ?? list[0] ?? null;
      if (selected && selected.id !== shopId) setShopId(selected.id);
      if (selected?.currency) setCurrency(parseCurrency(selected.currency));
      if (selected) void applyShopLocation(selected);
    }
    if (session) load();
  }, [session, shopId]);

  const activeShop = shops.find((s) => s.id === shopId) ?? shops[0] ?? null;

  async function applyShopLocation(shop: Shop) {
    const lat = shop.lat;
    const lng = shop.lng;
    if (typeof lat !== "number" || typeof lng !== "number") return;
    try {
      const geo = await reverseGeocode(lat, lng);
      setAddress({
        city: geo.city?.trim() || "Kinshasa",
        commune: geo.commune ?? "",
        quartier: geo.quartier ?? "",
        avenue: "",
        parcelle: "",
        lat,
        lng,
      });
    } catch {
      setAddress((prev) => ({ ...prev, lat, lng }));
    }
  }

  function toggleColor(name: string) {
    setColors((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    );
  }

  function toggleSize(size: string) {
    setSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size],
    );
  }

  if (isPending) {
    return <PageLoader />;
  }

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-muted-foreground">
          Connectez-vous pour publier une annonce
        </p>
        <Link
          href="/auth/login"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Connexion
        </Link>
      </div>
    );
  }

  if (mode !== "sell") {
    return (
      <div className="mx-auto max-w-lg px-4 pb-8 pt-4">
        <h1 className="font-heading text-xl font-bold">
          {t("wanted.publishChooser")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vendez un article, ou demandez ce que vous cherchez — tout le monde
          voit les demandes.
        </p>
        <div className="mt-6 grid gap-3">
          <Link
            href="/publish?mode=sell"
            className="flex items-start gap-3 rounded-2xl border border-border bg-surface-2 p-4 transition hover:border-primary"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary">
              <PackagePlus className="size-5" />
            </span>
            <span>
              <span className="block font-heading font-bold">
                {t("wanted.publishSell")}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Vendre en vidéo — 3 gestes : vidéo, prix, poster
              </span>
            </span>
          </Link>
          <Link
            href="/wanted/new"
            className="flex items-start gap-3 rounded-2xl border border-border bg-surface-2 p-4 transition hover:border-primary"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-trust/15 text-trust">
              <Search className="size-5" />
            </span>
            <span>
              <span className="block font-heading font-bold">
                {t("wanted.publishWanted")}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Budget, neuf ou occasion — les vendeurs et clients vous
                répondent
              </span>
            </span>
          </Link>
        </div>
      </div>
    );
  }

  if (shops.length === 0) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-muted-foreground">
          Créez d&apos;abord votre boutique vendeur
        </p>
        <Link
          href="/onboarding"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Devenir vendeur
        </Link>
      </div>
    );
  }

  async function saveProduct(as: "DRAFT" | "ACTIVE") {
    if (loading) return;
    if (mediaBusy) {
      toast.error("Patientez: upload média en cours");
      return;
    }
    const qty = Math.max(1, parseInt(quantity || "1", 10) || 1);
    setLoading(true);
    const priceCents = Math.round(parseFloat(price || "0") * 100);
    if (!priceCents || priceCents < 100) {
      setLoading(false);
      toast.error(`Prix minimum 1 ${currency}`);
      return;
    }
    if (!title.trim()) {
      setLoading(false);
      toast.error("Indiquez un titre");
      return;
    }
    if (!shopId) {
      setLoading(false);
      toast.error("Choisissez une boutique");
      return;
    }
    const sanitizedImages = [...new Set(images.map((u) => u.trim()).filter(Boolean))];
    if (sanitizedImages.length === 0) {
      setLoading(false);
      toast.error("Ajoutez au moins une image");
      return;
    }
    const hasInvalidMediaUrl = sanitizedImages.some(
      (url) => !isPublicUploadPath(url) && !url.includes("picsum.photos"),
    );
    if (hasInvalidMediaUrl) {
      setLoading(false);
      toast.error("Certains médias sont invalides. Réimportez-les.");
      return;
    }
    const location = composeAddress(address);
    const publishedTitle = title.trim();
    function resetPublishForm() {
      setStep(1);
      setTitle("");
      setImages([]);
      setPrice("");
      setQuantity("1");
      setCategory("Tech");
      setDescription("");
      setAddress({
        city: "Kinshasa",
        commune: "",
        quartier: "",
        avenue: "",
        parcelle: "",
      });
      setColors([]);
      setSizes([]);
      setSoundtrackId(null);
      setSoundtrackStartMs(0);
      replaceLocalClip(null);
      setImageMotions([]);
    }
    try {
      let publishedSoundtrackId = soundtrackId;
      let publishedStartMs = soundtrackId ? soundtrackStartMs : 0;
      if (soundtrackId === LOCAL_SOUNDTRACK_ID) {
        const clip = localClipRef.current;
        if (!clip) {
          setLoading(false);
          toast.error("Son temporaire introuvable — réimportez");
          return;
        }
        const form = new FormData();
        form.append("file", clip.file);
        form.append("startMs", String(soundtrackStartMs));
        form.append("title", clip.title);
        const clipRes = await fetch("/api/soundtracks", {
          method: "POST",
          body: form,
        });
        const clipJson = (await clipRes.json()) as {
          soundtrack?: { id: string };
          error?: string;
        };
        if (!clipRes.ok || !clipJson.soundtrack) {
          toast.error(clipJson.error ?? "Extrait audio impossible");
          return;
        }
        publishedSoundtrackId = clipJson.soundtrack.id;
        publishedStartMs = 0;
      }
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          title: publishedTitle,
          description,
          priceCents,
          currency,
          quantity: qty,
          category,
          images: sanitizedImages,
          colors,
          sizes,
          location,
          soundtrackId: publishedSoundtrackId,
          soundtrackStartMs: publishedStartMs,
          imageMotions: normalizeMotions(sanitizedImages.length, imageMotions),
          status: as,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        product?: {
          id: string;
          title: string;
          priceCents: number;
          currency?: string;
          createdAt?: string;
          images?: string[];
          shop?: {
            id: string;
            name: string;
            slug: string;
            logoUrl?: string | null;
            ownerUserId?: string | null;
          };
        };
      };
      if (!res.ok) {
        toast.error(json.error ?? "Enregistrement échoué");
        return;
      }
      if (as === "DRAFT") {
        toast.success("Brouillon enregistré", {
          description:
            "Votre annonce est sauvegardée. Publiez-la quand vous voulez depuis Mes produits.",
          duration: 5000,
        });
        resetPublishForm();
        router.refresh();
        return;
      }
      const created = json.product;
      if (created?.id && created.shop) {
        notifyNewListing({
          id: created.id,
          title: created.title,
          priceCents: created.priceCents,
          currency: created.currency,
          createdAt:
            typeof created.createdAt === "string"
              ? created.createdAt
              : undefined,
          cover: created.images?.[0] ?? null,
          shop: {
            id: created.shop.id,
            name: created.shop.name,
            slug: created.shop.slug,
            logoUrl: created.shop.logoUrl ?? null,
            ownerUserId: created.shop.ownerUserId ?? null,
          },
        });
      }
      toast.success("Publication réussie", {
        description: `« ${publishedTitle} » est maintenant visible pour les acheteurs sur ShipShop.`,
        duration: 6000,
      });
      resetPublishForm();
      router.push("/");
    } catch {
      toast.error("Publication impossible — réessayez");
    } finally {
      setLoading(false);
    }
  }

  const hasMontageSound = Boolean(soundtrackId || localClip);
  const hasMontageMotion = !looksUnspecifiedMotions(imageMotions);
  const montageReady = hasMontageSound || hasMontageMotion;
  const canOpenMontage = images.length > 0 && !mediaBusy;

  return (
    <div className="mx-auto max-w-lg px-4 pb-6 pt-0">
      <div className="mb-6 flex gap-1.5">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full",
              s < step && "bg-trust",
              s === step && "bg-primary",
              s > step && "bg-surface-2",
            )}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Vidéo · 1/3
          </p>
          <h1 className="font-heading text-xl font-bold">Contenu d'article</h1>
          <div className="space-y-2">
            <Label>{t("publish.shop")}</Label>
            <ShopPicker
              shops={shops}
              value={shopId}
              hideWhenSingle={false}
              onChange={(id) => {
                setShopId(id);
                const shop = shops.find((s) => s.id === id);
                if (shop?.currency) setCurrency(parseCurrency(shop.currency));
                if (shop) void applyShopLocation(shop);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("publish.media")}</Label>
            <MediaUploader
              urls={images}
              onChange={(urls) => {
                setImages(urls);
                setImageMotions(
                  normalizeMotions(
                    urls.length,
                    imageMotions,
                    appConfig.maxImages,
                  ),
                );
              }}
              max={appConfig.maxImages}
              onBusyChange={setMediaBusy}
            />
          </div>

          <button
            type="button"
            disabled={!canOpenMontage}
            onClick={() => {
              if (!canOpenMontage) {
                toast.message(t("montage.needMedia"));
                return;
              }
              setMontageOpen(true);
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition",
              canOpenMontage
                ? "border-border bg-surface hover:border-primary/40 hover:bg-surface-2 active:scale-[0.99]"
                : "cursor-not-allowed border-border/60 bg-surface-2/50 opacity-70",
              montageReady && "border-trust/35 bg-trust/5",
            )}
          >
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl",
                montageReady
                  ? "bg-trust/15 text-trust"
                  : "bg-primary/12 text-primary",
              )}
            >
              <Clapperboard className="size-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-foreground">
                {t("montage.title")}
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                {canOpenMontage
                  ? t("montage.openHint")
                  : t("montage.needMedia")}
              </span>
              {montageReady ? (
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {hasMontageSound ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-trust/15 px-2 py-0.5 text-[10px] font-semibold text-trust">
                      <Music2 className="size-3" />
                      {t("montage.activeSound")}
                    </span>
                  ) : null}
                  {hasMontageMotion ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      <Sparkles className="size-3" />
                      {t("montage.activeMotion")}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </span>
            <ChevronRight
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </button>

          <Sheet open={montageOpen} onOpenChange={setMontageOpen}>
            <SheetContent
              side="bottom"
              className="mx-auto max-h-[min(92dvh,44rem)] !max-w-[34rem] gap-0 overflow-hidden rounded-t-3xl bg-surface p-0"
            >
              <SheetHeader className="border-b border-border px-4 pt-3 pb-2.5">
                <SheetTitle className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-primary/12 text-primary">
                    <Clapperboard className="size-4" strokeWidth={1.75} />
                  </span>
                  {t("montage.title")}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  {t("montage.openHint")}
                </SheetDescription>
              </SheetHeader>
              <div className="overflow-y-auto overscroll-contain px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <PublishMontage
                  plain
                  images={images}
                  onImagesChange={setImages}
                  soundtrackId={soundtrackId}
                  onSoundtrackId={(id) => {
                    setSoundtrackId(id);
                    setSoundtrackStartMs(0);
                  }}
                  soundtrackStartMs={soundtrackStartMs}
                  onSoundtrackStartMs={setSoundtrackStartMs}
                  localClip={localClip}
                  onLocalClip={replaceLocalClip}
                  imageMotions={imageMotions}
                  onImageMotions={setImageMotions}
                  productTitle={title}
                  shopId={activeShop?.id}
                  shopLogoUrl={activeShop?.logoUrl ?? null}
                  priceCents={
                    Number.parseFloat(price) > 0
                      ? Math.round(Number.parseFloat(price) * 100)
                      : undefined
                  }
                  currency={currency}
                />
                <Button
                  type="button"
                  className="mt-4 h-11 w-full font-semibold"
                  onClick={() => setMontageOpen(false)}
                >
                  {t("montage.done")}
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <Button
            className="h-12 w-full font-bold"
            disabled={!shopId || images.length === 0 || mediaBusy}
            onClick={() => setStep(2)}
          >
            {mediaBusy ? "Upload en cours…" : "Suivant"}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Prix · 2/3
          </p>
          <div className="space-y-2">
            <Label>{t("publish.titleProduct")}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nom d'article ou produit"
              className="bg-surface-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prix</Label>
              <div className="flex h-11 items-center rounded-xl border border-border bg-surface-2 px-3">
                <Input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  pattern="[0-9]*[.]?[0-9]{0,2}"
                  value={price}
                  onChange={(e) => setPrice(sanitizePriceInput(e.target.value))}
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData("text");
                    setPrice(sanitizePriceInput(text));
                  }}
                  className="h-full border-0 bg-transparent px-0 font-heading text-lg font-bold shadow-none focus-visible:ring-0"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger
                    type="button"
                    className="inline-flex shrink-0 items-center gap-0.5 rounded-lg px-1.5 py-1 text-sm font-bold text-primary transition hover:bg-primary/10"
                    aria-label="Changer la devise"
                  >
                    {currency}
                    <ChevronDown className="size-3.5 opacity-70" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-28">
                    {APP_CURRENCIES.map((code) => (
                      <DropdownMenuItem
                        key={code}
                        onClick={() => {
                          if (code === currency) return;
                          setCurrency(code);
                          setPrice("");
                        }}
                        className={cn(
                          "justify-between font-bold",
                          code === currency && "text-primary",
                        )}
                      >
                        {code}
                        {code === currency ? (
                          <Check className="size-3.5" strokeWidth={2.5} />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Qté</Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-11 bg-surface-2 font-heading text-lg font-bold"
              />
            </div>
          </div>

          <section className="space-y-2.5">
            <div>
              <Label className="text-sm font-semibold">
                {t("publish.category")}
              </Label>
              <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                {t("publish.categoryHint")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CATEGORIES.map((c) => {
                const Icon = CATEGORY_ICON[c.id] ?? Sparkles;
                const selected = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      "group relative flex flex-col items-start gap-2 overflow-hidden rounded-2xl border p-3 text-left transition active:scale-[0.98]",
                      selected
                        ? "border-primary/50 bg-primary/10 ring-2 ring-primary/35"
                        : "border-border bg-surface hover:border-primary/35 hover:bg-surface-2",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-10 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                        c.gradient,
                      )}
                    >
                      <Icon className="size-5" strokeWidth={1.75} />
                    </span>
                    <span className="text-[13px] font-semibold tracking-tight text-foreground">
                      {t(`categories.${c.id}` as MessagePath)}
                    </span>
                    {selected ? (
                      <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <details
            className={cn(
              "group overflow-hidden rounded-2xl border transition",
              colors.length > 0 || sizes.length > 0
                ? "border-primary/35 bg-primary/5"
                : "border-border bg-surface hover:border-primary/30",
            )}
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3.5 marker:content-none [&::-webkit-details-marker]:hidden">
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-xl",
                  colors.length > 0 || sizes.length > 0
                    ? "bg-primary/15 text-primary"
                    : "bg-gradient-to-br from-rose-500/20 via-amber-400/15 to-sky-500/20 text-foreground",
                )}
              >
                <Palette className="size-5" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {t("publish.moreOptions")}
                  {colors.length + sizes.length > 0 ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {colors.length + sizes.length} {t("publish.optionsSelected")}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                  {t("publish.moreOptionsHint")}
                </span>
                {colors.length > 0 ? (
                  <span className="mt-2 flex items-center gap-1.5">
                    {colors.slice(0, 6).map((c) => (
                      <span
                        key={c}
                        className="size-4 rounded-full border border-white/25 shadow-sm"
                        style={{ backgroundColor: colorHex(c) }}
                        title={c}
                      />
                    ))}
                    {colors.length > 6 ? (
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        +{colors.length - 6}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                className="size-5 shrink-0 text-muted-foreground transition group-open:rotate-180"
                aria-hidden
              />
            </summary>

            <div className="space-y-5 border-t border-border/70 px-3.5 py-4">
              <section className="space-y-2.5">
                <div>
                  <Label className="text-sm font-semibold">
                    {t("publish.colors")}
                  </Label>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                    {t("publish.colorsHint")}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_COLORS.map((c) => {
                    const selected = colors.includes(c.name);
                    const light =
                      c.name === "Blanc" ||
                      c.name === "Or" ||
                      c.name === "Argent";
                    return (
                      <button
                        key={c.name}
                        type="button"
                        title={c.name}
                        onClick={() => toggleColor(c.name)}
                        className={cn(
                          "group/swatch flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition active:scale-[0.97]",
                          selected
                            ? "border-primary/50 bg-primary/10 ring-2 ring-primary/30"
                            : "border-border bg-surface-2 hover:border-primary/35",
                        )}
                      >
                        <span className="relative grid size-9 place-items-center">
                          <span
                            className={cn(
                              "size-9 rounded-full shadow-inner",
                              light
                                ? "border border-black/15"
                                : "border border-white/15",
                            )}
                            style={{ backgroundColor: colorHex(c.name) }}
                          />
                          {selected ? (
                            <span
                              className={cn(
                                "absolute inset-0 grid place-items-center rounded-full",
                                light
                                  ? "bg-black/25 text-white"
                                  : "bg-black/35 text-white",
                              )}
                            >
                              <Check className="size-3.5" strokeWidth={3} />
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[11px] font-semibold tracking-tight text-foreground">
                          {c.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <div>
                  <Label className="text-sm font-semibold">
                    {t("publish.sizes")}
                  </Label>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                    {t("publish.sizesHint")}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <Shirt className="size-3.5" strokeWidth={2} />
                    {t("publish.sizesClothing")}
                  </p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                    {CLOTHING_SIZES.map((s) => {
                      const selected = sizes.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSize(s)}
                          className={cn(
                            "flex h-11 items-center justify-center rounded-xl border text-[13px] font-bold transition active:scale-[0.97]",
                            selected
                              ? "border-primary bg-primary text-white shadow-sm"
                              : "border-border bg-surface-2 text-foreground hover:border-primary/40 hover:bg-surface",
                          )}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <Footprints className="size-3.5" strokeWidth={2} />
                    {t("publish.sizesShoes")}
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {SHOE_SIZES.map((s) => {
                      const selected = sizes.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSize(s)}
                          className={cn(
                            "flex h-10 items-center justify-center rounded-xl border text-[12px] font-bold transition active:scale-[0.97]",
                            selected
                              ? "border-primary bg-primary text-white shadow-sm"
                              : "border-border bg-surface-2 text-foreground hover:border-primary/40 hover:bg-surface",
                          )}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-24 bg-surface-2"
                />
              </div>
              <div className="space-y-2">
                <Label>Localisation boutique</Label>
                <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
                  {composeAddress(address) || "Position de la boutique"}
                </p>
              </div>
            </div>
          </details>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>
              Retour
            </Button>
            <Button
              className="flex-[2] font-bold"
              disabled={!price || !title.trim()}
              onClick={() => setStep(3)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Poster · 3/3
          </p>
          <h1 className="font-heading text-xl font-bold">Poster</h1>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 font-heading text-2xl font-bold text-trust">
              {price}$ · stock {quantity}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {category} · {composeAddress(address)} · {images.length || 0}{" "}
              média{(images.length || 0) !== 1 ? "s" : ""}
            </p>
            {colors.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {colors.map((c) => (
                  <span
                    key={c}
                    className="size-5 rounded-full border border-white/20"
                    style={{ backgroundColor: colorHex(c) }}
                    title={c}
                  />
                ))}
              </div>
            )}
            {sizes.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Tailles : {sizes.join(", ")}
              </p>
            )}
            {description && (
              <p className="mt-3 text-sm text-white/80">{description}</p>
            )}
          </div>
          <div className="rounded-xl border border-trust/30 bg-trust/10 p-3 text-xs text-trust">
            Tu vends en vidéo. L&apos;argent de l&apos;acheteur est bloqué
            jusqu&apos;à la réception.
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setStep(2)}
              >
                Retour
              </Button>
              <Button
                variant="outline"
                className="flex-[2] border-white/20"
                disabled={loading || mediaBusy}
                onClick={() => saveProduct("DRAFT")}
              >
                {loading ? "…" : "Enregistrer brouillon"}
              </Button>
            </div>
            <Button
              className="h-12 w-full bg-gradient-to-r from-trust to-[#00b377] font-bold"
              disabled={loading || mediaBusy}
              onClick={() => saveProduct("ACTIVE")}
            >
              {loading ? "Publication…" : "Publier maintenant"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PublishPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PublishInner />
    </Suspense>
  );
}
