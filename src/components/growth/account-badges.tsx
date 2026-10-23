"use client";

import { Flame, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export type BadgeRow = {
  kind: "ACTIVE" | "INFLUENCER";
  active: boolean;
  progress: number;
  target: number;
};

export function AccountBadges({
  badges,
  compact = false,
}: {
  badges: BadgeRow[];
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", compact && "gap-1.5")}>
      {badges.map((badge) => {
        const influencer = badge.kind === "INFLUENCER";
        return (
          <div
            key={badge.kind}
            className={cn(
              "rounded-2xl border px-3 py-2",
              badge.active
                ? influencer
                  ? "border-amber-400/40 bg-amber-400/10"
                  : "border-trust/40 bg-trust/10"
                : "border-border bg-surface",
            )}
          >
            <p className="flex items-center gap-1.5 text-xs font-bold">
              {influencer ? (
                <Star className="size-3.5 text-amber-400" />
              ) : (
                <Flame className="size-3.5 text-trust" />
              )}
              {influencer ? "Influenceur" : "Actif"}
              {badge.active ? "" : " · en cours"}
            </p>
            {!compact ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {badge.progress}/{badge.target}
                {influencer ? " abonnés" : " pts 30 j"}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
