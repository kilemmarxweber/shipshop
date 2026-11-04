"use client";

import { compactCount } from "@/lib/growth/challenge-look";
import type { GrowthSurface } from "@/lib/growth/use-growth-surface";
import type { UserLocale } from "@/lib/user-locale";
import { cn } from "@/lib/utils";
import { Eye, Play } from "lucide-react";
import Link from "next/link";

export type FeedLive = NonNullable<GrowthSurface["lives"]>[number];

export function matchOpenLive(
  lives: GrowthSurface["lives"] | undefined,
  opts: { productId?: string | null; ownerUserId?: string | null },
): FeedLive | null {
  const open = (lives ?? []).filter((row) => row.status !== "ENDED");
  if (!open.length) return null;
  if (opts.productId) {
    const hit = open.find((row) => row.product?.id === opts.productId);
    if (hit) return hit;
  }
  if (opts.ownerUserId) {
    return open.find((row) => row.user?.id === opts.ownerUserId) ?? null;
  }
  return null;
}

export function FeedLiveBadge({
  live,
  locale,
  className,
}: {
  live: FeedLive;
  locale?: UserLocale;
  className?: string;
}) {
  const viewers = Math.max(live.viewerPeak ?? 0, 1);
  return (
    <Link
      href={`/live/${live.id}`}
      aria-label="LIVE"
      className={cn(
        "feed-live-badge pointer-events-auto absolute top-3 right-2.5 z-20 sm:top-4 sm:right-3",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="flex items-center gap-1.5 rounded-full bg-[var(--live)] px-2.5 py-1.5 text-white ring-1 ring-white/25">
        <Play className="size-3 fill-white" strokeWidth={0} />
        <span className="text-[11px] font-extrabold tracking-[0.08em]">
          LIVE
        </span>
        <span className="h-3 w-px bg-white/35" />
        <Eye className="size-3.5 opacity-95" strokeWidth={2.2} />
        <span className="text-[11px] font-bold tabular-nums">
          {compactCount(viewers, locale)}
        </span>
      </span>
    </Link>
  );
}
