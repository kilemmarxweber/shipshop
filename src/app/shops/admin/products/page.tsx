"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Archive, Eye, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney, cn } from "@/lib/utils";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUploader } from "@/components/media-uploader";
import { useConfirmDialog } from "@/components/use-confirm-dialog";

type Product = {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  quantity: number;
  status: string;
  category: string;
  images: string[];
  location: string | null;
  ordersCount?: number;
  canDelete?: boolean;
  shop: {
    id: string;
    name: string;
    slug: string;
    isActive?: boolean;
    owner?: { id: string; name: string; email: string } | null;
  };
};

type Tab = "all" | "ACTIVE" | "DRAFT" | "HIDDEN" | "SOLD";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Publié",
  DRAFT: "Brouillon",
  HIDDEN: "Archivé",
  SOLD: "Épuisé",
};

function AdminProductsInner() {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopIdFilter = searchParams.get("shopId");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  async function load(search = q) {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (shopIdFilter) params.set("shopId", shopIdFilter);
    const { res, data } = await fetchJson<{
      products?: Product[];
      error?: string;
    }>(`/api/admin/products?${params}`, { cache: "no-store" });
    if (res.status === 403) {
      setAllowed(false);
      setProducts([]);
      return;
    }
    setAllowed(true);
    setProducts(data?.products ?? []);
  }

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [session?.user?.id, shopIdFilter]);

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
          : "Statut mis à jour",
    );
    load();
  }

  async function remove(p: Product) {
    if (!p.canDelete) {
      toast.error("Lié à un paiement — archivez-le plutôt");
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

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <Link href="/auth/login" className="text-primary">
          Connexion
        </Link>
      </div>
    );
  }

  if (loading || allowed === null) {
    return <PageLoader />;
  }

  if (!allowed) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="font-heading text-lg font-bold">Accès refusé</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Réservé à l&apos;owner ou un admin plateforme.
        </p>
        <Link href="/shops" className="mt-4 inline-block text-sm text-primary">
          Retour
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-0 md:px-8">
      <div className="mb-4">
        <h1 className="font-heading text-xl font-bold">Modération produits</h1>
        <p className="text-xs text-muted-foreground">
          Tous les produits · modifier · archiver · supprimer
        </p>
        {shopIdFilter ? (
          <Link
            href={`/publish?shopId=${shopIdFilter}`}
            className="mt-2 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-bold text-white"
          >
            + Publier dans cette boutique
          </Link>
        ) : null}
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-2xl border border-border bg-surface-2 px-3">
        <Search className="size-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") load(q);
          }}
          placeholder="Rechercher titre, boutique…"
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button size="sm" variant="secondary" onClick={() => load(q)}>
          OK
        </Button>
      </div>

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
                className="size-14 shrink-0 rounded-xl bg-cover bg-center bg-muted"
                style={
                  p.images[0]
                    ? { backgroundImage: `url(${p.images[0]})` }
                    : undefined
                }
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatMoney(p.priceCents)} · stock {p.quantity} ·{" "}
                  <span
                    className={cn(
                      "font-bold",
                      p.status === "ACTIVE" && "text-trust",
                      p.status === "DRAFT" && "text-amber-400",
                      p.status === "HIDDEN" && "text-muted-foreground",
                    )}
                  >
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                  {(p.ordersCount ?? 0) > 0 && (
                    <span className="ml-1">· {p.ordersCount} vente(s)</span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  <Link
                    href={`/shop/${p.shop.slug}`}
                    className="font-semibold text-foreground hover:text-primary"
                  >
                    @{p.shop.name}
                  </Link>
                  {p.shop.owner && (
                    <>
                      {" "}
                      · {p.shop.owner.name} ({p.shop.owner.email})
                    </>
                  )}
                  {p.shop.isActive === false && (
                    <span className="ml-1 font-bold text-destructive">
                      · boutique off
                    </span>
                  )}
                </p>
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
            Aucun produit
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
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Prix ($)</Label>
                  <Input
                    type="number"
                    value={(editing.priceCents / 100).toString()}
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
      <ConfirmDialog />
    </div>
  );
}

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminProductsInner />
    </Suspense>
  );
}
