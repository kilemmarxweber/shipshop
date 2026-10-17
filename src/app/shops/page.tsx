"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Plus, Store, Users } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Shop = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  _count?: { products: number };
};

type Org = { id: string; name: string; slug: string };

type OrgMember = {
  id: string;
  role: string;
  userId: string;
  shopCount: number;
  kind: "vendor" | "buyer";
  isMe?: boolean;
  user: { id: string; name: string; email: string; phone?: string | null };
};

export default function ShopsPage() {
  const { data: session } = authClient.useSession();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>("");
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopName, setShopName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [memberFilter, setMemberFilter] = useState<"all" | "vendor" | "buyer">(
    "all",
  );
  const [isOwner, setIsOwner] = useState(false);
  const [isOrgOwner, setIsOrgOwner] = useState(false);
  const [roleSavingId, setRoleSavingId] = useState<string | null>(null);
  const [resetBusyId, setResetBusyId] = useState<string | null>(null);
  const activatedOrg = useRef<string | null>(null);

  async function loadSeller() {
    const res = await fetch("/api/seller/onboard");
    const json = await res.json();
    if (!res.ok) return;
    if (json.organization) {
      setOrgs([json.organization]);
      setActiveOrgId(json.organization.id);
      if (activatedOrg.current !== json.organization.id) {
        activatedOrg.current = json.organization.id;
        await authClient.organization.setActive({
          organizationId: json.organization.id,
        });
      }
    }
    const kycRes = await fetch("/api/kyc");
    if (kycRes.ok) {
      const kycJson = await kycRes.json();
      setIsOwner(Boolean(kycJson.isOwner));
    }

    if (json.shops?.length) {
      setShops(json.shops);
    } else {
      const mine = await fetch("/api/shops?mine=1");
      const mineJson = await mine.json();
      setShops(mineJson.shops ?? []);
    }

    const membersRes = await fetch("/api/org/members");
    if (membersRes.ok) {
      const membersJson = await membersRes.json();
      const list = (membersJson.members as OrgMember[]) ?? [];
      setMembers(list);
      setIsOrgOwner(Boolean(membersJson.isOwner));
      if (membersJson.isOwner) setIsOwner(true);
    }
  }

  useEffect(() => {
    if (session?.user?.id) loadSeller();
  }, [session?.user?.id]);

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-muted-foreground">Connectez-vous pour gérer vos shops</p>
        <Link
          href="/auth/login"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Connexion
        </Link>
      </div>
    );
  }

  async function createShop() {
    const res = await fetch("/api/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: activeOrgId || undefined,
        name: shopName,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error);
      return;
    }
    toast.success("Boutique créée");
    setShopName("");
    loadSeller();
  }

  async function changeMemberRole(memberId: string, role: string) {
    setRoleSavingId(memberId);
    const res = await fetch("/api/org/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, role }),
    });
    const json = await res.json();
    setRoleSavingId(null);
    if (!res.ok) {
      toast.error(json.error ?? "Rôle non modifié");
      return;
    }
    toast.success("Rôle mis à jour");
    loadSeller();
  }

  async function resetMemberPassword(user: {
    id: string;
    name: string;
    email: string;
  }) {
    if (
      !confirm(
        `Réinitialiser le mot de passe de ${user.name} (${user.email}) et l'envoyer par e-mail + WhatsApp ?`,
      )
    ) {
      return;
    }
    setResetBusyId(user.id);
    const { res, data } = await fetchJson<{
      error?: string;
      temporaryPassword?: string;
      channels?: {
        email?: { ok: boolean; provider?: string; error?: string };
        whatsapp?: { ok: boolean; error?: string };
        sms?: { ok: boolean; provider?: string };
      };
    }>(`/api/admin/users/${user.id}/reset-password`, { method: "POST" });
    setResetBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Reset impossible");
      return;
    }
    toast.success("Mot de passe réinitialisé et envoyé");
    if (data?.temporaryPassword) {
      toast.message(`MDP temporaire : ${data.temporaryPassword}`, {
        duration: 15000,
      });
    }
  }

  async function inviteMember() {
    const role = isOrgOwner ? (inviteRole as "member" | "admin") : "member";
    const { error } = await authClient.organization.inviteMember({
      email: inviteEmail,
      role,
      organizationId: activeOrgId,
    });
    if (error) {
      toast.error(error.message ?? "Invitation échouée");
      return;
    }
    toast.success(`Invitation envoyée à ${inviteEmail}`);
    setInviteEmail("");
  }

  return (
    <div className="px-4 pb-6 pt-0 md:px-8">
      <div className="mb-6 space-y-3">
        <div>
          <h1 className="font-heading text-xl font-bold">Mes boutiques</h1>
          <p className="text-sm text-muted-foreground">
            1 organisation → plusieurs shops
          </p>
        </div>
        <div className="h-scroll h-scroll-fade w-full gap-2">
          <Link
            href="/shops/products"
            className="inline-flex h-7 items-center rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium whitespace-nowrap text-primary-foreground"
          >
            Produits
          </Link>
          <Link
            href="/shops/orders"
            className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium whitespace-nowrap"
          >
            Commandes
          </Link>
          <Link
            href="/shops/reports"
            className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium whitespace-nowrap"
          >
            Rapports
          </Link>
          <Link
            href="/shops/contacts"
            className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium whitespace-nowrap"
          >
            Contacts
          </Link>
          <Link
            href="/shops/delivery"
            className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium whitespace-nowrap"
          >
            Livraison
          </Link>
          {isOwner ? (
            <>
              <Link
                href="/shops/messaging"
                className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium whitespace-nowrap"
              >
                Messages
              </Link>
              <Link
                href="/shops/admin/products"
                className="inline-flex h-7 items-center rounded-lg border border-primary/40 bg-primary/10 px-2.5 text-[0.8rem] font-medium whitespace-nowrap text-primary"
              >
                Produits
              </Link>
              <Link
                href="/shops/admin/vendors"
                className="inline-flex h-7 items-center rounded-lg border border-primary/40 bg-primary/10 px-2.5 text-[0.8rem] font-medium whitespace-nowrap text-primary"
              >
                Vendeurs & clients
              </Link>
              <Link
                href="/shops/admin/delivery"
                className="inline-flex h-7 items-center rounded-lg border border-primary/40 bg-primary/10 px-2.5 text-[0.8rem] font-medium whitespace-nowrap text-primary"
              >
                Zones & livreurs
              </Link>
              <Link
                href="/shops/kyc"
                className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium whitespace-nowrap"
              >
                KYC
              </Link>
              <Link
                href="/shops/admin/moderation"
                className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium whitespace-nowrap"
              >
                NSFW
              </Link>
            </>
          ) : null}
          <Link
            href="/onboarding"
            className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium whitespace-nowrap"
          >
            + Boutique
          </Link>
        </div>
      </div>

      {orgs.length > 0 && (
        <div className="mb-6">
          <Label className="mb-2 block">Organisation active</Label>
          <Select
            value={activeOrgId}
            onValueChange={async (v) => {
              if (!v) return;
              setActiveOrgId(v);
              await authClient.organization.setActive({ organizationId: v });
            }}
          >
            <SelectTrigger className="bg-surface-2">
              <SelectValue placeholder="Choisir" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold">Boutiques</h2>
        <Dialog>
          <DialogTrigger className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground">
            <Plus className="size-4" /> Shop
          </DialogTrigger>
          <DialogContent className="bg-surface">
            <DialogHeader>
              <DialogTitle>Nouvelle boutique</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Nom de la boutique"
                className="bg-surface-2"
              />
              <Button onClick={createShop} className="w-full">
                Créer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {shops.map((shop) => (
          <div
            key={shop.id}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <div className="flex items-start gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                <Store className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{shop.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  /{shop.slug} · {shop._count?.products ?? 0} produits
                </p>
              </div>
            </div>
            <Link
              href={`/publish?shopId=${shop.id}`}
              className="mt-3 inline-flex h-7 w-full items-center justify-center rounded-lg bg-secondary text-[0.8rem] font-medium"
            >
              Publier
            </Link>
          </div>
        ))}
        {shops.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
            Aucune boutique — créez-en une pour publier.
          </p>
        )}
      </div>

      <div className="mt-10">
        <div className="mb-3 flex items-center gap-2">
          <Users className="size-4 text-primary" />
          <h2 className="font-heading text-sm font-semibold">Utilisateurs</h2>
        </div>
        <p className="mb-3 text-[11px] text-muted-foreground">
          {isOwner
            ? "Owner : tous les membres. Vendeurs = ont une boutique · acheteurs = sans boutique."
            : "Vous voyez uniquement votre compte et les personnes que vous avez invitées. Acheteurs / abonnés → Contacts."}
        </p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Tous", members.length],
              [
                "vendor",
                "Vendeurs",
                members.filter((m) => m.kind === "vendor").length,
              ],
              [
                "buyer",
                "Acheteurs",
                members.filter((m) => m.kind === "buyer").length,
              ],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMemberFilter(key)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-[11px] font-semibold",
                memberFilter === key
                  ? "bg-primary text-white"
                  : "bg-muted/40 text-muted-foreground",
              )}
            >
              {label} ({count})
            </button>
          ))}
        </div>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            placeholder="email@exemple.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="bg-surface-2"
          />
          {isOrgOwner ? (
            <Select value={inviteRole} onValueChange={(v) => v && setInviteRole(v)}>
              <SelectTrigger className="w-full bg-surface-2 sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span className="inline-flex h-9 items-center rounded-lg border border-border bg-surface-2 px-3 text-xs text-muted-foreground">
              Rôle : member
            </span>
          )}
          <Button onClick={inviteMember}>Inviter</Button>
        </div>
        {!isOrgOwner ? (
          <p className="mb-4 text-[11px] text-muted-foreground">
            Seul l&apos;owner peut inviter un admin ou changer un rôle.
          </p>
        ) : null}
        <ul className="space-y-2">
          {members
            .filter((m) =>
              memberFilter === "all" ? true : m.kind === memberFilter,
            )
            .map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            >
              <span className="min-w-0">
                {m.user?.name}{" "}
                {m.isMe && (
                  <span className="text-[10px] font-bold text-primary">(vous)</span>
                )}{" "}
                <span className="text-muted-foreground">({m.user?.email})</span>
                <span
                  className={cn(
                    "ml-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                    m.kind === "vendor"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted/50 text-muted-foreground",
                  )}
                >
                  {m.kind === "vendor"
                    ? `Vendeur · ${m.shopCount} boutique${m.shopCount > 1 ? "s" : ""}`
                    : "Acheteur"}
                </span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {isOwner ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    disabled={resetBusyId === m.user.id}
                    onClick={() => resetMemberPassword(m.user)}
                  >
                    <KeyRound className="size-3" />
                    Reset MDP
                  </Button>
                ) : null}
                {isOrgOwner && m.role !== "owner" ? (
                  <Select
                    value={m.role}
                    onValueChange={(v) => {
                      if (v && v !== m.role) changeMemberRole(m.id, v);
                    }}
                    disabled={roleSavingId === m.id}
                  >
                    <SelectTrigger className="h-8 w-32 bg-surface-2 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="rounded-md bg-muted/40 px-2 py-0.5 text-xs capitalize">
                    {m.role}
                  </span>
                )}
              </div>
            </li>
          ))}
          {members.filter((m) =>
            memberFilter === "all" ? true : m.kind === memberFilter,
          ).length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {memberFilter === "vendor"
                ? "Aucun vendeur"
                : memberFilter === "buyer"
                  ? "Aucun acheteur"
                  : "Aucun utilisateur"}
            </p>
          )}
        </ul>
      </div>
    </div>
  );
}
