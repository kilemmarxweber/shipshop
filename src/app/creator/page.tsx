"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney } from "@/lib/utils";
import { PageLoader } from "@/components/page-loader";
import { usePageBack } from "@/components/back-nav-context";
import { AccountBadges, type BadgeRow } from "@/components/growth/account-badges";
import { GoLiveCard } from "@/components/live/go-live-card";

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
  usePageBack({ fallbackHref: "/profile" });
  const [me, setMe] = useState<Me | null>(null);
  const [gifts, setGifts] = useState<GiftRow[]>([]);

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

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-5">
      <div>
        <h1 className="font-heading text-xl font-bold">Studio créateur</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {me?.isPlatformOwner
            ? "Owner plateforme : live, cadeaux et pub sans seuil d’abonnés."
            : `${me?.subscribers ?? 0} abonnés · cadeaux et pub rémunérée avec le badge Influenceur.`}
        </p>
      </div>
      {me ? <AccountBadges badges={me.badges} /> : null}
      {!me?.kycApproved && !me?.isPlatformOwner ? (
        <Link href="/kyc" className="block text-xs font-semibold text-primary">
          Vérifiez votre identité (KYC) pour monétiser
        </Link>
      ) : null}

      <GoLiveCard variant="studio" />

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
