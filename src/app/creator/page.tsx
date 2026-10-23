"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/page-loader";
import { usePageBack } from "@/components/back-nav-context";
import { AccountBadges, type BadgeRow } from "@/components/growth/account-badges";

type Me = {
  badges: BadgeRow[];
  subscribers: number;
  kycApproved: boolean;
  isPlatformOwner?: boolean;
};

type GiftRow = {
  id: string;
  kind: string;
  amountCents: number;
  from: { name: string };
};

export default function CreatorStudioPage() {
  const { data: session, isPending } = authClient.useSession();
  usePageBack({ fallbackHref: "/community" });
  const [me, setMe] = useState<Me | null>(null);
  const [gifts, setGifts] = useState<GiftRow[]>([]);
  const [title, setTitle] = useState("Live shopping");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    void fetchJson<Me>("/api/growth/me").then(({ data }) => {
      if (data) setMe(data);
    });
    void fetchJson<{ received?: GiftRow[] }>("/api/growth/gifts").then(
      ({ data }) => setGifts(data?.received ?? []),
    );
  }, [session?.user?.id]);

  if (isPending) return <PageLoader />;
  if (!session) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        Connectez-vous pour le studio créateur.
      </p>
    );
  }

  const influencer = me?.badges.some((b) => b.kind === "INFLUENCER" && b.active);
  const canGoLive = Boolean(influencer || me?.isPlatformOwner);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-5">
      <h1 className="font-heading text-xl font-bold">Studio créateur</h1>
      <p className="text-sm text-muted-foreground">
        {me?.isPlatformOwner
          ? "Owner plateforme : accès total au live, cadeaux et pub (sans seuil d’abonnés)."
          : `${me?.subscribers ?? 0} / 2000 abonnés pour le live, les cadeaux et la pub rémunérée.`}
      </p>
      {me ? <AccountBadges badges={me.badges} /> : null}
      {!me?.kycApproved && !me?.isPlatformOwner ? (
        <Link href="/kyc" className="block text-xs font-semibold text-primary">
          Vérifiez votre identité (KYC) pour monétiser
        </Link>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-bold">Lancer un live</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {me?.isPlatformOwner
            ? "Accès owner : lancez un live quand vous voulez."
            : "Réservé au Badge Influenceur. Promouvez un produit, recevez des cadeaux, soyez payé."}
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-surface-2"
          />
          <Button
            disabled={busy || !canGoLive}
            onClick={async () => {
              setBusy(true);
              const { res, data } = await fetchJson<{
                live?: { id: string };
                error?: string;
              }>("/api/growth/lives", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: title.trim() }),
              });
              setBusy(false);
              if (!res.ok || !data?.live) {
                toast.error(data?.error ?? "Live impossible");
                return;
              }
              window.location.href = `/live/${data.live.id}`;
            }}
          >
            Go live
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-bold">Cadeaux reçus</h2>
        {gifts.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Aucun cadeau encore.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs">
            {gifts.map((g) => (
              <li key={g.id} className="flex justify-between">
                <span>
                  {g.from.name} · {g.kind}
                </span>
                <span className="text-trust">{formatMoney(g.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
