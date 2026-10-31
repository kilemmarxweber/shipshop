"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Radio } from "lucide-react";
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
  variant?: "profile" | "studio";
};

export function GoLiveCard({ className, variant = "profile" }: Props) {
  const { data: session } = authClient.useSession();
  const [me, setMe] = useState<GrowthMe | null>(null);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("Live shopping");
  const [busy, setBusy] = useState(false);
  const [activeLive, setActiveLive] = useState<LiveRow | null>(null);

  const load = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
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
    } finally {
      setReady(true);
    }
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

  const liveDot = (
    <span className="relative flex size-2 shrink-0">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#ff3b4d] opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-[#ff3b4d]" />
    </span>
  );

  const goLiveBtn = (
    <button
      type="button"
      disabled={busy || title.trim().length < 2}
      onClick={() => void startLive()}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5",
        "bg-[#ff2d45] text-[12px] font-extrabold text-white",
        "shadow-[0_8px_18px_rgba(255,45,69,0.32)]",
        "transition hover:bg-[#ff4056] active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
      )}
    >
      <Radio className="size-3.5" />
      {busy ? "…" : "Go live"}
    </button>
  );

  const resumeBtn = activeLive ? (
    <Link
      href={`/live/${activeLive.id}`}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5",
        "bg-[#ff2d45] text-[12px] font-extrabold text-white",
        "shadow-[0_8px_18px_rgba(255,45,69,0.32)]",
        "transition hover:bg-[#ff4056] active:scale-[0.98]",
      )}
    >
      <Radio className="size-3.5" />
      {activeLive.status === "PAUSED" ? "Reprendre" : "Ouvrir"}
    </Link>
  ) : null;

  if (!studio) {
    return (
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border border-[#3a1520] bg-[#14080e]",
          className,
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_120%_at_0%_50%,rgba(255,60,80,0.22),transparent_60%)]"
        />
        <div className="relative flex items-center gap-2 px-3 py-2.5">
          {liveDot}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold leading-tight text-white">
              {activeLive
                ? activeLive.status === "PAUSED"
                  ? "Live en pause"
                  : "Vous êtes en direct"
                : "Lancer un live"}
            </p>
            <p className="truncate text-[10px] text-white/50">
              {!ready
                ? "\u00a0"
                : activeLive
                  ? "Revenir sur scène"
                  : canGoLive
                    ? "Shopping · cadeaux · produits"
                    : need > 0
                      ? `${need} abonnés + KYC`
                      : "KYC Influenceur requis"}
            </p>
          </div>
          {!ready ? (
            <div className="h-9 w-[5.5rem] animate-pulse rounded-full bg-white/10" />
          ) : activeLive ? (
            resumeBtn
          ) : canGoLive ? (
            goLiveBtn
          ) : (
            <Link
              href="/kyc"
              className="inline-flex h-9 shrink-0 items-center rounded-full bg-white px-3 text-[12px] font-bold text-[#1a0a10]"
            >
              KYC
            </Link>
          )}
        </div>
        {ready && canGoLive && !activeLive ? (
          <div className="relative border-t border-white/8 px-3 py-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Titre du live"
              aria-label="Titre du live"
              className="h-8 rounded-lg border-white/10 bg-black/30 px-2.5 text-[12px] text-white placeholder:text-white/35 focus-visible:ring-[#ff2d45]/40"
            />
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[#3a1520] bg-[#14080e]",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_10%_0%,rgba(255,60,80,0.28),transparent_55%)]"
      />
      <div className="relative space-y-3 p-4">
        <div className="flex items-center gap-2">
          {liveDot}
          <h2 className="min-w-0 flex-1 font-heading text-base font-bold text-white">
            {activeLive
              ? activeLive.status === "PAUSED"
                ? "Live en pause"
                : "Vous êtes en direct"
              : "Lancer un live"}
          </h2>
        </div>
        {!ready ? (
          <div className="h-10 animate-pulse rounded-xl bg-white/10" />
        ) : activeLive ? (
          resumeBtn
        ) : canGoLive ? (
          <div className="flex gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Titre du live"
              className="h-10 flex-1 rounded-xl border-white/10 bg-black/35 text-sm text-white placeholder:text-white/35 focus-visible:ring-[#ff2d45]/40"
            />
            {goLiveBtn}
          </div>
        ) : (
          <p className="text-[12px] text-white/55">
            {need > 0
              ? `Encore ${need.toLocaleString("fr-FR")} abonnés + KYC`
              : "Finalisez le KYC Influenceur pour passer en live."}
          </p>
        )}
      </div>
    </section>
  );
}
