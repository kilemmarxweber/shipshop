"use client";

import { useEffect, useState } from "react";
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
  KinshasaAddressForm,
  type AddressState,
} from "@/components/kinshasa-address-form";
import { composeAddress } from "@/lib/address";
import { cn } from "@/lib/utils";

type Shop = { id: string; name: string };

function PublishInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();
  const [step, setStep] = useState(1);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState(searchParams.get("shopId") ?? "");
  const [title, setTitle] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [price, setPrice] = useState("");
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
  const [loading, setLoading] = useState(false);

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
    const qty = Math.max(1, parseInt(quantity || "1", 10) || 1);
    setLoading(true);
    const priceCents = Math.round(parseFloat(price || "0") * 100);
    if (!priceCents || priceCents < 100) {
      setLoading(false);
      toast.error("Prix minimum 1$");
      return;
    }
    const location = composeAddress(address);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopId,
        title,
        description,
        priceCents,
        quantity: qty,
        category,
        images,
        colors,
        sizes,
        location,
        status: as,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(json.error ?? "Enregistrement échoué");
      return;
    }
    if (as === "DRAFT") {
      toast.success("Brouillon enregistré — publiez-le plus tard");
      router.push("/shops/products");
      return;
    }
    toast.success("Annonce publiée");
    router.push(`/product/${json.product.id}`);
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
              s > step && "bg-[#1c1c26]",
            )}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Étape 1 sur 3
          </p>
          <h1 className="font-heading text-xl font-bold">Médias & titre</h1>
          <div className="space-y-2">
            <Label>Boutique</Label>
            <Select value={shopId} onValueChange={(v) => v && setShopId(v)}>
              <SelectTrigger className="bg-[#1c1c26]">
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
            <Label>Images / vidéos (max 10 Mo)</Label>
            <MediaUploader urls={images} onChange={setImages} max={12} />
          </div>

          <div className="space-y-2">
            <Label>Titre</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="iPhone 15 Pro Max 256Go"
              className="bg-[#1c1c26]"
            />
          </div>
          <Button
            className="h-12 w-full font-bold"
            disabled={!title || !shopId}
            onClick={() => setStep(2)}
          >
            Suivant
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Étape 2 sur 3
          </p>
          <h1 className="font-heading text-xl font-bold">
            Prix, stock & options
          </h1>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prix (USD)</Label>
              <div className="flex items-center rounded-xl border border-white/10 bg-[#1c1c26] px-3">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="border-0 bg-transparent font-heading text-lg font-bold shadow-none focus-visible:ring-0"
                />
                <span className="text-sm text-muted-foreground">$</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Quantité</Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-11 bg-[#1c1c26] font-heading text-lg font-bold"
              />
            </div>
          </div>
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
                      : "border-white/10 bg-[#1c1c26]",
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
                      : "border-white/10 bg-[#1c1c26]",
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
                      : "border-white/10 bg-[#1c1c26]",
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
              className="min-h-24 bg-[#1c1c26]"
            />
          </div>
          <div className="space-y-2">
            <Label>Localisation produit</Label>
            <KinshasaAddressForm value={address} onChange={setAddress} />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>
              Retour
            </Button>
            <Button
              className="flex-[2] font-bold"
              disabled={!price || !address.city}
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
            Étape 3 sur 3
          </p>
          <h1 className="font-heading text-xl font-bold">Vérification</h1>
          <div className="rounded-2xl border border-white/8 bg-[#13131a] p-4">
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
            Argent protégé Chip Shop — l&apos;acheteur paie depuis son solde
            prépayé.
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
