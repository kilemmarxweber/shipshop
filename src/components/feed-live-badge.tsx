"use client";

import { compactCount } from "@/lib/growth/challenge-look";
import { formatLiveHostLabel } from "@/lib/growth/live-host-label";
import type { GrowthSurface } from "@/lib/growth/use-growth-surface";
import type { UserLocale } from "@/lib/user-locale";
import { cn } from "@/lib/utils";
import { Eye, Play } from "lucide-react";
import Link from "next/link";

export type FeedLive = NonNullable<GrowthSurface["lives"]>[number] & {
  hostLabel?: string;
  hostKind?: string;
  shop?: { name?: string; logoUrl?: string | null } | null;
  viewerCount?: number;
};

export function matchOpenLive(
  lives: GrowthSurface["lives"] | undefined,
  opts: { productId?: string | null; ownerUserId?: string | null },
): FeedLive | null {
  const open = (lives ?? []).filter((row) => row.status !== "ENDED");
  if (!open.length) return null;
  if (opts.productId) {
    const hit = open.find((row) => row.product?.id === opts.productId);
    if (hit) return hit as FeedLive;
  }
  if (opts.ownerUserId) {
    return (
      (open.find((row) => row.user?.id === opts.ownerUserId) as FeedLive) ??
      null
    );
  }
  return null;
}

/** Card LIVE style billet — boutique · nom (ou nom seul). */
export function FeedLiveBadge({
  live,
  locale,
  className,
  showHost = true,
}: {
  live: FeedLive;
  locale?: UserLocale;
  className?: string;
  showHost?: boolean;
}) {
  const viewers = Math.max(live.viewerCount ?? live.viewerPeak ?? 0, 1);
  const host = formatLiveHostLabel({
    hostLabel: live.hostLabel,
    userName: live.user?.name,
    shopName: live.shop?.name,
  });

  return (
    <Link
      href={`/live/${live.id}`}
      aria-label={`LIVE ${host}`}
      className={cn(
        "feed-live-badge pointer-events-auto absolute top-3 right-2.5 z-20 max-w-[min(70%,18rem)] sm:top-4 sm:right-3",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="flex items-center gap-1.5 rounded-2xl border border-white/20 bg-[var(--live,#e11d48)]/95 px-2.5 py-1.5 text-white shadow-lg ring-1 ring-black/20 backdrop-blur-md">
        <Play className="size-3 shrink-0 fill-white" strokeWidth={0} />
        <span className="text-[10px] font-extrabold tracking-[0.08em]">
          LIVE
        </span>
        {showHost ? (
          <>
            <span className="h-3 w-px shrink-0 bg-white/35" />
            <span className="min-w-0 truncate text-[11px] font-bold">{host}</span>
          </>
        ) : null}
        <span className="h-3 w-px shrink-0 bg-white/35" />
        <Eye className="size-3.5 shrink-0 opacity-95" strokeWidth={2.2} />
        <span className="text-[11px] font-bold tabular-nums">
          {compactCount(viewers, locale)}
        </span>
      </span>
    </Link>
  );
}
