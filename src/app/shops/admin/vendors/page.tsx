"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  KeyRound,
  Package,
  Pencil,
  Power,
  PowerOff,
  ShieldAlert,
  Store,
  Trash2,
  User,
  UserCheck,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ShopProduct = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priceCents: number;
  quantity: number;
  category: string;
  images: string[];
  location: string | null;
  ordersCount?: number;
  canDelete?: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Publié",
  DRAFT: "Brouillon",
  HIDDEN: "Archivé",
  SOLD: "Épuisé",
};

type Vendor = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  productsCount: number;
  ordersCount: number;
  productsByStatus: Record<string, number>;
  products: ShopProduct[];
  owner: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    walletBalanceCents: number;
    kyc: {
      id: string;
      status: string;
      rejectReason: string | null;
    } | null;
  } | null;
};

type Client = {
  id: string;
  memberId: string;
  role: string;
  name: string;
  email: string;
  phone: string | null;
  ordersCount: number;
  walletBalanceCents: number;
  disabledAt: string | null;
  disabledReason: string | null;
  canDelete?: boolean;
  kyc: { id: string; status: string } | null;
};

type ProductsPanel = {
  shopId: string;
  shopName: string;
};

type RepublishPicker = {
  shopId: string;
  shopName: string;
  products: ShopProduct[];
};

type Tab = "vendors" | "clients";

export default function AdminVendorsPage() {
  const { data: session } = authClient.useSession();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tab, setTab] = useState<Tab>("vendors");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [productsPanel, setProductsPanel] = useState<ProductsPanel | null>(
    null,
  );
  const [editing, setEditing] = useState<ShopProduct | null>(null);
  const [productBusy, setProductBusy] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientBusy, setClientBusy] = useState(false);
  const [republishPicker, setRepublishPicker] =
    useState<RepublishPicker | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  async function load() {
    const { res, data } = await fetchJson<{
      vendors?: Vendor[];
      clients?: Client[];
      error?: string;
    }>("/api/admin/vendors");
    if (res.status === 403) {
      setAllowed(false);
      setVendors([]);
      setClients([]);
      return;
    }
    setAllowed(true);
    setVendors(data?.vendors ?? []);
    setClients(data?.clients ?? []);
  }

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [session?.user?.id]);

  async function shopAction(
    shopId: string,
    action: "activate" | "deactivate" | "hide_products" | "activate_products",
    productIds?: string[],
  ) {
    setBusyId(shopId);
    const { res, data } = await fetchJson<{
      error?: string;
      updated?: number;
    }>("/api/admin/vendors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId, action, productIds }),
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Action impossible");
      return;
    }
    const n = data?.updated;
    toast.success(
      action === "activate"
        ? "Boutique réactivée"
        : action === "deactivate"
          ? "Boutique désactivée — produits archivés"
          : action === "hide_products"
            ? n != null
              ? `${n} produit(s) archivé(s)`
              : "Produits archivés"
            : n != null
              ? `${n} produit(s) republié(s)`
              : "Produits republiés",
    );
    load();
  }

  function openProductsPanel(vendor: Vendor) {
    if (!(vendor.products?.length > 0)) {
      toast.message("Aucun produit pour cette boutique");
      return;
    }
    setEditing(null);
    setProductsPanel({ shopId: vendor.id, shopName: vendor.name });
  }

  function openRepublishPicker(vendor: Vendor) {
    const products = vendor.products ?? [];
    if (products.length === 0) {
      toast.message("Aucun produit pour cette boutique");
      return;
    }
    setSelectedIds(new Set());
    setRepublishPicker({
      shopId: vendor.id,
      shopName: vendor.name,
      products,
    });
  }

  function toggleRepublishProduct(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllRepublishProducts() {
    if (!republishPicker) return;
    setSelectedIds((prev) => {
      if (prev.size === republishPicker.products.length) return new Set();
      return new Set(republishPicker.products.map((p) => p.id));
    });
  }

  async function confirmRepublish() {
    if (!republishPicker || selectedIds.size === 0) {
      toast.error("Sélectionnez au moins un produit");
      return;
    }
    const { shopId } = republishPicker;
    setRepublishPicker(null);
    await shopAction(shopId, "activate_products", Array.from(selectedIds));
  }

  const panelProducts = useMemo(() => {
    if (!productsPanel) return [];
    const vendor = vendors.find((v) => v.id === productsPanel.shopId);
    return vendor?.products ?? [];
  }, [productsPanel, vendors]);

  async function setProductStatus(id: string, status: "ACTIVE" | "HIDDEN") {
    setProductBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/products/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    setProductBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Action impossible");
      return;
    }
    toast.success(status === "HIDDEN" ? "Produit archivé" : "Produit republié");
    await load();
  }

  async function deleteProduct(p: ShopProduct) {
    if (!p.canDelete) {
      toast.error("Lié à un paiement — archivez-le plutôt");
      return;
    }
    if (!confirm(`Supprimer définitivement « ${p.title} » ?`)) return;
    setProductBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/products/${p.id}`,
      { method: "DELETE" },
    );
    setProductBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Suppression impossible");
      return;
    }
    toast.success("Produit supprimé");
    setEditing(null);
    await load();
  }

  async function saveProduct() {
    if (!editing) return;
    setProductBusy(true);
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
    setProductBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Échec");
      return;
    }
    toast.success("Produit mis à jour");
    setEditing(null);
    await load();
  }

  async function archiveClient(c: Client) {
    const reason =
      prompt("Motif d'archivage (optionnel) ?")?.trim() || undefined;
    setClientBusy(true);
    setBusyId(c.id);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/admin/users/${c.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", reason }),
      },
    );
    setClientBusy(false);
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Archivage impossible");
      return;
    }
    toast.success("Client archivé — connexion bloquée");
    load();
  }

  async function unarchiveClient(c: Client) {
    setClientBusy(true);
    setBusyId(c.id);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/admin/users/${c.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unarchive" }),
      },
    );
    setClientBusy(false);
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Réactivation impossible");
      return;
    }
    toast.success("Client réactivé");
    load();
  }

  async function deleteClient(c: Client) {
    if (!c.canDelete && c.ordersCount > 0) {
      toast.error("Ce compte a des commandes — archivez-le plutôt");
      return;
    }
    if (
      !confirm(
        `Supprimer définitivement « ${c.name} » (${c.email}) ? Cette action est irréversible.`,
      )
    ) {
      return;
    }
    setClientBusy(true);
    setBusyId(c.id);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/admin/users/${c.id}`,
      { method: "DELETE" },
    );
    setClientBusy(false);
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Suppression impossible");
      return;
    }
    toast.success("Client supprimé");
    setEditingClient(null);
    load();
  }

  async function saveClient() {
    if (!editingClient) return;
    setClientBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/admin/users/${editingClient.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          name: editingClient.name,
          email: editingClient.email,
          phone: editingClient.phone,
        }),
      },
    );
    setClientBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Échec");
      return;
    }
    toast.success("Client mis à jour");
    setEditingClient(null);
    load();
  }

  async function revokeKyc(kycId: string, rowId: string) {
    const reason = prompt("Motif de révocation KYC ?")?.trim();
    if (!reason) return;
    setBusyId(rowId);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/kyc/admin/${kycId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REVOKE", rejectReason: reason }),
      },
    );
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Révocation impossible");
      return;
    }
    toast.success("KYC révoqué");
    load();
  }

  async function resetPassword(userId: string, rowId: string, label: string) {
    if (
      !confirm(
        `Réinitialiser le mot de passe de ${label} et l'envoyer par e-mail + WhatsApp ?`,
      )
    ) {
      return;
    }
    setBusyId(rowId);
    const { res, data } = await fetchJson<{
      error?: string;
      temporaryPassword?: string;
      channels?: {
        email?: { ok: boolean; provider?: string; error?: string };
        whatsapp?: { ok: boolean; provider?: string; error?: string };
        sms?: { ok: boolean; provider?: string; error?: string };
      };
    }>(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Reset impossible");
      return;
    }
    const ch = data?.channels;
    const parts = [
      ch?.email?.ok
        ? `e-mail (${ch.email.provider})`
        : ch?.email?.error
          ? `e-mail: ${ch.email.error}`
          : null,
      ch?.whatsapp?.ok
        ? `WhatsApp (${ch.whatsapp.provider})`
        : ch?.sms?.ok
          ? `SMS (${ch.sms.provider})`
          : ch?.whatsapp?.error
            ? `WhatsApp: ${ch.whatsapp.error}`
            : null,
    ].filter(Boolean);
    toast.success(
      `Mot de passe réinitialisé · ${parts.join(" · ") || "envoyé"}`,
      { duration: 8000 },
    );
    if (data?.temporaryPassword) {
      toast.message(`MDP temporaire : ${data.temporaryPassword}`, {
        duration: 15000,
        description: "Copiez-le si l'utilisateur ne reçoit pas le message",
      });
    }
  }

  const filteredVendors = useMemo(() => {
    if (!q.trim()) return vendors;
    const s = q.trim().toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(s) ||
        v.slug.toLowerCase().includes(s) ||
        (v.owner?.name ?? "").toLowerCase().includes(s) ||
        (v.owner?.email ?? "").toLowerCase().includes(s),
    );
  }, [vendors, q]);

  const filteredClients = useMemo(() => {
    if (!q.trim()) return clients;
    const s = q.trim().toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        (c.phone ?? "").toLowerCase().includes(s),
    );
  }, [clients, q]);

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <Link href="/auth/login" className="text-primary">
          Connexion
        </Link>
      </div>
    );
  }

  if (loading || allowed === null) return <PageLoader />;

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
        <h1 className="font-heading text-xl font-bold">Vendeurs & clients</h1>
        <p className="text-xs text-muted-foreground">
          Clients = comptes sans boutique · Vendeurs = propriétaires de boutique
        </p>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setTab("vendors")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-[11px] font-semibold",
            tab === "vendors"
              ? "bg-primary text-white"
              : "bg-muted/40 text-muted-foreground",
          )}
        >
          Vendeurs ({vendors.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("clients")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-[11px] font-semibold",
            tab === "clients"
              ? "bg-primary text-white"
              : "bg-muted/40 text-muted-foreground",
          )}
        >
          Clients ({clients.length})
        </button>
      </div>

      <div className="mb-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            tab === "vendors"
              ? "Filtrer boutique, vendeur, email…"
              : "Filtrer client, email, téléphone…"
          }
          className="bg-surface-2"
        />
      </div>

      {tab === "vendors" ? (
        <ul className="space-y-3">
          {filteredVendors.map((v) => {
            const busy = busyId === v.id;
            const kycStatus = v.owner?.kyc?.status ?? "NONE";
            return (
              <li
                key={v.id}
                className={cn(
                  "rounded-2xl border border-border bg-surface p-4",
                  !v.isActive && "opacity-80",
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-xl",
                      v.isActive
                        ? "bg-primary/15 text-primary"
                        : "bg-destructive/15 text-destructive",
                    )}
                  >
                    <Store className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/shop/${v.slug}`}
                        className="truncate font-heading font-bold hover:text-primary"
                      >
                        {v.name}
                      </Link>
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                        Vendeur
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          v.isActive
                            ? "bg-trust/15 text-trust"
                            : "bg-destructive/15 text-destructive",
                        )}
                      >
                        {v.isActive ? "Active" : "Désactivée"}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          kycStatus === "APPROVED" && "bg-trust/15 text-trust",
                          kycStatus === "PENDING" &&
                            "bg-amber-500/15 text-amber-500",
                          (kycStatus === "REJECTED" || kycStatus === "NONE") &&
                            "bg-muted text-muted-foreground",
                        )}
                      >
                        KYC {kycStatus}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      @{v.slug}
                      {v.owner && (
                        <>
                          {" "}
                          · {v.owner.name} · {v.owner.email}
                          {v.owner.phone ? ` · ${v.owner.phone}` : ""}
                        </>
                      )}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Package className="size-3" />
                        {v.productsCount} produit(s)
                        {v.productsByStatus.ACTIVE
                          ? ` · ${v.productsByStatus.ACTIVE} actifs`
                          : ""}
                        {v.productsByStatus.HIDDEN
                          ? ` · ${v.productsByStatus.HIDDEN} archivés`
                          : ""}
                      </span>
                      <span>{v.ordersCount} commande(s)</span>
                      {v.owner && (
                        <span>
                          Solde {formatMoney(v.owner.walletBalanceCents)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {v.isActive ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 border-destructive/40 text-destructive"
                      disabled={busy}
                      onClick={() => {
                        if (
                          confirm(
                            `Désactiver « ${v.name} » et archiver ses produits actifs ?`,
                          )
                        ) {
                          shopAction(v.id, "deactivate");
                        }
                      }}
                    >
                      <PowerOff className="size-3" />
                      Désactiver
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="gap-1"
                      disabled={busy}
                      onClick={() => shopAction(v.id, "activate")}
                    >
                      <Power className="size-3" />
                      Réactiver
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={busy || v.productsCount === 0}
                    onClick={() => openProductsPanel(v)}
                  >
                    <Package className="size-3" />
                    Produits
                    {v.productsCount ? ` (${v.productsCount})` : ""}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={busy || v.productsCount === 0}
                    onClick={() => openRepublishPicker(v)}
                  >
                    <CheckCircle2 className="size-3" />
                    Republier
                    {v.productsCount ? ` (${v.productsCount})` : ""}
                  </Button>
                  <Link
                    href={`/shop/${v.slug}`}
                    className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium"
                  >
                    Entrer
                  </Link>
                  <Link
                    href={`/publish?shopId=${v.id}`}
                    className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium"
                  >
                    Publier
                  </Link>
                  <Link
                    href={`/shops/products?shopId=${v.id}`}
                    className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium"
                  >
                    Catalogue
                  </Link>
                  {v.owner && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={busy}
                      onClick={() =>
                        resetPassword(
                          v.owner!.id,
                          v.id,
                          `${v.owner!.name} (${v.owner!.email})`,
                        )
                      }
                    >
                      <KeyRound className="size-3" />
                      Reset MDP
                    </Button>
                  )}
                  {v.owner?.kyc?.status === "APPROVED" && v.owner.kyc.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 border-amber-500/40 text-amber-500"
                      disabled={busy}
                      onClick={() => revokeKyc(v.owner!.kyc!.id, v.id)}
                    >
                      <ShieldAlert className="size-3" />
                      Révoquer KYC
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
          {filteredVendors.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucun vendeur
            </p>
          )}
        </ul>
      ) : (
        <ul className="space-y-3">
          {filteredClients.map((c) => {
            const busy = busyId === c.id;
            return (
              <li
                key={c.id}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted/50 text-muted-foreground">
                    <User className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-heading font-bold">{c.name}</p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        Client
                      </span>
                      <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-bold capitalize text-muted-foreground">
                        {c.role}
                      </span>
                      {c.disabledAt && (
                        <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                          Archivé
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {c.email}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {c.ordersCount} commande(s) · Solde{" "}
                      {formatMoney(c.walletBalanceCents)}
                      {c.disabledReason ? ` · ${c.disabledReason}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1"
                    disabled={busy || clientBusy}
                    onClick={() => setEditingClient({ ...c })}
                  >
                    <Pencil className="size-3" />
                    Modifier
                  </Button>
                  {c.disabledAt ? (
                    <Button
                      size="sm"
                      className="gap-1"
                      disabled={busy || clientBusy}
                      onClick={() => unarchiveClient(c)}
                    >
                      <UserCheck className="size-3" />
                      Réactiver
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={busy || clientBusy}
                      onClick={() => archiveClient(c)}
                    >
                      <Archive className="size-3" />
                      Archiver
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      "gap-1",
                      c.canDelete !== false && c.ordersCount === 0
                        ? "border-destructive/40 text-destructive"
                        : "opacity-50",
                    )}
                    disabled={
                      busy ||
                      clientBusy ||
                      (c.canDelete === false && c.ordersCount > 0) ||
                      c.ordersCount > 0
                    }
                    title={
                      c.ordersCount > 0
                        ? "Lié à des commandes — archivez plutôt"
                        : "Supprimer définitivement"
                    }
                    onClick={() => deleteClient(c)}
                  >
                    <Trash2 className="size-3" />
                    Supprimer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={busy || clientBusy}
                    onClick={() =>
                      resetPassword(c.id, c.id, `${c.name} (${c.email})`)
                    }
                  >
                    <KeyRound className="size-3" />
                    Reset MDP
                  </Button>
                </div>
              </li>
            );
          })}
          {filteredClients.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucun client
            </p>
          )}
        </ul>
      )}

      <Dialog
        open={!!republishPicker}
        onOpenChange={(open) => {
          if (!open) setRepublishPicker(null);
        }}
      >
        <DialogContent className="bg-surface max-h-[85vh] overflow-hidden sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Republier des produits</DialogTitle>
            <DialogDescription>
              {republishPicker?.shopName} — tous les produits · cochez 1 ou
              plusieurs
            </DialogDescription>
          </DialogHeader>

          {republishPicker && republishPicker.products.length > 0 ? (
            <div className="space-y-2">
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={toggleAllRepublishProducts}
              >
                {selectedIds.size === republishPicker.products.length
                  ? "Tout désélectionner"
                  : "Tout sélectionner"}
              </button>
              <ul className="max-h-[45vh] space-y-1 overflow-y-auto pr-1">
                {republishPicker.products.map((p) => {
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
                            {formatMoney(p.priceCents)} ·{" "}
                            {STATUS_LABEL[p.status] ?? p.status}
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
              onClick={() => setRepublishPicker(null)}
              disabled={busyId === republishPicker?.shopId}
            >
              Annuler
            </Button>
            <Button
              disabled={
                selectedIds.size === 0 || busyId === republishPicker?.shopId
              }
              onClick={confirmRepublish}
            >
              Republier ({selectedIds.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!productsPanel && !editing}
        onOpenChange={(open) => {
          if (!open) setProductsPanel(null);
        }}
      >
        <DialogContent className="bg-surface max-h-[85vh] overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Produits — {productsPanel?.shopName}</DialogTitle>
            <DialogDescription>
              Modifier · archiver · supprimer
            </DialogDescription>
          </DialogHeader>

          {panelProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun produit
            </p>
          ) : (
            <ul className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {panelProducts.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-border bg-surface-2/40 p-3"
                >
                  <div className="flex gap-3">
                    <div
                      className="size-12 shrink-0 rounded-lg bg-cover bg-center bg-muted"
                      style={
                        p.images?.[0]
                          ? { backgroundImage: `url(${p.images[0]})` }
                          : undefined
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.title}</p>
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
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1"
                      disabled={productBusy}
                      onClick={() => setEditing({ ...p })}
                    >
                      <Pencil className="size-3" />
                      Modifier
                    </Button>
                    {p.status === "ACTIVE" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={productBusy}
                        onClick={() => setProductStatus(p.id, "HIDDEN")}
                      >
                        <Archive className="size-3" />
                        Archiver
                      </Button>
                    )}
                    {(p.status === "HIDDEN" || p.status === "DRAFT") && (
                      <Button
                        size="sm"
                        className="gap-1"
                        disabled={productBusy}
                        onClick={() => setProductStatus(p.id, "ACTIVE")}
                      >
                        <CheckCircle2 className="size-3" />
                        Republier
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
                      disabled={productBusy || !p.canDelete}
                      onClick={() => deleteProduct(p)}
                    >
                      <Trash2 className="size-3" />
                      Supprimer
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-3 font-heading text-lg font-bold">
              Modifier le produit
            </h2>
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
                  <Label>Stock</Label>
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
                  urls={editing.images ?? []}
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
              <Button
                className="flex-[2]"
                disabled={productBusy}
                onClick={saveProduct}
              >
                {productBusy ? "…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {editingClient && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-3 font-heading text-lg font-bold">
              Modifier le client
            </h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nom</Label>
                <Input
                  value={editingClient.name}
                  onChange={(e) =>
                    setEditingClient({
                      ...editingClient,
                      name: e.target.value,
                    })
                  }
                  className="bg-surface-2"
                />
              </div>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={editingClient.email}
                  onChange={(e) =>
                    setEditingClient({
                      ...editingClient,
                      email: e.target.value,
                    })
                  }
                  className="bg-surface-2"
                />
              </div>
              <div className="space-y-1">
                <Label>Téléphone</Label>
                <Input
                  value={editingClient.phone ?? ""}
                  onChange={(e) =>
                    setEditingClient({
                      ...editingClient,
                      phone: e.target.value || null,
                    })
                  }
                  className="bg-surface-2"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setEditingClient(null)}
              >
                Annuler
              </Button>
              <Button
                className="flex-[2]"
                disabled={clientBusy}
                onClick={saveClient}
              >
                {clientBusy ? "…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
