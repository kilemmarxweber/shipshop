"use client";

import { usePageBack } from "@/components/back-nav-context";
import { PageLoader } from "@/components/page-loader";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { ArrowLeft, FlaskConical, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Experiment = {
  id: string;
  name: string;
  hypothesis: string;
  status: string;
  variantA: { label: string; conversionRate: number };
  variantB: { label: string; conversionRate: number };
  liftPct: number;
};

type RetentionPolicy = {
  id: string;
  label: string;
  retentionDays: number;
  eligibleEstimate: number;
  mode: string;
  nextRunAt: string | null;
  status: string;
};

function pct(n: number) {
  return `${(n * 100).toFixed(1)} %`;
}

export default function AnalyticsAdminPage() {
  const { data: session, isPending } = authClient.useSession();
  usePageBack({ fallbackHref: "/shops" });
  const [tab, setTab] = useState<"ab" | "retention">("ab");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [retention, setRetention] = useState<RetentionPolicy[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { res, data } = await fetchJson<{
      experiments?: Experiment[];
      retention?: RetentionPolicy[];
    }>(`/api/admin/analytics?tab=${tab}`);
    if (res.status === 401 || res.status === 403) {
      setAllowed(false);
      return;
    }
    setAllowed(true);
    setExperiments(data?.experiments ?? []);
    setRetention(data?.retention ?? []);
  }

  useEffect(() => {
    if (!session) return;
    void load();
  }, [session?.user?.id, tab]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const { res, data } = await fetchJson<{ error?: string }>(
        "/api/admin/analytics",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        setError(data?.error ?? "Échec");
        return;
      }
      await load();
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
          <h1 className="text-lg font-semibold">Analytics & Performance</h1>
          <p className="text-sm text-muted-foreground">
            A/B Lift et politiques de rétention (simulation).
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("ab")}
          className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium ${
            tab === "ab"
              ? "bg-primary text-primary-foreground"
              : "border border-border"
          }`}
        >
          <FlaskConical className="h-4 w-4" />
          A/B Lift
        </button>
        <button
          type="button"
          onClick={() => setTab("retention")}
          className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium ${
            tab === "retention"
              ? "bg-primary text-primary-foreground"
              : "border border-border"
          }`}
        >
          <Trash2 className="h-4 w-4" />
          Rétention
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {tab === "ab" ? (
        <div className="space-y-4">
          {experiments.map((exp) => (
            <section
              key={exp.id}
              className="space-y-3 rounded-xl border border-border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{exp.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {exp.hypothesis}
                  </p>
                </div>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                  {exp.status}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">
                    {exp.variantA.label}
                  </p>
                  <p className="text-xl font-semibold tabular-nums">
                    {pct(exp.variantA.conversionRate)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">
                    {exp.variantB.label}
                  </p>
                  <p className="text-xl font-semibold tabular-nums text-emerald-400">
                    {pct(exp.variantB.conversionRate)}
                  </p>
                </div>
              </div>
              <p className="text-sm">
                Lift estimé :{" "}
                <span className="font-semibold text-emerald-400">
                  +{exp.liftPct.toFixed(1)} %
                </span>{" "}
                — ne pas déclarer de gagnant sans taille d’échantillon.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void patch({
                    action:
                      exp.status === "running"
                        ? "stop_experiment"
                        : "start_experiment",
                    experimentId: exp.id,
                  })
                }
                className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium"
              >
                {exp.status === "running" ? "Arrêter" : "Relancer"}
              </button>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-xl border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">Purge rétention auto</h2>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
                Planifié · simulation
              </span>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Commence par fichiers temporaires, logs et sessions expirées. Pas
              de suppression des preuves de paiement.
            </p>
            <div className="space-y-2">
              {retention.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.retentionDays} j · ~{row.eligibleEstimate} éligibles
                      · {row.mode}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void patch({ action: "run_retention_simulate" })}
              className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              Lancer simulation
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
