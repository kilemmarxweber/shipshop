"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney } from "@/lib/utils";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Audit = {
  id: string;
  action: string;
  actorType: string;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: string;
  ip: string | null;
};

type Movement = {
  id: string;
  kind: string;
  status: string;
  amountCents: number;
  currency: string;
  provider: string;
  providerReference: string | null;
  clientIdempotencyKey: string;
  createdAt: string;
  expiresAt: string | null;
  evidenceNote: string | null;
  payer: { name: string; email: string };
  beneficiary: { name: string } | null;
  audits: Audit[];
  outbox: { eventKey: string; status: string; attempts: number }[];
};

export default function AdminLedgerPage() {
  const { data: session } = authClient.useSession();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Movement[]>([]);
  const [stats, setStats] = useState({
    waiting: 0,
    postedToday: 0,
    expired: 0,
    deadOutbox: 0,
  });
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (q.trim()) query.set("q", q.trim());
    const { res, data } = await fetchJson<{
      error?: string;
      movements?: Movement[];
      stats?: typeof stats;
    }>(`/api/admin/ledger?${query.toString()}`);
    if (res.status === 403) {
      setAllowed(false);
      return;
    }
    if (!res.ok) {
      toast.error(data?.error ?? "Ledger indisponible");
      return;
    }
    setAllowed(true);
    setRows(data?.movements ?? []);
    if (data?.stats) setStats(data.stats);
  }

  useEffect(() => {
    if (!session) return;
    void load();
  }, [session, status]);

  async function act(
    movementId: string,
    action: "expire" | "reject" | "post",
  ) {
    setBusy(movementId + action);
    const evidenceNote =
      action === "post"
        ? window.prompt("Preuve caisse (réf. opérateur / note)") ?? ""
        : undefined;
    if (action === "post" && evidenceNote === "") {
      setBusy(null);
      return;
    }
    const { res, data } = await fetchJson<{ error?: string }>(
      "/api/admin/ledger",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movementId, action, evidenceNote }),
      },
    );
    setBusy(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Action refusée");
      return;
    }
    toast.success("Mouvement mis à jour");
    await load();
  }

  if (!session || allowed === null) return <PageLoader />;
  if (!allowed) {
    return (
      <p className="px-5 py-16 text-center text-sm text-muted-foreground">
        Réservé au propriétaire de la plateforme.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-lg font-bold">Ledger paiements</h1>
        <Link href="/shops" className="text-sm text-muted-foreground">
          Retour
        </Link>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Journal des mouvements. Poster manuellement seulement avec une preuve
        caisse. Un POSTED ne se recrédite pas.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="En attente" value={stats.waiting} />
        <Stat label="Postés aujourd’hui" value={stats.postedToday} />
        <Stat label="Expirés" value={stats.expired} />
        <Stat label="Outbox morte" value={stats.deadOutbox} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Réf., nom, clé"
          className="h-10 max-w-xs bg-surface-2"
        />
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Filtrer
        </Button>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-border bg-surface-2 px-2 text-sm"
        >
          <option value="">Tous</option>
          <option value="AWAITING_FUNDS">En attente</option>
          <option value="POSTED">Posté</option>
          <option value="EXPIRED">Expiré</option>
          <option value="REJECTED">Rejeté</option>
          <option value="FAILED">Échoué</option>
        </select>
      </div>

      <ul className="mt-6 space-y-3">
        {rows.map((m) => (
          <li
            key={m.id}
            className="rounded-xl border border-border bg-surface px-3 py-3 text-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">
                {m.kind} · {m.status}
              </p>
              <p className="font-heading font-bold">
                {formatMoney(m.amountCents, m.currency)}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {m.payer.name}
              {m.beneficiary ? ` → ${m.beneficiary.name}` : ""} ·{" "}
              {m.provider} · {m.providerReference ?? "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {new Date(m.createdAt).toLocaleString("fr-FR")}
              {m.evidenceNote ? ` · ${m.evidenceNote}` : ""}
            </p>
            {m.outbox.length ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Messages :{" "}
                {m.outbox
                  .map((o) => `${o.eventKey} ${o.status}`)
                  .join(" · ")}
              </p>
            ) : null}
            <ul className="mt-2 space-y-0.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
              {m.audits.map((a) => (
                <li key={a.id}>
                  {new Date(a.createdAt).toLocaleString("fr-FR")} · {a.actorType}{" "}
                  {a.action}
                  {a.fromStatus ? ` ${a.fromStatus}→${a.toStatus}` : ""}
                  {a.ip ? ` · ${a.ip}` : ""}
                </li>
              ))}
            </ul>
            {m.status === "AWAITING_FUNDS" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy === m.id + "post"}
                  onClick={() => void act(m.id, "post")}
                >
                  Poster (preuve)
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy === m.id + "expire"}
                  onClick={() => void act(m.id, "expire")}
                >
                  Expirer
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy === m.id + "reject"}
                  onClick={() => void act(m.id, "reject")}
                >
                  Rejeter
                </Button>
              </div>
            ) : null}
          </li>
        ))}
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucun mouvement
          </p>
        ) : null}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2">
      <p className="font-heading text-lg font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
