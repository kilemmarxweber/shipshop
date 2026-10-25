"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Radio, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { INFLUENCER_FOLLOWERS } from "@/lib/growth/constants";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { BadgeRow } from "@/components/growth/account-badges";

type GrowthMe = {
  badges?: BadgeRow[];
  subscribers?: number;
  isPlatformOwner?: boolean;
  kycApproved?: boolean;
};

type LiveRow = {
  id: string;
  title: string;
  status?: string;
  user?: { id: string };
};

type Props = {
  className?: string;
  /** Compact = profil ; full = studio */
  variant?: "profile" | "studio";
};

export function GoLiveCard({ className, variant = "profile" }: Props) {
  const { data: session } = authClient.useSession();
  const [me, setMe] = useState<GrowthMe | null>(null);
  const [title, setTitle] = useState("Live shopping");
  const [busy, setBusy] = useState(false);
  const [activeLive, setActiveLive] = useState<LiveRow | null>(null);

  const load = useCallback(async () => {
    if (!session?.user?.id) return;
    const [growth, lives] = await Promise.all([
      fetchJson<GrowthMe>("/api/growth/me"),
      fetchJson<{ lives?: LiveRow[] }>("/api/growth/lives"),
    ]);
    if (growth.data) setMe(growth.data);
    const mine = (lives.data?.lives ?? []).find(
      (row) =>
        row.user?.id === session.user.id &&
        (row.status === "LIVE" || row.status === "PAUSED"),
    );
    setActiveLive(mine ?? null);
  }, [session?.user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!session?.user?.id) return null;

  const influencer = Boolean(
    me?.badges?.some((b) => b.kind === "INFLUENCER" && b.active),
  );
  const canGoLive = Boolean(influencer || me?.isPlatformOwner);
  const subscribers = me?.subscribers ?? 0;
  const need = Math.max(0, INFLUENCER_FOLLOWERS - subscribers);
  const studio = variant === "studio";

  async function startLive() {
    if (busy) return;
    setBusy(true);
    const { res, data } = await fetchJson<{
      live?: { id: string };
      error?: string;
    }>("/api/growth/lives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() || "Live shopping" }),
    });
    setBusy(false);
    if (!res.ok || !data?.live) {
      toast.error(data?.error ?? "Live impossible");
      return;
    }
    window.location.href = `/live/${data.live.id}`;
  }

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[1.35rem] border border-[#3a1520] bg-[#14080e]",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_10%_0%,rgba(255,60,80,0.28),transparent_55%),radial-gradient(ellipse_60%_50%_at_100%_100%,rgba(255,120,40,0.12),transparent_50%)]"
      />
      <div className="relative p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-[0.16em] text-[#ff6b7a] uppercase">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#ff3b4d] opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-[#ff3b4d]" />
              </span>
              Live
            </p>
            <h2 className="mt-1.5 font-heading text-[1.15rem] font-bold tracking-tight text-white">
              {activeLive
                ? activeLive.status === "PAUSED"
                  ? "Votre live est en pause"
                  : "Vous êtes en direct"
                : "Lancer mon live"}
            </h2>
            <p className="mt-1 text-[12px] leading-snug text-white/55">
              {activeLive
                ? "Revenez sur scène pour reprendre caméra et chat."
                : canGoLive
                  ? "Shopping en direct · cadeaux · produits en vitrine"
                  : me?.isPlatformOwner
                    ? "Accès owner plateforme"
                    : `Badge Influenceur · ${subscribers.toLocaleString("fr-FR")} / ${INFLUENCER_FOLLOWERS.toLocaleString("fr-FR")} abonnés`}
            </p>
          </div>
          {!studio ? (
            <Link
              href="/creator"
              className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Studio
            </Link>
          ) : null}
        </div>

        {activeLive ? (
          <Link
            href={`/live/${activeLive.id}`}
            className={cn(
              "mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl",
              "bg-[#ff2d45] text-[15px] font-extrabold text-white shadow-[0_12px_28px_rgba(255,45,69,0.35)]",
              "transition hover:bg-[#ff4056] active:scale-[0.98]",
            )}
          >
            <Radio className="size-4" />
            {activeLive.status === "PAUSED"
              ? "Reprendre mon live"
              : "Ouvrir mon live"}
          </Link>
        ) : canGoLive ? (
          <div className="mt-4 space-y-2.5">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Titre du live"
              className="h-11 rounded-xl border-white/10 bg-black/35 text-sm text-white placeholder:text-white/35 focus-visible:ring-[#ff2d45]/40"
            />
            <button
              type="button"
              disabled={busy || title.trim().length < 2}
              onClick={() => void startLive()}
              className={cn(
                "flex h-12 w-full items-center justify-center gap-2 rounded-2xl",
                "bg-[#ff2d45] text-[15px] font-extrabold tracking-wide text-white",
                "shadow-[0_12px_28px_rgba(255,45,69,0.35)]",
                "transition hover:bg-[#ff4056] active:scale-[0.98]",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
              )}
            >
              <Radio className="size-4" />
              {busy ? "Démarrage…" : "Go live"}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white/85">
                <Sparkles className="size-3.5 text-[#ff8a5b]" />
                {need > 0
                  ? `Encore ${need.toLocaleString("fr-FR")} abonné${need > 1 ? "s" : ""} + KYC`
                  : "Finalisez le KYC pour le badge Influenceur"}
              </p>
              <p className="mt-1 text-[11px] text-white/45">
                Le live shopping est réservé aux créateurs vérifiés.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/community"
                className="flex h-11 flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-[13px] font-bold text-white/90 transition hover:bg-white/10"
              >
                Communauté
              </Link>
              <Link
                href="/kyc"
                className="flex h-11 flex-1 items-center justify-center rounded-xl bg-white text-[13px] font-bold text-[#1a0a10] transition hover:bg-white/90"
              >
                Vérifier KYC
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
