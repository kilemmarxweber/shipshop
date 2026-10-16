"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  KeyRound,
  Package,
  Power,
  PowerOff,
  ShieldAlert,
  Store,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney, cn } from "@/lib/utils";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  status: string;
  priceCents: number;
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
  kyc: { id: string; status: string } | null;
};

type ProductPicker = {
  shopId: string;
  shopName: string;
  action: "hide_products" | "activate_products";
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
  const [picker, setPicker] = useState<ProductPicker | null>(null);
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

  function openProductPicker(
    vendor: Vendor,
    action: "hide_products" | "activate_products",
  ) {
    const status = action === "hide_products" ? "ACTIVE" : "HIDDEN";
    const products = (vendor.products ?? []).filter((p) => p.status === status);
    if (products.length === 0) {
      toast.message(
        action === "activate_products"
          ? "Aucun produit archivé à republier"
          : "Aucun produit actif à archiver",
      );
      return;
    }
    setSelectedIds(new Set());
    setPicker({
      shopId: vendor.id,
      shopName: vendor.name,
      action,
      products,
    });
  }

  function toggleProduct(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllProducts() {
    if (!picker) return;
    setSelectedIds((prev) => {
      if (prev.size === picker.products.length) return new Set();
      return new Set(picker.products.map((p) => p.id));
    });
  }

  async function confirmProductAction() {
    if (!picker || selectedIds.size === 0) {
      toast.error("Sélectionnez au moins un produit");
      return;
    }
    const { shopId, action } = picker;
    setPicker(null);
    await shopAction(shopId, action, Array.from(selectedIds));
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
                    disabled={busy || !(v.productsByStatus.ACTIVE > 0)}
                    onClick={() => openProductPicker(v, "hide_products")}
                  >
                    <Ban className="size-3" />
                    Archiver
                    {v.productsByStatus.ACTIVE
                      ? ` (${v.productsByStatus.ACTIVE})`
                      : ""}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={busy || !(v.productsByStatus.HIDDEN > 0)}
                    onClick={() => openProductPicker(v, "activate_products")}
                  >
                    <CheckCircle2 className="size-3" />
                    Republier
                    {v.productsByStatus.HIDDEN
                      ? ` (${v.productsByStatus.HIDDEN})`
                      : ""}
                  </Button>
                  <Link
                    href={`/shops/admin/products?shopId=${v.id}`}
                    className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium"
                  >
                    Voir produits
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
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {c.email}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {c.ordersCount} commande(s) · Solde{" "}
                      {formatMoney(c.walletBalanceCents)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={busy}
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
        open={!!picker}
        onOpenChange={(open) => {
          if (!open) setPicker(null);
        }}
      >
        <DialogContent className="bg-surface max-h-[85vh] overflow-hidden sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {picker?.action === "activate_products"
                ? "Republier des produits"
                : "Archiver des produits"}
            </DialogTitle>
            <DialogDescription>
              {picker?.shopName} — sélectionnez 1 ou plusieurs produits
            </DialogDescription>
          </DialogHeader>

          {picker && picker.products.length > 0 ? (
            <div className="space-y-2">
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={toggleAllProducts}
              >
                {selectedIds.size === picker.products.length
                  ? "Tout désélectionner"
                  : "Tout sélectionner"}
              </button>
              <ul className="max-h-[45vh] space-y-1 overflow-y-auto pr-1">
                {picker.products.map((p) => {
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
                          onChange={() => toggleProduct(p.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {p.title}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatMoney(p.priceCents)}
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
              onClick={() => setPicker(null)}
              disabled={busyId === picker?.shopId}
            >
              Annuler
            </Button>
            <Button
              disabled={selectedIds.size === 0 || busyId === picker?.shopId}
              onClick={confirmProductAction}
            >
              {picker?.action === "activate_products"
                ? `Republier (${selectedIds.size})`
                : `Archiver (${selectedIds.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
