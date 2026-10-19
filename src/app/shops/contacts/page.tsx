"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Heart,
  Mail,
  Phone,
  ShoppingBag,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  downloadContactsExcel,
  downloadContactsPdf,
  type ExportContact,
} from "@/lib/export-contacts";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney, cn } from "@/lib/utils";
import { PageLoader } from "@/components/page-loader";
import { ShopPicker } from "@/components/shop-picker";
import { Button } from "@/components/ui/button";

type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  kind: "buyer" | "follower" | "invitee" | "self";
  shopName?: string | null;
  productTitles?: string[];
  ordersCount?: number;
  totalSpentCents?: number;
  followedAt?: string | null;
  inviteStatus?: string | null;
  invitedAt?: string | null;
};

type Tab = "buyers" | "followers" | "invitees";

export default function ShopContactsPage() {
  const { data: session } = authClient.useSession();
  const [tab, setTab] = useState<Tab>("buyers");
  const [shopId, setShopId] = useState("");
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [buyers, setBuyers] = useState<Contact[]>([]);
  const [followers, setFollowers] = useState<Contact[]>([]);
  const [invitees, setInvitees] = useState<Contact[]>([]);
  const [self, setSelf] = useState<Contact | null>(null);

  async function load(selectedShop = shopId) {
    const q = selectedShop
      ? `?shopId=${encodeURIComponent(selectedShop)}`
      : "";
    const { res, data } = await fetchJson<{
      shops?: { id: string; name: string }[];
      buyers?: Contact[];
      followers?: Contact[];
      invitees?: Contact[];
      self?: Contact | null;
      error?: string;
    }>(`/api/shops/contacts${q}`);
    if (!res.ok) {
      toast.error(data?.error ?? "Impossible de charger les contacts");
      setBuyers([]);
      setFollowers([]);
      setInvitees([]);
      return;
    }
    setShops(data?.shops ?? []);
    setBuyers(data?.buyers ?? []);
    setFollowers(data?.followers ?? []);
    setInvitees(data?.invitees ?? []);
    setSelf(data?.self ?? null);
  }

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [session?.user?.id]);

  const list = useMemo(() => {
    if (tab === "buyers") return buyers;
    if (tab === "followers") return followers;
    return invitees;
  }, [tab, buyers, followers, invitees]);

  const exportRows: ExportContact[] = useMemo(
    () =>
      list.map((c) => ({
        name: c.name,
        email: c.email,
        phone: c.phone,
        kind:
          c.kind === "buyer"
            ? "Acheteur"
            : c.kind === "follower"
              ? "Abonné"
              : c.inviteStatus === "pending"
                ? "Invitation en attente"
                : "Invité",
        extra:
          c.kind === "buyer"
            ? `${c.ordersCount ?? 0} cmd · ${formatMoney(c.totalSpentCents ?? 0)} · ${(c.productTitles ?? []).join(", ")}`
            : c.kind === "follower"
              ? c.shopName
                ? `Abonné · ${c.shopName}`
                : "Abonné"
              : c.inviteStatus ?? "",
      })),
    [list],
  );

  function exportExcel() {
    if (exportRows.length === 0) {
      toast.message("Aucune ligne à exporter");
      return;
    }
    const label =
      tab === "buyers"
        ? "acheteurs"
        : tab === "followers"
          ? "abonnes"
          : "invites";
    downloadContactsExcel(`contacts-${label}`, exportRows);
    toast.success("Export Excel (CSV) téléchargé");
  }

  function exportPdf() {
    if (exportRows.length === 0) {
      toast.message("Aucune ligne à exporter");
      return;
    }
    const title =
      tab === "buyers"
        ? "Acheteurs de mes produits"
        : tab === "followers"
          ? "Abonnés boutique"
          : "Invitations";
    const ok = downloadContactsPdf(title, exportRows);
    if (!ok) {
      toast.error("Autorisez les pop-ups pour l'export PDF");
      return;
    }
    toast.success("Fenêtre PDF ouverte — utilisez Imprimer → PDF");
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

  if (loading) return <PageLoader />;

  return (
    <div className="px-4 pb-8 pt-0 md:px-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold">Contacts boutique</h1>
          <p className="text-xs text-muted-foreground">
            Acheteurs de vos produits · abonnés · personnes que vous avez
            invitées
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={exportExcel}
            disabled={list.length === 0}
          >
            <FileSpreadsheet className="size-3" />
            Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={exportPdf}
            disabled={list.length === 0}
          >
            <FileText className="size-3" />
            PDF
          </Button>
        </div>
      </div>

      <ShopPicker
        className="mb-4 max-w-xs"
        shops={shops}
        value={shopId}
        allLabel="Toutes mes boutiques"
        onChange={(id) => {
          setShopId(id);
          setLoading(true);
          load(id).finally(() => setLoading(false));
        }}
      />

      {self && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <Users className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {self.name}{" "}
              <span className="text-[10px] font-bold text-primary">(vous)</span>
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {self.email}
              {self.phone ? ` · ${self.phone}` : ""}
            </p>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {(
          [
            ["buyers", "Acheteurs", buyers.length, ShoppingBag],
            ["followers", "Abonnés", followers.length, Heart],
            ["invitees", "Invités", invitees.length, UserPlus],
          ] as const
        ).map(([key, label, count, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold",
              tab === key
                ? "bg-primary text-white"
                : "bg-muted/40 text-muted-foreground",
            )}
          >
            <Icon className="size-3" />
            {label} ({count})
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {list.map((c) => (
          <li
            key={`${c.kind}-${c.id}-${c.email}`}
            className="rounded-2xl border border-border bg-surface p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Mail className="size-3" />
                    {c.email}
                  </span>
                  {c.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3" />
                      {c.phone}
                    </span>
                  )}
                </p>
                {c.kind === "buyer" && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {c.ordersCount ?? 0} commande(s) ·{" "}
                    {formatMoney(c.totalSpentCents ?? 0)}
                    {c.productTitles && c.productTitles.length > 0
                      ? ` · ${c.productTitles.join(", ")}`
                      : ""}
                  </p>
                )}
                {c.kind === "follower" && c.shopName && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Abonné à {c.shopName}
                  </p>
                )}
                {c.kind === "invitee" && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Statut : {c.inviteStatus ?? "—"}
                  </p>
                )}
              </div>
              {c.phone && (
                <a
                  href={`tel:${c.phone}`}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border"
                  aria-label="Appeler"
                >
                  <Phone className="size-3.5" />
                </a>
              )}
            </div>
          </li>
        ))}
        {list.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {tab === "buyers"
              ? "Aucun acheteur pour vos produits"
              : tab === "followers"
                ? "Personne ne s'est encore abonné"
                : "Aucune invitation envoyée"}
          </p>
        )}
      </ul>

      {list.length > 0 && (
        <p className="mt-4 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Download className="size-3" />
          Excel = fichier CSV (ouvre dans Excel) · PDF = Imprimer → Enregistrer
          en PDF
        </p>
      )}
    </div>
  );
}
