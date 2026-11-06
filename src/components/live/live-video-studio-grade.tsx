"use client";

import {
    liveVideoFilterCss,
    resolveLiveVideoFilter,
} from "@/lib/growth/live-video-filters";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

/** Grade couleur + stickers AR (uniquement si filtre ≠ naturel). */
export function LiveVideoStudioGrade({
  filterId,
  className,
}: {
  filterId?: string | null;
  className?: string;
}) {
  const row = resolveLiveVideoFilter(filterId);
  if (row.id === "natural") return null;

  const stickerTop =
    row.anchor === "head" ? "8%" : row.anchor === "eyes" ? "34%" : "42%";

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-[2]", className)}
      aria-hidden
    >
      {row.grade ? (
        <div
          className="absolute inset-0 mix-blend-soft-light"
          style={{ backgroundImage: row.grade }}
        />
      ) : null}
      {row.id === "studio" || row.id === "soft" || row.id === "warm" ? (
        <div className="absolute inset-0 bg-[rgba(255,175,145,0.05)] mix-blend-overlay" />
      ) : null}
      {row.kind === "overlay" && row.emoji ? (
        <div
          className="absolute inset-x-0 flex justify-center text-[clamp(2.5rem,8vw,3.75rem)] drop-shadow-lg"
          style={{ top: stickerTop }}
        >
          {row.emoji}
        </div>
      ) : null}
      {row.kind === "animation" && row.emoji && row.id !== "sparkle" ? (
        <>
          <div
            className="absolute left-[18%] animate-pulse text-[clamp(1.75rem,5vw,2.5rem)]"
            style={{ top: stickerTop }}
          >
            {row.emoji}
          </div>
          <div
            className="absolute right-[18%] animate-pulse text-[clamp(1.75rem,5vw,2.5rem)]"
            style={{ top: stickerTop }}
          >
            {row.emoji}
          </div>
        </>
      ) : null}
      {row.id === "sparkle" ? (
        <>
          {["12%", "28%", "55%", "72%", "84%"].map((left, i) => (
            <span
              key={left}
              className="absolute animate-pulse text-amber-200"
              style={{
                left,
                top: `${16 + (i % 4) * 14}%`,
                fontSize: `${14 + (i % 3) * 6}px`,
              }}
            >
              ✦
            </span>
          ))}
        </>
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
