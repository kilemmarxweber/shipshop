"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { CATEGORIES } from "@/lib/categories";
import { fetchJson } from "@/lib/fetch-json";
import { WANTED_BATCH_MAX } from "@/lib/wanted";
import { useI18n } from "@/components/i18n-provider";
import { usePageBack } from "@/components/back-nav-context";
import { MediaUploader } from "@/components/media-uploader";
import {
  KinshasaAddressForm,
  type AddressState,
} from "@/components/kinshasa-address-form";
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
import { cn } from "@/lib/utils";

type Condition = "NEW_SHOP" | "USED" | "";

type ProductDraft = {
  key: string;
  title: string;
  description: string;
  images: string[];
  category: string;
  budget: string;
  condition: Condition;
};

function emptyDraft(): ProductDraft {
  return {
    key: crypto.randomUUID(),
    title: "",
    description: "",
    images: [],
    category: "Tech",
    budget: "",
    condition: "",
  };
}

export default function NewWantedPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: session } = authClient.useSession();
  const [products, setProducts] = useState<ProductDraft[]>([emptyDraft()]);
  const [address, setAddress] = useState<AddressState>({
    city: "Kinshasa",
    commune: "",
    quartier: "",
    avenue: "",
    parcelle: "",
  });
  const [loading, setLoading] = useState(false);

  usePageBack({ fallbackHref: "/publish" });

  function patch(key: string, next: Partial<ProductDraft>) {
    setProducts((prev) =>
      prev.map((p) => (p.key === key ? { ...p, ...next } : p)),
    );
  }

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-muted-foreground">{t("wanted.guestHint")}</p>
        <Link
          href="/auth/login"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {t("auth.login")}
        </Link>
      </div>
    );
  }

  async function submit() {
    if (loading) return;
    const items: {
      title: string;
      description: string | null;
      images: string[];
      category: string;
      budgetCents: number;
      condition: "NEW_SHOP" | "USED";
    }[] = [];

    for (let i = 0; i < products.length; i++) {
      const p = products[i]!;
      const budgetCents = Math.round(parseFloat(p.budget || "0") * 100);
      if (!p.title.trim()) {
        toast.error(`${t("wanted.productN")} ${i + 1} : indiquez un titre`);
        return;
      }
      if (!p.condition) {
        toast.error(
          `${t("wanted.productN")} ${i + 1} : neuf / magasin ou occasion`,
        );
        return;
      }
      if (!budgetCents || budgetCents < 100) {
        toast.error(`${t("wanted.productN")} ${i + 1} : budget minimum 1$`);
        return;
      }
      items.push({
        title: p.title.trim(),
        description: p.description.trim() || null,
        images: p.images,
        category: p.category,
        budgetCents,
        condition: p.condition,
      });
    }

    setLoading(true);
    const { res, data } = await fetchJson<{
      request?: { id: string };
      requests?: { id: string }[];
      error?: string;
    }>("/api/wanted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items,
        city: address.city || "Kinshasa",
        commune: address.commune || null,
        quartier: address.quartier || null,
        avenue: address.avenue || null,
      }),
    });
    setLoading(false);
    if (!res.ok || !data?.request) {
      toast.error(data?.error ?? "Publication impossible");
      return;
    }
    const n = data.requests?.length ?? 1;
    toast.success(
      n > 1
        ? `${n} demandes visibles pour tout le monde`
        : "Demande visible pour tout le monde",
    );
    if (n > 1) {
      router.replace("/wanted");
    } else {
      router.replace(`/wanted/${data.request.id}`);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-8 pt-2">
      <h1 className="font-heading text-xl font-bold">{t("wanted.title")}</h1>
      <p className="text-sm text-muted-foreground">
        Un ou plusieurs produits, chacun avec son budget et son état (neuf
        magasin ou occasion).
      </p>

      {products.map((p, index) => (
        <div
          key={p.key}
          className="space-y-3 rounded-2xl border border-border bg-surface-2 p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-heading text-sm font-bold">
              {t("wanted.productN")} {index + 1}
            </p>
            {products.length > 1 && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                onClick={() =>
                  setProducts((prev) => prev.filter((x) => x.key !== p.key))
                }
              >
                <Trash2 className="size-3.5" />
                {t("wanted.removeProduct")}
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label>Photos (optionnel)</Label>
            <MediaUploader
              urls={p.images}
              onChange={(images) => patch(p.key, { images })}
              max={8}
            />
          </div>

          <div className="space-y-2">
            <Label>Titre</Label>
            <Input
              value={p.title}
              onChange={(e) => patch(p.key, { title: e.target.value })}
              placeholder="Ex. iPhone 13 128 Go"
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select
              value={p.category}
              onValueChange={(v) => v && patch(p.key, { category: v })}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>État souhaité</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => patch(p.key, { condition: "NEW_SHOP" })}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left text-sm font-semibold",
                  p.condition === "NEW_SHOP"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background",
                )}
              >
                {t("wanted.newShop")}
              </button>
              <button
                type="button"
                onClick={() => patch(p.key, { condition: "USED" })}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left text-sm font-semibold",
                  p.condition === "USED"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background",
                )}
              >
                {t("wanted.used")}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("wanted.budget")} (USD)</Label>
            <Input
              inputMode="decimal"
              value={p.budget}
              onChange={(e) => patch(p.key, { budget: e.target.value })}
              placeholder="50"
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label>Détails</Label>
            <Textarea
              value={p.description}
              onChange={(e) => patch(p.key, { description: e.target.value })}
              rows={3}
              className="bg-background"
              placeholder="Couleur, taille, modèle…"
            />
          </div>
        </div>
      ))}

      {products.length < WANTED_BATCH_MAX && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setProducts((prev) => [...prev, emptyDraft()])}
        >
          <Plus className="size-4" />
          {t("wanted.addProduct")}
        </Button>
      )}

      <KinshasaAddressForm value={address} onChange={setAddress} />

      <Button className="h-12 w-full font-bold" disabled={loading} onClick={submit}>
        {loading
          ? "…"
          : products.length > 1
            ? t("wanted.publishMany")
            : "Publier la demande"}
      </Button>
    </div>
  );
}
