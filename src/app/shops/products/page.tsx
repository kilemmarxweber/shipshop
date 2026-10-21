"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { parseCurrency } from "@/lib/money";
import { formatMoney, cn } from "@/lib/utils";
import { CurrencyPicker } from "@/components/currency-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUploader } from "@/components/media-uploader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageLoader } from "@/components/page-loader";
import { ShopPicker } from "@/components/shop-picker";
import { useConfirmDialog } from "@/components/use-confirm-dialog";

type Product = {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  currency?: string;
  quantity: number;
  status: string;
  category: string;
  images: string[];
  location: string | null;
  ordersCount?: number;
  canDelete?: boolean;
  shop: { id: string; name: string; slug?: string };
};

type ShopOption = {
  id: string;
  name: string;
  slug: string;
  owner?: { name: string } | null;
};

type Tab = "all" | "ACTIVE" | "DRAFT" | "HIDDEN" | "SOLD";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Publié",
  DRAFT: "Brouillon",
  HIDDEN: "Archivé",
  SOLD: "Épuisé",
};

function SellerProductsInner() {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [shopId, setShopId] = useState(searchParams.get("shopId") ?? "");
  const [platform, setPlatform] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [republishOpen, setRepublishOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { confirm, ConfirmDialog } = useConfirmDialog();

  async function load(selected = shopId) {
    const params = new URLSearchParams({ mine: "1" });
    if (selected) params.set("shopId", selected);
    const { data } = await fetchJson<{ products?: Product[] }>(
      `/api/products?${params}`,
      { cache: "no-store" },
    );
    setProducts(data?.products ?? []);
  }

  useEffect(() => {
    if (!session) return;
    void fetchJson<{ shops?: ShopOption[]; isPlatformOwner?: boolean }>(
      "/api/shops?mine=1",
    ).then(({ data }) => {
      setShops(data?.shops ?? []);
      setPlatform(Boolean(data?.isPlatformOwner));
    });
  }, [session]);

  useEffect(() => {
    if (session) void load(shopId);
  }, [session, shopId]);

  const filtered = useMemo(() => {
    if (tab === "all") return products;
    return products.filter((p) => p.status === tab);
  }, [products, tab]);

  async function save() {
    if (!editing) return;
    if (editing.images.length === 0) {
      toast.error("Ajoutez au moins une image ou une vidéo");
      return;
    }
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/products/${editing.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editing.title,
          description: editing.description,
          priceCents: editing.priceCents,
          currency: editing.currency,
          quantity: editing.quantity,
          category: editing.category,
          images: editing.images,
          location: editing.location,
          status: editing.status,
        }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Échec");
      return;
    }
    toast.success("Produit mis à jour");
    setEditing(null);
    await load();
    router.refresh();
  }

  async function setStatus(id: string, status: string) {
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/products/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Échec");
      return;
    }
    toast.success(
      status === "ACTIVE"
        ? "Produit publié"
        : status === "HIDDEN"
          ? "Produit archivé"
          : status === "DRAFT"
            ? "Remis en brouillon"
            : "Statut mis à jour",
    );
    load();
  }

  async function remove(p: Product) {
    if (!p.canDelete) {
      toast.error(
        "Lié à un paiement — archivez-le plutôt que de le supprimer",
      );
      return;
    }
    const ok = await confirm({
      title: "Supprimer le produit ?",
      description: `Supprimer définitivement « ${p.title} » ?`,
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/products/${p.id}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Suppression impossible");
      return;
    }
    toast.success("Produit supprimé");
    load();
  }

  function openRepublish() {
    if (products.length === 0) {
      toast.message("Aucun produit à republier");
      return;
    }
    setSelectedIds(new Set());
    setRepublishOpen(true);
  }

  function toggleRepublishProduct(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllRepublish() {
    setSelectedIds((prev) => {
      if (prev.size === products.length) return new Set();
      return new Set(products.map((p) => p.id));
    });
  }

  async function confirmRepublish() {
    if (selectedIds.size === 0) {
      toast.error("Sélectionnez au moins un produit");
      return;
    }
    setBusy(true);
    const { res, data } = await fetchJson<{
      error?: string;
      updated?: number;
    }>("/api/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "activate_products",
        productIds: Array.from(selectedIds),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Republication impossible");
      return;
    }
    toast.success(
      data?.updated != null
        ? `${data.updated} produit(s) republié(s)`
        : "Produits republiés",
    );
    setRepublishOpen(false);
    load();
  }

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <Link href="/auth/login" className="text-primary">
          Connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-0 md:px-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold">
            {platform ? "Produits boutiques" : "Mes produits"}
          </h1>
          <p className="text-xs text-muted-foreground">
            Modifier · publier · archiver · supprimer
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            disabled={busy || products.length === 0}
            onClick={openRepublish}
          >
            <CheckCircle2 className="size-3" />
            Republier
          </Button>
          <Link
            href={shopId ? `/publish?shopId=${shopId}` : "/publish"}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white"
          >
            + Créer
          </Link>
        </div>
      </div>

      <ShopPicker
        className="mb-4"
        shops={shops}
        value={shopId}
        allLabel="Toutes les boutiques"
        onChange={(next) => {
          setShopId(next);
          const url = next
            ? `/shops/products?shopId=${encodeURIComponent(next)}`
            : "/shops/products";
          router.replace(url);
        }}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {(
          [
            ["all", "Tous"],
            ["ACTIVE", "Publiés"],
            ["DRAFT", "Brouillons"],
            ["HIDDEN", "Archivés"],
            ["SOLD", "Épuisés"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-[11px] font-semibold",
              tab === key
                ? "bg-primary text-white"
                : "bg-muted/40 text-muted-foreground",
            )}
          >
            {label}
            {key !== "all" && (
              <span className="ml-1 opacity-70">
                ({products.filter((p) => p.status === key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {filtered.map((p) => (
          <li
            key={p.id}
            className="rounded-2xl border border-border bg-surface p-3"
          >
            <div className="flex gap-3">
              <div
                className="size-14 shrink-0 rounded-xl bg-cover bg-center"
                style={{ backgroundImage: `url(${p.images[0]})` }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatMoney(p.priceCents, p.currency)} · stock {p.quantity} ·{" "}
                  <span
                    className={cn(
                      "font-bold",
                      p.status === "ACTIVE" && "text-trust",
                      p.status === "DRAFT" && "text-amber-400",
                      p.status === "HIDDEN" && "text-muted-foreground",
                      p.status === "SOLD" && "text-muted-foreground",
                    )}
                  >
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                  {(p.ordersCount ?? 0) > 0 && (
                    <span className="ml-1">· {p.ordersCount} vente(s)</span>
                  )}
                </p>
                {p.shop.slug ? (
                  <Link
                    href={`/shop/${p.shop.slug}#produits`}
                    className="text-[10px] text-muted-foreground hover:underline"
                  >
                    @{p.shop.name}
                  </Link>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    @{p.shop.name}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                className="gap-1"
                disabled={busy}
                onClick={() => setEditing(p)}
              >
                <Pencil className="size-3" />
                Modifier
              </Button>

              {p.status === "DRAFT" && (
                <Button
                  size="sm"
                  className="gap-1"
                  disabled={busy}
                  onClick={() => setStatus(p.id, "ACTIVE")}
                >
                  <Eye className="size-3" />
                  Publier
                </Button>
              )}

              {p.status === "ACTIVE" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={busy}
                  onClick={() => setStatus(p.id, "HIDDEN")}
                >
                  <Archive className="size-3" />
                  Archiver
                </Button>
              )}

              {p.status === "HIDDEN" && (
                <Button
                  size="sm"
                  className="gap-1"
                  disabled={busy}
                  onClick={() => setStatus(p.id, "ACTIVE")}
                >
                  Republier
                </Button>
              )}

              {p.status === "SOLD" && p.quantity > 0 && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => setStatus(p.id, "ACTIVE")}
                >
                  Remettre en vente
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                className={cn(
                  "gap-1",
                  p.canDelete
                    ? "border-destructive/40 text-destructive"
                    : "opacity-50",
                )}
                disabled={busy || !p.canDelete}
                title={
                  p.canDelete
                    ? "Supprimer définitivement"
                    : "Lié à un paiement — archivez plutôt"
                }
                onClick={() => remove(p)}
              >
                <Trash2 className="size-3" />
                Supprimer
              </Button>
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucun produit —{" "}
            <Link href="/publish" className="text-primary">
              créer
            </Link>
          </p>
        )}
      </ul>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-3 font-heading text-lg font-bold">Éditer</h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Titre</Label>
                <Input
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                  className="bg-surface-2"
                />
              </div>
              <div className="space-y-1">
                <Label>Monnaie</Label>
                <CurrencyPicker
                  value={parseCurrency(editing.currency)}
                  onChange={async (next) => {
                    const prev = parseCurrency(editing.currency);
                    if (next === prev) return;
                    if (
                      editing.priceCents > 0 &&
                      !(await confirm({
                        title: "Changer la monnaie ?",
                        description:
                          "Changer de monnaie vide le prix. Continuer ?",
                      }))
                    ) {
                      return;
                    }
                    setEditing({
                      ...editing,
                      currency: next,
                      priceCents: 0,
                    });
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Prix ({editing.currency ?? "USD"})</Label>
                  <Input
                    type="number"
                    value={
                      editing.priceCents
                        ? (editing.priceCents / 100).toString()
                        : ""
                    }
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        priceCents: Math.round(
                          parseFloat(e.target.value || "0") * 100,
                        ),
                      })
                    }
                    className="bg-surface-2"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Quantité</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editing.quantity}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        quantity: parseInt(e.target.value || "0", 10) || 0,
                      })
                    }
                    className="bg-surface-2"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Statut</Label>
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value })
                  }
                  className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm"
                >
                  <option value="DRAFT">Brouillon</option>
                  <option value="ACTIVE">Publié</option>
                  <option value="HIDDEN">Archivé</option>
                  <option value="SOLD">Épuisé</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  className="min-h-20 bg-surface-2"
                />
              </div>
              <div className="space-y-1">
                <Label>Médias</Label>
                <MediaUploader
                  urls={editing.images}
                  onChange={(images) => setEditing({ ...editing, images })}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setEditing(null)}
              >
                Annuler
              </Button>
              <Button className="flex-[2]" disabled={busy} onClick={save}>
                {busy ? "…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={republishOpen} onOpenChange={setRepublishOpen}>
        <DialogContent className="bg-surface max-h-[85vh] overflow-hidden sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Republier des produits</DialogTitle>
            <DialogDescription>
              Tous vos produits — cochez 1 ou plusieurs à republier
            </DialogDescription>
          </DialogHeader>

          {products.length > 0 ? (
            <div className="space-y-2">
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={toggleAllRepublish}
              >
                {selectedIds.size === products.length
                  ? "Tout désélectionner"
                  : "Tout sélectionner"}
              </button>
              <ul className="max-h-[45vh] space-y-1 overflow-y-auto pr-1">
                {products.map((p) => {
                  const checked = selectedIds.has(p.id);
                  return (
                    <li key={p.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                          checked
                            ? "border-primary/50 bg-primary/5"
                            : "border-border hover:bg-muted/40",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 shrink-0 accent-primary"
                          checked={checked}
                          onChange={() => toggleRepublishProduct(p.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {p.title}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatMoney(p.priceCents, p.currency)} ·{" "}
                            {STATUS_LABEL[p.status] ?? p.status}
                            {p.shop?.name ? ` · @${p.shop.name}` : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRepublishOpen(false)}
              disabled={busy}
            >
              Annuler
            </Button>
            <Button
              disabled={busy || selectedIds.size === 0}
              onClick={confirmRepublish}
            >
              Republier ({selectedIds.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog />
    </div>
  );
}

export default function SellerProductsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SellerProductsInner />
    </Suspense>
  );
}
