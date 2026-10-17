"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { CATEGORIES } from "@/lib/categories";
import { fetchJson } from "@/lib/fetch-json";
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

export default function NewWantedPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: session } = authClient.useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [category, setCategory] = useState("Tech");
  const [budget, setBudget] = useState("");
  const [condition, setCondition] = useState<"NEW_SHOP" | "USED" | "">("");
  const [address, setAddress] = useState<AddressState>({
    city: "Kinshasa",
    commune: "",
    quartier: "",
    avenue: "",
    parcelle: "",
  });
  const [loading, setLoading] = useState(false);

  usePageBack({ fallbackHref: "/publish" });

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
    const budgetCents = Math.round(parseFloat(budget || "0") * 100);
    if (!title.trim()) {
      toast.error("Indiquez un titre");
      return;
    }
    if (!condition) {
      toast.error("Choisissez neuf / magasin ou occasion");
      return;
    }
    if (!budgetCents || budgetCents < 100) {
      toast.error("Budget minimum 1$");
      return;
    }
    setLoading(true);
    const { res, data } = await fetchJson<{
      request?: { id: string };
      error?: string;
    }>("/api/wanted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        images,
        category,
        budgetCents,
        condition,
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
    toast.success("Demande visible pour tout le monde");
    router.replace(`/wanted/${data.request.id}`);
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-8 pt-2">
      <h1 className="font-heading text-xl font-bold">{t("wanted.title")}</h1>
      <p className="text-sm text-muted-foreground">
        Décrivez l’article, votre budget et si vous le voulez neuf en magasin
        ou d’occasion.
      </p>

      <div className="space-y-2">
        <Label>Photos (optionnel)</Label>
        <MediaUploader urls={images} onChange={setImages} max={8} />
      </div>

      <div className="space-y-2">
        <Label>Titre</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex. iPhone 13 128 Go"
          className="bg-surface-2"
        />
      </div>

      <div className="space-y-2">
        <Label>Catégorie</Label>
        <Select value={category} onValueChange={(v) => v && setCategory(v)}>
          <SelectTrigger className="bg-surface-2">
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
            onClick={() => setCondition("NEW_SHOP")}
            className={cn(
              "rounded-xl border px-3 py-3 text-left text-sm font-semibold",
              condition === "NEW_SHOP"
                ? "border-primary bg-primary/10"
                : "border-border bg-surface-2",
            )}
          >
            {t("wanted.newShop")}
          </button>
          <button
            type="button"
            onClick={() => setCondition("USED")}
            className={cn(
              "rounded-xl border px-3 py-3 text-left text-sm font-semibold",
              condition === "USED"
                ? "border-primary bg-primary/10"
                : "border-border bg-surface-2",
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
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="50"
          className="bg-surface-2"
        />
      </div>

      <div className="space-y-2">
        <Label>Détails</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="bg-surface-2"
          placeholder="Couleur, taille, modèle…"
        />
      </div>

      <KinshasaAddressForm value={address} onChange={setAddress} />

      <Button className="h-12 w-full font-bold" disabled={loading} onClick={submit}>
        {loading ? "…" : "Publier la demande"}
      </Button>
    </div>
  );
}
