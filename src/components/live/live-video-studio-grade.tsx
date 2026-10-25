"use client";

import type { CSSProperties } from "react";
import {
  resolveLiveVideoFilter,
  liveVideoFilterCss,
} from "@/lib/growth/live-video-filters";
import { cn } from "@/lib/utils";

/** Grade couleur optionnel (uniquement si filtre ≠ naturel). */
export function LiveVideoStudioGrade({
  filterId,
  className,
}: {
  filterId?: string | null;
  className?: string;
}) {
  const row = resolveLiveVideoFilter(filterId);
  if (!row.grade || row.id === "natural") return null;
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-[2]", className)}
      aria-hidden
    >
      <div
        className="absolute inset-0 mix-blend-soft-light"
        style={{ backgroundImage: row.grade }}
      />
      {row.id === "studio" || row.id === "soft" || row.id === "warm" ? (
        <div className="absolute inset-0 bg-[rgba(255,175,145,0.05)] mix-blend-overlay" />
      ) : null}
    </div>
  );
}

/** Style CSS `filter` pour les `<video>` — undefined si naturel. */
export function liveVideoFilterStyle(
  filterId?: string | null,
): CSSProperties | undefined {
  const css = liveVideoFilterCss(filterId);
  if (!css) return undefined;
  return { filter: css };
}
