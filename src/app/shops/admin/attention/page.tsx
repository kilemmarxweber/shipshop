"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowLeft, ShieldAlert } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney } from "@/lib/utils";
import { PageLoader } from "@/components/page-loader";
import { usePageBack } from "@/components/back-nav-context";

type Guard = { value: number; status: "ok" | "watch" | "risk"; threshold: number };

type Kpis = {
  periodDays: number;
  attention: {
    avgDwellMs: number;
    sessions7: number;
    sessions30: number;
    retentionJ7: number;
    retentionJ30: number;
  };
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    follows: number;
    interactionRate: number;
    missionCompletionRate: number;
  };
  business: {
    adRevenueCents: number;
    revenuePer1000Sessions: number;
    sponsoredCtr: number;
    postEngagementConversion: number;
    campaignBudgetCents: number;
    giftGmvCents: number;
    giftCount: number;
    orders: number;
  };
  quality: { rejects: number; hideRate: number };
  creators: { activeBadges: number; influencerBadges: number };
  guards: Record<string, Guard>;
};

function pct(n: number) {
  return `${(n * 100).toFixed(1)} %`;
}

function statusTone(status: Guard["status"]) {
  if (status === "ok") return "text-trust";
  if (status === "watch") return "text-amber-400";
  return "text-destructive";
}

export default function AttentionKpiPage() {
  const { data: session, isPending } = authClient.useSession();
  usePageBack({ fallbackHref: "/shops" });
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) return;
    void fetchJson<{ kpis?: Kpis }>("/api/admin/attention-kpis").then(
      ({ res, data }) => {
        if (res.status === 403) {
          setAllowed(false);
          return;
        }
        setAllowed(true);
        setKpis(data?.kpis ?? null);
      },
    );
  }, [session?.user?.id]);

  if (isPending || (session && allowed === null)) return <PageLoader />;
  if (!session || allowed === false) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        Réservé à l’owner ShipShop.
      </p>
    );
  }
  if (!kpis) return <PageLoader />;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
      <div>
        <Link
          href="/shops"
          className="mb-2 inline-flex items-center gap-1 text-xs text-primary"
        >
          <ArrowLeft className="size-3" /> Boutiques
        </Link>
        <h1 className="flex items-center gap-2 font-heading text-xl font-bold">
          <Activity className="size-5 text-primary" /> KPI attention
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Attention, engagement, revenus hybrides et garde-fous UX · {kpis.periodDays} j
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Dwell moyen" value={`${Math.round(kpis.attention.avgDwellMs / 1000)} s`} hint="temps / produit" />
        <Kpi label="Sessions 7 j" value={String(kpis.attention.sessions7)} hint={`${kpis.attention.sessions30} / 30 j`} />
        <Kpi label="Rétention J7" value={pct(kpis.attention.retentionJ7)} hint={`J30 ${pct(kpis.attention.retentionJ30)}`} />
        <Kpi label="Interactions" value={pct(kpis.engagement.interactionRate)} hint={`${kpis.engagement.likes} likes`} />
        <Kpi label="Rev. pub" value={formatMoney(kpis.business.adRevenueCents)} hint="18% campagnes + 20% cadeaux" />
        <Kpi label="ARPS x1000" value={formatMoney(kpis.business.revenuePer1000Sessions)} hint="revenu / 1k sessions" />
        <Kpi label="CTR sponsorisé" value={pct(kpis.business.sponsoredCtr)} hint="clics / impressions" />
        <Kpi label="Conv. post-eng." value={pct(kpis.business.postEngagementConversion)} hint={`${kpis.business.orders} cmd`} />
      </div>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold">
          <ShieldAlert className="size-3.5" /> Garde-fous
        </p>
        <ul className="space-y-1.5 text-xs">
          {Object.entries(kpis.guards).map(([key, guard]) => (
            <li key={key} className="flex items-center justify-between">
              <span className="capitalize text-muted-foreground">{key}</span>
              <span className={statusTone(guard.status)}>
                {pct(guard.value)} · {guard.status} (seuil {pct(guard.threshold)})
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Badge Actif" value={String(kpis.creators.activeBadges)} hint="comptes motivés" />
        <Kpi label="Influenceurs" value={String(kpis.creators.influencerBadges)} hint="2k+ abonnés" />
        <Kpi label="Cadeaux" value={formatMoney(kpis.business.giftGmvCents)} hint={`${kpis.business.giftCount} envois`} />
        <Kpi label="Missions" value={pct(kpis.engagement.missionCompletionRate)} hint="complétion" />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <p className="font-heading text-base font-extrabold leading-tight">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}
