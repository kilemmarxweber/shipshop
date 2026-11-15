"use client";

import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/use-confirm-dialog";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import { Shield, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Summary = {
  rateLimited: number;
  honeypotHits: number;
  activeRestrictions: number;
  byType: { type: string; count: number }[];
};

type SecurityEvent = {
  id: string;
  type: string;
  severity: string;
  endpoint: string | null;
  method: string | null;
  ipHash: string | null;
  userId: string | null;
  sessionId: string | null;
  createdAt: string;
};

type Restriction = {
  id: string;
  scope: string;
  subjectKey: string;
  reason: string;
  source: string;
  expiresAt: string;
  createdAt: string;
  createdBy: string | null;
};

export default function AdminSecurityPage() {
  const { data: session } = authClient.useSession();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [hours, setHours] = useState(24);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({
    scope: "USER" as "USER" | "SESSION" | "IP",
    subject: "",
    reason: "",
    durationMinutes: 60,
  });
  const { confirm, ConfirmDialog } = useConfirmDialog();

  async function load(nextHours = hours) {
    const { res, data } = await fetchJson<{
      summary?: Summary;
      events?: SecurityEvent[];
      restrictions?: Restriction[];
      error?: string;
    }>(`/api/admin/security?hours=${nextHours}`);
    if (res.status === 403) {
      setAllowed(false);
      return;
    }
    if (!res.ok) {
      toast.error(data?.error ?? "Chargement impossible");
      setAllowed(true);
      return;
    }
    setAllowed(true);
    setSummary(data?.summary ?? null);
    setEvents(data?.events ?? []);
    setRestrictions(data?.restrictions ?? []);
  }

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on session / hours only
  }, [session?.user?.id, hours]);

  async function lift(id: string) {
    const ok = await confirm({
      title: "Lever la restriction ?",
      description: "L’accès redevient possible immédiatement.",
      confirmLabel: "Débloquer",
    });
    if (!ok) return;
    setBusyId(id);
    const { res, data } = await fetchJson<{ error?: string }>(
      "/api/admin/security",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lift", restrictionId: id }),
      },
    );
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Déblocage impossible");
      return;
    }
    toast.success("Restriction levée");
    load();
  }

  async function createRestriction() {
    if (!form.subject.trim() || form.reason.trim().length < 3) {
      toast.error("Sujet et motif requis");
      return;
    }
    const ok = await confirm({
      title: "Appliquer une restriction ?",
      description: `${form.scope} · ${form.durationMinutes} min — action auditée.`,
      confirmLabel: "Restreindre",
    });
    if (!ok) return;
    setBusyId("create");
    const { res, data } = await fetchJson<{ error?: string }>(
      "/api/admin/security",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restrict",
          scope: form.scope,
          subject: form.subject.trim(),
          reason: form.reason.trim(),
          durationMinutes: form.durationMinutes,
        }),
      },
    );
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Restriction impossible");
      return;
    }
    toast.success("Restriction créée");
    setForm((f) => ({ ...f, subject: "", reason: "" }));
    load();
  }

  async function revokeUserSessions(userId: string) {
    const ok = await confirm({
      title: "Révoquer toutes les sessions ?",
      description: "L’utilisateur devra se reconnecter sur tous les appareils.",
      confirmLabel: "Révoquer",
    });
    if (!ok) return;
    setBusyId(userId);
    const { res, data } = await fetchJson<{ error?: string; revoked?: number }>(
      "/api/admin/security",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke_user_sessions",
          userId,
          reason: "Révocation depuis Security Center",
        }),
      },
    );
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Révocation impossible");
      return;
    }
    toast.success(`${data?.revoked ?? 0} session(s) révoquée(s)`);
    load();
  }

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <Link href="/auth/login" className="text-primary">
          Connexion
        </Link>
      </div>
    );
  }

  if (loading || allowed === null) {
    return <PageLoader label="Security Center" />;
  }

  if (!allowed) {
    return (
      <div className="px-5 py-16 text-center text-sm text-muted-foreground">
        Réservé à l&apos;owner ou à un admin Chip Shop.
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-2 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading flex items-center gap-2 text-lg font-bold">
            <Shield className="size-5 text-primary" />
            Security Center
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Anti-scraping : 429, honeypot, restrictions temporaires. Pas de ban
            IP collectif permanent.
          </p>
        </div>
        <label className="text-[11px] text-muted-foreground">
          Fenêtre
          <select
            className="ml-2 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-foreground"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          >
            <option value={6}>6 h</option>
            <option value={24}>24 h</option>
            <option value={72}>72 h</option>
            <option value={168}>7 j</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          ["429 / rate limit", summary?.rateLimited ?? 0],
          ["Honeypot", summary?.honeypotHits ?? 0],
          ["Restrictions actives", summary?.activeRestrictions ?? 0],
          ["Types d’événements", summary?.byType?.length ?? 0],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-border bg-surface p-3"
          >
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 font-heading text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {summary?.byType?.length ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {summary.byType
            .slice(0, 8)
            .map((row) => `${row.type} (${row.count})`)
            .join(" · ")}
        </p>
      ) : null}

      <h2 className="mt-8 font-heading text-sm font-bold">
        Restrictions actives
      </h2>
      {restrictions.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Aucune restriction.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {restrictions.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3"
            >
              <div>
                <p className="text-sm font-semibold">
                  {r.scope} · {r.source}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {r.reason} · expire {new Date(r.expiresAt).toLocaleString()} ·
                  clé {r.subjectKey.slice(0, 12)}…
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === r.id}
                onClick={() => lift(r.id)}
              >
                Débloquer
              </Button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 font-heading text-sm font-bold">
        Nouvelle restriction
      </h2>
      <div className="mt-2 grid gap-2 rounded-2xl border border-border bg-surface p-3 md:grid-cols-2">
        <label className="text-[11px] text-muted-foreground">
          Portée
          <select
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
            value={form.scope}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                scope: e.target.value as "USER" | "SESSION" | "IP",
              }))
            }
          >
            <option value="USER">USER (id ou email)</option>
            <option value="SESSION">SESSION (id)</option>
            <option value="IP">IP (hashée côté serveur)</option>
          </select>
        </label>
        <label className="text-[11px] text-muted-foreground">
          Durée (minutes)
          <input
            type="number"
            min={5}
            max={10080}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
            value={form.durationMinutes}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                durationMinutes: Number(e.target.value) || 60,
              }))
            }
          />
        </label>
        <label className="text-[11px] text-muted-foreground md:col-span-2">
          Sujet
          <input
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
            placeholder="userId, email, sessionId ou IP"
            value={form.subject}
            onChange={(e) =>
              setForm((f) => ({ ...f, subject: e.target.value }))
            }
          />
        </label>
        <label className="text-[11px] text-muted-foreground md:col-span-2">
          Motif
          <input
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
            placeholder="Ex. scraping confirmé / recours"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />
        </label>
        <Button
          className="md:col-span-2"
          disabled={busyId === "create"}
          onClick={() => createRestriction()}
        >
          Appliquer
        </Button>
      </div>

      <h2 className="mt-8 font-heading text-sm font-bold">Événements</h2>
      {events.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Aucun événement sur cette fenêtre.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {events.map((e) => (
            <li
              key={e.id}
              className={cn(
                "rounded-2xl border border-border bg-surface p-3",
                e.severity === "high" || e.severity === "critical"
                  ? "border-destructive/40"
                  : null,
                e.type === "honeypot_hit" ? "border-amber-500/40" : null,
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{e.type}</p>
                <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase">
                  {(e.severity === "high" || e.severity === "critical") && (
                    <ShieldAlert className="size-3 text-destructive" />
                  )}
                  {e.severity}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {e.method ?? "—"} {e.endpoint ?? "—"} ·{" "}
                {new Date(e.createdAt).toLocaleString()}
              </p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                user {e.userId?.slice(0, 10) ?? "anon"} · ip{" "}
                {e.ipHash?.slice(0, 10) ?? "—"} · sess{" "}
                {e.sessionId?.slice(0, 10) ?? "—"}
              </p>
              {e.userId ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={busyId === e.userId}
                  onClick={() => revokeUserSessions(e.userId!)}
                >
                  Révoquer sessions compte
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog />
    </div>
  );
}
