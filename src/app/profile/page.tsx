"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Camera,
  LogOut,
  Pencil,
  Phone,
  ShoppingCart,
  Store,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  mediaUploadToastMessage,
  uploadCompressedMedia,
} from "@/lib/compress-media";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppearanceSettings } from "@/components/appearance-settings";
import { useI18n } from "@/components/i18n-provider";

type Order = {
  id: string;
  amountCents: number;
  totalCents?: number;
  shippingCents?: number;
  status: string;
  fulfillmentType?: string;
  createdAt: string;
  product: { title: string; images: string[] };
  shop: { name: string };
};

type ProfileUser = {
  name: string;
  email: string;
  phone: string | null;
  image: string | null;
};

type Period = "7d" | "30d" | "90d" | "all";
type Tab = "active" | "history";
type KycStatus = "NONE" | "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
type KycSummary = {
  status: KycStatus;
  rejectReason: string | null;
};

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export default function ProfilePage() {
  const { data: session } = authClient.useSession();
  const { t } = useI18n();
  const userId = session?.user?.id;
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"buyer" | "seller">("buyer");
  const [orders, setOrders] = useState<Order[]>([]);
  const [balance, setBalance] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("30d");
  const [tab, setTab] = useState<Tab>("active");
  const [kyc, setKyc] = useState<KycSummary | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  function applyProfile(user: ProfileUser) {
    setProfile(user);
    setNameDraft(user.name);
    setEmailDraft(user.email);
    setPhoneDraft(user.phone ?? "");
  }

  async function refresh() {
    const [ordersRes, walletRes, cartRes, profileRes, kycRes] =
      await Promise.all([
        fetchJson<{ orders?: Order[]; error?: string }>(
          `/api/orders?period=${period}&status=${tab}`,
        ),
        fetchJson<{ wallet?: { balanceCents?: number } }>("/api/wallet"),
        fetchJson<{ count?: number }>("/api/cart"),
        fetchJson<{ user?: ProfileUser }>("/api/profile"),
        fetchJson<{ kyc?: KycSummary | null; isOwner?: boolean }>("/api/kyc"),
      ]);
    setOrders(ordersRes.data?.orders ?? []);
    setBalance(walletRes.data?.wallet?.balanceCents ?? 0);
    setCartCount(cartRes.data?.count ?? 0);
    if (profileRes.data?.user) {
      applyProfile(profileRes.data.user);
    }
    setKyc(kycRes.data?.kyc ?? null);
    setIsOwner(Boolean(kycRes.data?.isOwner));
  }

  useEffect(() => {
    if (!userId) return;
    refresh().catch(() => {
      setOrders([]);
      setBalance(0);
      setCartCount(0);
    });
  }, [userId, period, tab]);

  async function syncSessionUser(patch: {
    name?: string;
    image?: string | null;
  }) {
    try {
      await authClient.updateUser(patch);
    } catch {
      // la DB est à jour même si la session cookie n'a pas sync
    }
  }

  async function onAvatarPick(file: File | undefined) {
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type) && !file.type.startsWith("image/")) {
      toast.error("Choisissez une image (JPG, PNG, WebP…)");
      return;
    }
    setUploadingAvatar(true);
    try {
      const uploaded = await uploadCompressedMedia(file, "avatar");
      if (uploaded.kind !== "image") {
        toast.error("Seules les images sont acceptées pour le profil");
        return;
      }

      const { res, data } = await fetchJson<{
        error?: string;
        user?: ProfileUser;
      }>("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: uploaded.url }),
      });
      if (!res.ok || !data?.user) {
        toast.error(data?.error ?? "Enregistrement impossible");
        return;
      }
      applyProfile(data.user);
      await syncSessionUser({ image: data.user.image });
      toast.success("Photo de profil enregistrée");
    } catch (error) {
      toast.error(mediaUploadToastMessage(error, t));
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveProfile() {
    const name = nameDraft.trim();
    const email = emailDraft.trim().toLowerCase();
    const phone = phoneDraft.trim();
    if (name.length < 2) {
      toast.error("Nom trop court");
      return;
    }
    if (!email.includes("@")) {
      toast.error("E-mail invalide");
      return;
    }
    if (phone && phone.length < 9) {
      toast.error("Téléphone trop court");
      return;
    }

    setSavingProfile(true);
    const { res, data } = await fetchJson<{
      error?: string;
      user?: ProfileUser;
    }>("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        phone: phone || null,
      }),
    });
    setSavingProfile(false);
    if (!res.ok || !data?.user) {
      toast.error(data?.error ?? "Échec enregistrement");
      return;
    }
    applyProfile(data.user);
    await syncSessionUser({ name: data.user.name });
    setEditing(false);
    toast.success("Profil mis à jour");
  }

  async function cancelOrder(orderId: string) {
    setCancellingId(orderId);
    const { res, data } = await fetchJson<{
      error?: string;
      balanceCents?: number;
    }>(`/api/orders/${orderId}`, { method: "DELETE" });
    setCancellingId(null);

    if (!res.ok) {
      toast.error(data?.error ?? "Annulation impossible");
      return;
    }
    toast.success("Commande annulée — remboursement effectué");
    if (typeof data?.balanceCents === "number") {
      setBalance(data.balanceCents);
    }
    await refresh();
  }

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="font-heading text-lg font-bold">Votre profil Chip Shop</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Compte obligatoire pour acheter et vendre
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/auth/login"
            className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Connexion
          </Link>
          <Link
            href="/auth/register"
            className="inline-flex h-9 items-center rounded-lg bg-secondary px-4 text-sm font-medium"
          >
            S&apos;inscrire
          </Link>
        </div>
      </div>
    );
  }

  const displayName = profile?.name ?? session.user.name ?? "Utilisateur";
  const displayEmail = profile?.email ?? session.user.email ?? "";
  const displayPhone = profile?.phone ?? "";
  const displayImage = profile?.image ?? session.user.image ?? null;
  const kycStatus = kyc?.status ?? "NONE";
  const isPro = kycStatus === "APPROVED";

  return (
    <div className="px-4 pb-6 pt-0 md:px-8">
      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            if (displayImage) setZoomOpen(true);
          }}
          className={cn(
            "relative mx-auto mb-3 grid size-20 place-items-center overflow-hidden rounded-full border-2 border-border bg-gradient-to-br from-primary to-violet-600 font-heading text-2xl font-bold transition",
            displayImage
              ? "cursor-zoom-in hover:opacity-90"
              : "cursor-default",
          )}
          aria-label={
            displayImage ? "Agrandir la photo de profil" : "Photo de profil"
          }
        >
          {displayImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayImage}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            displayName.slice(0, 1).toUpperCase()
          )}
        </button>

        <div className="flex items-start justify-center gap-2">
          <div className="min-w-0">
            <h1 className="flex items-center justify-center gap-1.5 font-heading text-lg font-bold">
              {displayName}
              {isPro ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-trust/20 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-trust">
                  <BadgeCheck className="size-3" />
                  PRO
                </span>
              ) : null}
            </h1>
            <p className="text-xs text-muted-foreground">{displayEmail}</p>
            <p className="mt-0.5 flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Phone className="size-3 shrink-0" />
              {displayPhone || "Aucun téléphone"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing((v) => !v);
              if (profile) {
                setNameDraft(profile.name);
                setEmailDraft(profile.email);
                setPhoneDraft(profile.phone ?? "");
              }
            }}
            className="mt-0.5 grid size-8 cursor-pointer place-items-center rounded-full border border-border bg-muted/40 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Modifier le profil"
          >
            <Pencil className="size-3.5" />
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-4 space-y-2.5 rounded-2xl border border-border bg-surface p-3 text-left">
          <p className="text-[11px] font-semibold text-muted-foreground">
            Modifier photo, nom, e-mail et contact
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onAvatarPick(e.target.files?.[0])}
          />
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-2.5">
            <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-violet-600 text-sm font-bold">
              {displayImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayImage}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                displayName.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">Photo de profil</p>
              <p className="text-[10px] text-muted-foreground">
                JPG, PNG, WebP
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploadingAvatar}
              className="h-9 shrink-0 cursor-pointer gap-1.5"
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="size-3.5" />
              {uploadingAvatar ? "…" : "Parcourir"}
            </Button>
          </div>
          <Input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="Nom"
            className="h-10 bg-surface-2"
          />
          <Input
            type="email"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            placeholder="E-mail"
            className="h-10 bg-surface-2"
          />
          <Input
            value={phoneDraft}
            onChange={(e) => setPhoneDraft(e.target.value)}
            placeholder="+243 8XX XXX XXX"
            className="h-10 bg-surface-2"
          />
          <div className="flex gap-2 pt-1">
            <Button
              variant="ghost"
              className="h-9 flex-1 cursor-pointer"
              disabled={savingProfile || uploadingAvatar}
              onClick={() => setEditing(false)}
            >
              Annuler
            </Button>
            <Button
              className="h-9 flex-1 cursor-pointer"
              disabled={savingProfile || uploadingAvatar}
              onClick={saveProfile}
            >
              {savingProfile ? "…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      )}

      {zoomOpen && displayImage && (
        <button
          type="button"
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setZoomOpen(false)}
          aria-label="Fermer l'aperçu"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayImage}
            alt={displayName}
            className="max-h-[85dvh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </button>
      )}

      <div
        className={cn(
          "mt-4 rounded-2xl border p-3 text-left",
          isPro
            ? "border-trust/30 bg-trust/10"
            : kycStatus === "PENDING"
              ? "border-amber-500/30 bg-amber-500/10"
              : kycStatus === "REJECTED"
                ? "border-destructive/30 bg-destructive/10"
                : "border-border bg-surface",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "grid size-9 place-items-center rounded-full",
              isPro
                ? "bg-trust text-trust-foreground"
                : kycStatus === "PENDING"
                  ? "bg-amber-500/20 text-amber-400"
                  : kycStatus === "REJECTED"
                    ? "bg-destructive/20 text-destructive"
                    : "bg-white/10 text-muted-foreground",
            )}
          >
            <BadgeCheck className="size-5" />
          </div>
          <div className="min-w-0 flex-1 text-xs">
            {isPro ? (
              <>
                <p className="font-bold text-trust">Vendeur pro vérifié</p>
                <p className="text-muted-foreground">Badge PRO actif</p>
              </>
            ) : kycStatus === "PENDING" ? (
              <>
                <p className="font-bold text-amber-400">Dossier en revue</p>
                <p className="text-muted-foreground">
                  L&apos;équipe Chip Shop examine vos documents
                </p>
              </>
            ) : kycStatus === "REJECTED" ? (
              <>
                <p className="font-bold text-destructive">Dossier refusé</p>
                <p className="text-muted-foreground">
                  {kyc?.rejectReason || "Corrigez et renvoyez votre dossier"}
                </p>
                <Link
                  href="/kyc"
                  className="mt-1 inline-block font-semibold text-primary"
                >
                  Corriger et renvoyer
                </Link>
              </>
            ) : (
              <>
                <p className="font-bold">Devenir vendeur pro</p>
                <p className="text-muted-foreground">
                  Vérifiez votre identité pour le badge PRO
                </p>
                <Link
                  href="/kyc"
                  className="mt-1 inline-block font-semibold text-primary"
                >
                  Commencer la vérification
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl border border-border bg-surface p-1">
        {(
          [
            ["buyer", "Achats"],
            ["seller", "Vendeur"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={cn(
              "col-span-2 rounded-xl py-2.5 text-xs font-semibold",
              mode === key
                ? "bg-gradient-to-r from-[#ff5722] to-[#ff7a45] text-white"
                : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Link
          href="/wallet"
          className="rounded-2xl border border-border bg-surface p-3"
        >
          <Wallet className="mb-1 size-4 text-trust" />
          <p className="font-heading text-lg font-extrabold">
            {formatMoney(balance)}
          </p>
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
            Solde
          </p>
        </Link>
        <Link
          href="/cart"
          className="rounded-2xl border border-border bg-surface p-3"
        >
          <ShoppingCart className="mb-1 size-4 text-primary" />
          <p className="font-heading text-lg font-extrabold">{cartCount}</p>
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
            Panier
          </p>
        </Link>
        <Link
          href={mode === "seller" ? "/shops/orders" : "/profile"}
          className="rounded-2xl border border-border bg-surface p-3"
        >
          <Store className="mb-1 size-4 text-amber-400" />
          <p className="font-heading text-lg font-extrabold">
            {mode === "seller" ? "CMD" : orders.length}
          </p>
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
            {mode === "seller" ? "Boutique" : "Commandes"}
          </p>
        </Link>
      </div>

      {mode === "buyer" ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-sm font-bold">Mes commandes</h2>
            <Link href="/cart" className="text-xs font-semibold text-primary">
              Voir le panier
            </Link>
          </div>

          <div className="mb-3 flex gap-1 rounded-xl border border-border bg-surface p-1">
            {(
              [
                ["active", "En cours"],
                ["history", "Historique"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "flex-1 rounded-lg py-2 text-xs font-semibold",
                  tab === key
                    ? "bg-white/10 text-white"
                    : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="h-scroll mb-3 gap-1.5">
            {(
              [
                ["7d", "7 j"],
                ["30d", "30 j"],
                ["90d", "90 j"],
                ["all", "Tout"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
                  period === key
                    ? "bg-primary text-white"
                    : "bg-muted/40 text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <ul className="space-y-2">
            {orders.map((o) => {
              const canCancel =
                o.status !== "DELIVERED" &&
                o.status !== "PICKED_UP" &&
                o.status !== "AWAITING_CONFIRM" &&
                o.status !== "CANCELLED" &&
                o.status !== "REFUNDED" &&
                (o.status === "PAID" ||
                  o.status === "ASSIGNED" ||
                  o.status === "FULFILLING" ||
                  o.status === "READY_FOR_PICKUP");
              const total = o.totalCents ?? o.amountCents;
              return (
                <li
                  key={o.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
                >
                  <Link href={`/orders/${o.id}`} className="contents">
                    <div
                      className="size-11 rounded-xl bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${o.product.images[0]})`,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {o.product.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {o.shop.name} · {formatMoney(total)}
                        {o.fulfillmentType === "DELIVERY"
                          ? " · Livraison"
                          : o.fulfillmentType === "PICKUP"
                            ? " · Retrait"
                            : ""}
                      </p>
                    </div>
                  </Link>
                  <div className="flex flex-col items-end gap-1.5">
                    <Link
                      href={`/orders/${o.id}`}
                      className={cn(
                        "rounded-lg px-2 py-1 text-[10px] font-bold",
                        o.status === "PAID" && "bg-amber-500/15 text-amber-400",
                        o.status === "DELIVERED" && "bg-trust/15 text-trust",
                        o.status === "PICKED_UP" && "bg-trust/15 text-trust",
                        o.status === "FULFILLING" &&
                          "bg-primary/15 text-primary",
                        o.status === "OUT_FOR_DELIVERY" &&
                          "bg-primary/15 text-primary",
                        o.status === "ASSIGNED" && "bg-primary/15 text-primary",
                        o.status === "READY_FOR_PICKUP" &&
                          "bg-amber-500/15 text-amber-400",
                        o.status === "AWAITING_CONFIRM" &&
                          "bg-amber-500/15 text-amber-400",
                        o.status === "FAILED" &&
                          "bg-destructive/15 text-destructive",
                        o.status === "REFUNDED" &&
                          "bg-muted/40 text-muted-foreground",
                        o.status === "CANCELLED" &&
                          "bg-muted/40 text-muted-foreground",
                      )}
                    >
                      {o.status}
                    </Link>
                    {canCancel && tab === "active" && (
                      <button
                        type="button"
                        disabled={cancellingId === o.id}
                        onClick={() => cancelOrder(o.id)}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                        {cancellingId === o.id ? "…" : "Annuler"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
            {orders.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucune commande
              </p>
            )}
          </ul>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {(
            [
              ["/shops/products", "Mes produits (prix, stock…)"],
              ["/shops/orders", "Commandes & livreurs"],
              ["/shops/reports", "Rapports & statistiques"],
              ["/shops/contacts", "Contacts (acheteurs, abonnés, invités)"],
              ...(isOwner
                ? ([
                    ["/shops/messaging", "Messages (admin)"],
                    ["/shops/admin/products", "Modération produits (tout)"],
                    ["/shops/admin/vendors", "Vendeurs & clients"],
                    ["/shops/kyc", "Revue KYC"],
                    ["/shops/admin/moderation", "Modération NSFW"],
                  ] as const)
                : []),
              ["/shops", "Mes boutiques"],
              ["/publish", "Publier un produit"],
              ["/onboarding", "Créer une boutique"],
            ] as const
          ).map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-surface text-sm font-medium text-foreground no-underline transition-colors duration-150 hover:border-primary/40 hover:bg-muted/60 hover:text-foreground active:bg-muted"
            >
              {label}
            </Link>
          ))}
        </div>
      )}

      <AppearanceSettings />

      <Button
        variant="ghost"
        className="mt-8 w-full gap-2 text-muted-foreground"
        onClick={() => authClient.signOut()}
      >
        <LogOut className="size-4" />
        {t("settings.logout")}
      </Button>
    </div>
  );
}
