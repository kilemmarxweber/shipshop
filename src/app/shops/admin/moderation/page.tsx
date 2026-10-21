"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { PageLoader } from "@/components/page-loader";
import { useConfirmDialog } from "@/components/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ModUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  disabledAt: string | null;
  disabledReason: string | null;
  nsfwStrikeCount: number;
};

type EventRow = {
  id: string;
  variant: string;
  kind: string;
  decision: string;
  score: number;
  contentHash: string;
  createdAt: string;
  labels: unknown;
  user: ModUser;
};

export default function AdminModerationPage() {
  const { data: session } = authClient.useSession();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [disabled, setDisabled] = useState<ModUser[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  async function load() {
    const { res, data } = await fetchJson<{
      events?: EventRow[];
      disabled?: ModUser[];
      error?: string;
    }>("/api/admin/moderation");
    if (res.status === 403) {
      setAllowed(false);
      return;
    }
    setAllowed(true);
    setEvents(data?.events ?? []);
    setDisabled(data?.disabled ?? []);
  }

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [session?.user?.id]);

  async function reactivate(userId: string) {
    const ok = await confirm({
      title: "Réactiver le compte ?",
      description:
        "Les boutiques seront rouvertes ; les produits restent masqués.",
      confirmLabel: "Réactiver",
    });
    if (!ok) {
      return;
    }
    setBusyId(userId);
    const { res, data } = await fetchJson<{ error?: string }>(
      "/api/admin/moderation",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "reactivate" }),
      },
    );
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Réactivation impossible");
      return;
    }
    toast.success("Compte réactivé");
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
    return <PageLoader label="Modération" />;
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
      <h1 className="font-heading text-lg font-bold">Modération médias</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Scans NSFW catalogue. Les fichiers refusés ne sont pas stockés. Pas
        d&apos;auto-réactivation.
      </p>

      <h2 className="mt-6 font-heading text-sm font-bold">Comptes désactivés</h2>
      {disabled.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Aucun compte gelé.</p>
      ) : (
            <ul className="mt-2 space-y-2">
              {disabled.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{u.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {u.email} · {u.disabledReason ?? "—"} · {u.nsfwStrikeCount}{" "}
                      strike(s)
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={busyId === u.id}
                    onClick={() => reactivate(u.id)}
                  >
                    Réactiver
                  </Button>
                </li>
              ))}
            </ul>
      )}

      <h2 className="mt-8 font-heading text-sm font-bold">Journal des scans</h2>
      {events.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Aucun événement.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {events.map((e) => (
            <li
              key={e.id}
              className={cn(
                "rounded-2xl border border-border bg-surface p-3",
                e.decision === "CSAM_HOLD" && "border-destructive/50",
                e.decision === "BAN" && "border-amber-500/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">
                  {e.user.name}{" "}
                  <span className="font-normal text-muted-foreground">
                    {e.user.email}
                  </span>
                </p>
                <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase">
                  {e.decision === "CSAM_HOLD" ? (
                    <ShieldAlert className="size-3 text-destructive" />
                  ) : null}
                  {e.decision}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {e.kind} · {e.variant} · score {(e.score * 100).toFixed(0)}% ·{" "}
                {new Date(e.createdAt).toLocaleString()}
              </p>
              <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                sha256 {e.contentHash.slice(0, 16)}…
              </p>
              {e.user.disabledAt && e.decision !== "ALLOW" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={busyId === e.user.id}
                  onClick={() => reactivate(e.user.id)}
                >
                  Réactiver le compte
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
