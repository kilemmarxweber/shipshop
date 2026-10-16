"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Ban,
  CheckCircle2,
  KeyRound,
  Package,
  Power,
  PowerOff,
  ShieldAlert,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney, cn } from "@/lib/utils";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Vendor = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  productsCount: number;
  ordersCount: number;
  productsByStatus: Record<string, number>;
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

export default function AdminVendorsPage() {
  const { data: session } = authClient.useSession();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { res, data } = await fetchJson<{
      vendors?: Vendor[];
      error?: string;
    }>("/api/admin/vendors");
    if (res.status === 403) {
      setAllowed(false);
      setVendors([]);
      return;
    }
    setAllowed(true);
    setVendors(data?.vendors ?? []);
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
  ) {
    setBusyId(shopId);
    const { res, data } = await fetchJson<{ error?: string }>(
      "/api/admin/vendors",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, action }),
      },
    );
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Action impossible");
      return;
    }
    toast.success(
      action === "activate"
        ? "Boutique réactivée"
        : action === "deactivate"
          ? "Boutique désactivée — produits archivés"
          : action === "hide_products"
            ? "Produits archivés"
            : "Produits republiés",
    );
    load();
  }

  async function revokeKyc(kycId: string, shopId: string) {
    const reason = prompt("Motif de révocation KYC ?")?.trim();
    if (!reason) return;
    setBusyId(shopId);
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

  async function resetPassword(userId: string, shopId: string, label: string) {
    if (
      !confirm(
        `Réinitialiser le mot de passe de ${label} et l'envoyer par e-mail + WhatsApp ?`,
      )
    ) {
      return;
    }
    setBusyId(shopId);
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

  const filtered = vendors.filter((v) => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return (
      v.name.toLowerCase().includes(s) ||
      v.slug.toLowerCase().includes(s) ||
      (v.owner?.name ?? "").toLowerCase().includes(s) ||
      (v.owner?.email ?? "").toLowerCase().includes(s)
    );
  });

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
        <h1 className="font-heading text-xl font-bold">Vendeurs</h1>
        <p className="text-xs text-muted-foreground">
          {vendors.length} boutique(s) · activer / désactiver · KYC · produits
        </p>
      </div>

      <div className="mb-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrer nom, slug, email…"
          className="bg-surface-2"
        />
      </div>

      <ul className="space-y-3">
        {filtered.map((v) => {
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
                  disabled={busy}
                  onClick={() => shopAction(v.id, "hide_products")}
                >
                  <Ban className="size-3" />
                  Archiver produits
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={busy}
                  onClick={() => shopAction(v.id, "activate_products")}
                >
                  <CheckCircle2 className="size-3" />
                  Republier produits
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

                {v.owner?.kyc?.status === "PENDING" && (
                  <Link
                    href="/shops/kyc"
                    className="inline-flex h-8 items-center rounded-lg bg-amber-500/15 px-3 text-xs font-bold text-amber-500"
                  >
                    Revue KYC
                  </Link>
                )}
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucun vendeur
          </p>
        )}
      </ul>
    </div>
  );
}
