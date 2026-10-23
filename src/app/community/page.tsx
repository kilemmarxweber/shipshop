"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { PageLoader } from "@/components/page-loader";
import { usePageBack } from "@/components/back-nav-context";
import { AccountBadges, type BadgeRow } from "@/components/growth/account-badges";
import { GrowthFeedFormats } from "@/components/growth/feed-formats";

type Mission = {
  key: string;
  target: number;
  progress: number;
  completed: boolean;
};

type Reward = { id: string; title: string; kind: string; createdAt: string };

type BoardRow = {
  rank: number;
  name: string;
  interactions: number;
  activeDays: number;
};

const MISSION_LABEL: Record<string, string> = {
  visit_shops: "Visiter 5 boutiques",
  discover_categories: "Explorer 3 catégories",
  share_product: "Partager 1 produit",
  useful_comment: "Laisser un commentaire utile",
};

export default function CommunityPage() {
  const { data: session, isPending } = authClient.useSession();
  usePageBack({ fallbackHref: "/" });
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [global, setGlobal] = useState<BoardRow[]>([]);
  const [local, setLocal] = useState<BoardRow[]>([]);
  const [city, setCity] = useState("Kinshasa");
  const [stats, setStats] = useState({
    subscribers: 0,
    activeDays: 0,
    interactions: 0,
  });

  useEffect(() => {
    if (!session) return;
    void fetchJson<{
      badges?: BadgeRow[];
      missions?: Mission[];
      rewards?: Reward[];
      subscribers?: number;
      activeDays?: number;
      interactions?: number;
    }>("/api/growth/me").then(({ data }) => {
      setBadges(data?.badges ?? []);
      setMissions(data?.missions ?? []);
      setRewards(data?.rewards ?? []);
      setStats({
        subscribers: data?.subscribers ?? 0,
        activeDays: data?.activeDays ?? 0,
        interactions: data?.interactions ?? 0,
      });
    });
    void fetchJson<{ global?: BoardRow[]; local?: BoardRow[]; city?: string }>(
      "/api/growth/leaderboard",
    ).then(({ data }) => {
      setGlobal(data?.global ?? []);
      setLocal(data?.local ?? []);
      if (data?.city) setCity(data.city);
    });
  }, [session?.user?.id]);

  if (isPending) return <PageLoader />;
  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Connectez-vous pour missions, badges et classements.
        </p>
        <Link href="/auth/login" className="mt-4 inline-block text-primary">
          Connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-5">
      <div>
        <h1 className="font-heading text-xl font-bold">Communauté</h1>
        <p className="text-sm text-muted-foreground">
          Badges, missions, classement · {stats.subscribers} abonnés
        </p>
      </div>
      <AccountBadges badges={badges} />
      <p className="text-[11px] text-muted-foreground">
        {stats.activeDays} jours actifs · {stats.interactions} interactions / 30 j
      </p>
      <GrowthFeedFormats variant="discover" pinChallenges />

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-bold">Missions de la semaine</h2>
        <ul className="mt-3 space-y-2">
          {missions.map((m) => (
            <li key={m.key}>
              <div className="flex items-center justify-between text-xs">
                <span>{MISSION_LABEL[m.key] ?? m.key}</span>
                <span className={m.completed ? "text-trust" : "text-muted-foreground"}>
                  {m.progress}/{m.target}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {rewards.length > 0 ? (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-bold">Cadeaux Badge Actif</h2>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {rewards.map((r) => (
              <li key={r.id}>{r.title}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <Board title={`Classement ${city}`} rows={local} />
      <Board title="Classement mondial" rows={global} />

      <div className="flex gap-2">
        <Link
          href="/live"
          className="flex-1 rounded-xl border border-border bg-surface py-2 text-center text-xs font-semibold"
        >
          Lives
        </Link>
        <Link
          href="/creator"
          className="flex-1 rounded-xl bg-primary py-2 text-center text-xs font-bold text-white"
        >
          Studio créateur
        </Link>
      </div>
    </div>
  );
}

function Board({ title, rows }: { title: string; rows: BoardRow[] }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Pas encore de scores.</p>
      ) : (
        <ol className="mt-2 space-y-1.5 text-xs">
          {rows.map((row) => (
            <li key={`${title}-${row.rank}`} className="flex justify-between">
              <span>
                {row.rank}. {row.name}
              </span>
              <span className="text-muted-foreground">
                {row.interactions} pts · {row.activeDays} j
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
