"use client";

import { compactCount } from "@/lib/growth/challenge-look";
import { fetchJson } from "@/lib/fetch-json";
import { formatLiveHostLabel } from "@/lib/growth/live-host-label";
import type { GrowthSurface } from "@/lib/growth/use-growth-surface";
import type { UserLocale } from "@/lib/user-locale";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";
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

function AccessPointIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M4.93,4.93C3.12,6.74 2,9.24 2,12C2,14.76 3.12,17.26 4.93,19.07L6.34,17.66C4.89,16.21 4,14.21 4,12C4,9.79 4.89,7.79 6.34,6.34L4.93,4.93M19.07,4.93L17.66,6.34C19.11,7.79 20,9.79 20,12C20,14.21 19.11,16.21 17.66,17.66L19.07,19.07C20.88,17.26 22,14.76 22,12C22,9.24 20.88,6.74 19.07,4.93M7.76,7.76C6.67,8.85 6,10.35 6,12C6,13.65 6.67,15.15 7.76,16.24L9.17,14.83C8.45,14.11 8,13.11 8,12C8,10.89 8.45,9.89 9.17,9.17L7.76,7.76M16.24,7.76L14.83,9.17C15.55,9.89 16,10.89 16,12C16,13.11 15.55,14.11 14.83,14.83L16.24,16.24C17.33,15.15 18,13.65 18,12C18,10.35 17.33,8.85 16.24,7.76M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10Z"
      />
    </svg>
  );
}

/** Pastilles LIVE + abonnés (vendeur) — comme showGoLive Android. */
export function FeedGoLiveCluster({
  count,
  locale,
  busy = false,
  onPress,
}: {
  count: number;
  locale?: UserLocale;
  busy?: boolean;
  onPress: () => void;
}) {
  const shown = Math.max(0, count);
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onPress();
      }}
      disabled={busy}
      aria-label={`LIVE, ${compactCount(shown, locale)} abonnés`}
      className={cn(
        "feed-live-badge pointer-events-auto absolute right-3 z-40 flex items-center gap-1.5",
        busy && "opacity-70",
      )}
    >
      <span className="flex items-center gap-1 rounded-[10px] bg-[#FF453A] px-[9px] py-[5px] text-white">
        <AccessPointIcon className="size-[13px] shrink-0" />
        <span className="text-[11px] leading-none font-extrabold tracking-[0.3px]">
          LIVE
        </span>
      </span>
      <span className="flex items-center gap-1 rounded-[10px] bg-[rgba(12,12,16,0.72)] px-2 py-[5px] text-white">
        <Eye className="size-3 shrink-0" strokeWidth={2} />
        <span className="text-[11px] leading-none font-bold tabular-nums">
          {compactCount(shown, locale)}
        </span>
      </span>
    </button>
  );
}

export async function startProductLive(product: { id: string; title: string }) {
  const title = product.title.trim();
  return fetchJson<{ live?: { id: string }; error?: string }>(
    "/api/growth/lives",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        title: title.length >= 2 ? title.slice(0, 80) : "Live shopping",
      }),
    },
  );
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
        <AccessPointIcon className="size-3 shrink-0" />
        <span className="text-[10px] font-extrabold tracking-[0.08em]">
          LIVE
        </span>
        {showHost ? (
          <>
            <span className="h-3 w-px shrink-0 bg-white/35" />
            <span className="min-w-0 truncate text-[11px] font-bold">
              {host}
            </span>
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
