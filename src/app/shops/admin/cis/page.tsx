"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BrainCircuit } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { PageLoader } from "@/components/page-loader";
import { usePageBack } from "@/components/back-nav-context";

type Summary = {
  rankingEnabled: boolean;
  consentAccepted: number;
  consentWithdrawn: number;
  events24h: number;
  preferences: number;
};

export default function CisAdminPage() {
  const { data: session, isPending } = authClient.useSession();
  usePageBack({ fallbackHref: "/shops" });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookupId, setLookupId] = useState("");
  const [profile, setProfile] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSummary() {
    const { res, data } = await fetchJson<Summary>("/api/admin/cis");
    if (res.status === 403 || res.status === 401) {
      setAllowed(false);
      return;
    }
    setAllowed(true);
    setSummary(data ?? null);
  }

  useEffect(() => {
    if (!session) return;
    void loadSummary();
  }, [session?.user?.id]);

  async function toggleRanking(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { res, data } = await fetchJson<{
        rankingEnabled?: boolean;
        error?: string;
      }>("/api/admin/cis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rankingEnabled: next }),
      });
      if (!res.ok) {
        setError(data?.error ?? "Échec");
        return;
      }
      setSummary((prev) =>
        prev
          ? { ...prev, rankingEnabled: Boolean(data?.rankingEnabled ?? next) }
          : prev,
      );
    } finally {
      setBusy(false);
    }
  }

  async function lookupProfile() {
    const id = lookupId.trim();
    if (!id) return;
    setBusy(true);
    setError(null);
    setProfile(null);
    try {
      const { res, data } = await fetchJson<{ error?: string }>(
        `/api/admin/cis/profiles/${encodeURIComponent(id)}`,
      );
      if (!res.ok) {
        setError(data?.error ?? "Profil introuvable");
        return;
      }
      setProfile(data);
    } finally {
      setBusy(false);
    }
  }

  if (isPending || (session && allowed === null)) return <PageLoader />;
  if (!session || allowed === false) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        Réservé à l’owner ShipShop.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <Link
          href="/shops"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <BrainCircuit className="h-5 w-5 text-primary" />
            Customer Intelligence (CIS)
          </h1>
          <p className="text-sm text-muted-foreground">
            Consentements, événements et ranking Pour toi (feature flag).
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <Stat label="Consentements actifs" value={summary?.consentAccepted ?? 0} />
        <Stat label="Refus / retraits" value={summary?.consentWithdrawn ?? 0} />
        <Stat label="Événements 24 h" value={summary?.events24h ?? 0} />
        <Stat label="Préférences stockées" value={summary?.preferences ?? 0} />
      </section>

      <section className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Ranking CIS Pour toi</h2>
            <p className="text-sm text-muted-foreground">
              Off = comportement feed actuel. On = boost catégories / boutiques
              pour les utilisateurs ayant accepté le CIS.
            </p>
          </div>
          <button
            type="button"
            disabled={busy || !summary}
            onClick={() => void toggleRanking(!summary?.rankingEnabled)}
            className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium ${
              summary?.rankingEnabled
                ? "bg-primary text-primary-foreground"
                : "border border-border"
            }`}
          >
            {summary?.rankingEnabled ? "Activé" : "Désactivé"}
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <h2 className="font-medium">Fiche profil CIS</h2>
        <p className="text-sm text-muted-foreground">
          Accès journalisé. Entrer un userId Better Auth.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="userId"
            className="h-9 min-w-[16rem] flex-1 rounded-lg border border-border bg-background px-3 text-sm"
          />
          <button
            type="button"
            disabled={busy || !lookupId.trim()}
            onClick={() => void lookupProfile()}
            className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium"
          >
            Ouvrir
          </button>
        </div>
        {profile ? (
          <pre className="max-h-96 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">
            {JSON.stringify(profile, null, 2)}
          </pre>
        ) : null}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
