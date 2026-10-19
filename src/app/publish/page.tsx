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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePageBack } from "@/components/back-nav-context";
import { PageLoader } from "@/components/page-loader";
import { MediaUploader } from "@/components/media-uploader";
import {
  PublishMontage,
  type LocalMontageClip,
} from "@/components/publish-montage";
import { LOCAL_SOUNDTRACK_ID, normalizeMotions } from "@/lib/montage";
import { useAppConfig } from "@/lib/use-app-config";
import {
  KinshasaAddressForm,
  type AddressState,
} from "@/components/kinshasa-address-form";
import { composeAddress } from "@/lib/address";
import { type AppCurrency, parseCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CurrencyPicker } from "@/components/currency-picker";
import { useI18n } from "@/components/i18n-provider";
import { PackagePlus, Search } from "lucide-react";

type Shop = {
  id: string;
  name: string;
  logoUrl?: string | null;
  currency?: string;
};

function PublishInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const appConfig = useAppConfig();
  const { data: session } = authClient.useSession();
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
  const [imageMotions, setImageMotions] = useState<string[]>([]);
  const localClipRef = useRef<LocalMontageClip | null>(null);
  const [loading, setLoading] = useState(false);

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
      if (!shopId && list[0]) setShopId(list[0].id);
      const selected = list.find((s) => s.id === (shopId || list[0]?.id));
      if (selected?.currency) setCurrency(parseCurrency(selected.currency));
    }
    if (session) load();
  }, [session, shopId]);

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
    if (images.length === 0) {
      setLoading(false);
      toast.error("Ajoutez au moins une image");
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
          images,
          colors,
          sizes,
          location,
          soundtrackId: publishedSoundtrackId,
          soundtrackStartMs: publishedStartMs,
          imageMotions: normalizeMotions(images.length, imageMotions),
          status: as,
        }),
      });
      const json = await res.json();
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
      toast.success("Publication réussie", {
        description: `« ${publishedTitle} » est maintenant visible pour les acheteurs sur ShipShop.`,
        duration: 6000,
      });
      resetPublishForm();
      router.refresh();
    } catch {
      toast.error("Publication impossible — réessayez");
    } finally {
      setLoading(false);
    }
  }

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
          <h1 className="font-heading text-xl font-bold">Filme l’article</h1>
          <div className="space-y-2">
            <Label>{t("publish.shop")}</Label>
            <Select
              value={shopId}
              onValueChange={(v) => {
                if (!v) return;
                setShopId(v);
                const shop = shops.find((s) => s.id === v);
                if (shop?.currency) setCurrency(parseCurrency(shop.currency));
              }}
            >
              <SelectTrigger className="bg-surface-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {shops.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            />
          </div>
          <PublishMontage
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
            shopLogoUrl={shops.find((s) => s.id === shopId)?.logoUrl}
            priceCents={
              Number.parseFloat(price) > 0
                ? Math.round(Number.parseFloat(price) * 100)
                : undefined
            }
            currency={currency}
          />

          <Button
            className="h-12 w-full font-bold"
            disabled={!shopId || images.length === 0}
            onClick={() => setStep(2)}
          >
            Suivant
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Prix · 2/3
          </p>
          <h1 className="font-heading text-xl font-bold">Prix</h1>
          <div className="space-y-2">
            <Label>{t("publish.titleProduct")}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("publish.titlePlaceholder")}
              className="bg-surface-2"
            />
          </div>
          <div className="space-y-2">
            <Label>Monnaie</Label>
            <CurrencyPicker value={currency} onChange={setCurrency} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prix ({currency})</Label>
              <div className="flex items-center rounded-xl border border-border bg-surface-2 px-3">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="border-0 bg-transparent font-heading text-lg font-bold shadow-none focus-visible:ring-0"
                />
                <span className="text-sm text-muted-foreground">{currency}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Quantité</Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-11 bg-surface-2 font-heading text-lg font-bold"
              />
            </div>
          </div>
          <details className="rounded-2xl border border-border bg-surface-2 p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              Plus tard (optionnel)
            </summary>
            <div className="mt-3 space-y-4">
          <div>
            <Label className="mb-2 block">Catégorie</Label>
            <div className="h-scroll h-scroll-fade gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap",
                    category === c.id
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-surface-2",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Couleurs disponibles</Label>
            <div className="h-scroll h-scroll-fade gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  title={c.name}
                  onClick={() => toggleColor(c.name)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap",
                    colors.includes(c.name)
                      ? "border-primary bg-primary/15"
                      : "border-border bg-surface-2",
                  )}
                >
                  <span
                    className="size-3.5 rounded-full border border-white/20"
                    style={{ backgroundColor: colorHex(c.name) }}
                  />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Tailles disponibles</Label>
            <div className="h-scroll h-scroll-fade gap-2">
              {PRESET_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSize(s)}
                  className={cn(
                    "rounded-xl border px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap",
                    sizes.includes(s)
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-surface-2",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-24 bg-surface-2"
            />
          </div>
          <div className="space-y-2">
            <Label>Localisation produit</Label>
            <KinshasaAddressForm compact value={address} onChange={setAddress} />
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
                disabled={loading}
                onClick={() => saveProduct("DRAFT")}
              >
                {loading ? "…" : "Enregistrer brouillon"}
              </Button>
            </div>
            <Button
              className="h-12 w-full bg-gradient-to-r from-trust to-[#00b377] font-bold"
              disabled={loading}
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
