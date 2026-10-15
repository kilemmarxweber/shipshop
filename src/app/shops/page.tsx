"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Store, Users } from "lucide-react";
import { authClient } from "@/lib/auth-client";
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

export default function ShopsPage() {
  const { data: session } = authClient.useSession();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>("");
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopName, setShopName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [members, setMembers] = useState<
    { id: string; role: string; user: { name: string; email: string } }[]
  >([]);

  async function loadSeller() {
    const res = await fetch("/api/seller/onboard");
    const json = await res.json();
    if (!res.ok) return;
    if (json.organization) {
      setOrgs([json.organization]);
      setActiveOrgId(json.organization.id);
      await authClient.organization.setActive({
        organizationId: json.organization.id,
      });
    }
    const mine = await fetch("/api/shops?mine=1");
    const mineJson = await mine.json();
    setShops(mineJson.shops ?? json.shops ?? []);

    if (json.organization?.id) {
      const { data } = await authClient.organization.listMembers({
        query: { organizationId: json.organization.id },
      });
      setMembers((data?.members as typeof members) ?? []);
    }
  }

  useEffect(() => {
    if (session) loadSeller();
  }, [session]);

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

  async function inviteMember() {
    const { error } = await authClient.organization.inviteMember({
      email: inviteEmail,
      role: inviteRole as "member" | "admin",
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold">Mes boutiques</h1>
          <p className="text-sm text-muted-foreground">
            1 organisation → plusieurs shops
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/shops/products"
            className="inline-flex h-7 items-center rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground"
          >
            Produits
          </Link>
          <Link
            href="/shops/orders"
            className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium"
          >
            Commandes
          </Link>
          <Link
            href="/shops/messaging"
            className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium"
          >
            Messages
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium"
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
            <SelectTrigger className="bg-[#1c1c26]">
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
          <DialogContent className="bg-[#13131a]">
            <DialogHeader>
              <DialogTitle>Nouvelle boutique</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Nom de la boutique"
                className="bg-[#1c1c26]"
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
            className="rounded-2xl border border-white/8 bg-[#13131a] p-4"
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
          <h2 className="font-heading text-sm font-semibold">Équipe & invitations</h2>
        </div>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            placeholder="email@exemple.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="bg-[#1c1c26]"
          />
          <Select value={inviteRole} onValueChange={(v) => v && setInviteRole(v)}>
            <SelectTrigger className="w-full bg-[#1c1c26] sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={inviteMember}>Inviter</Button>
        </div>
        <ul className="space-y-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-white/8 bg-[#13131a] px-3 py-2 text-sm"
            >
              <span>
                {m.user?.name}{" "}
                <span className="text-muted-foreground">({m.user?.email})</span>
              </span>
              <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs capitalize">
                {m.role}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
