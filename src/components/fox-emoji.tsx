"use client";

import { cn } from "@/lib/utils";

export const FOX_EMOJI_SRC = "/fox-emoji.jpg";

type Motion = "ok" | "load" | "sad" | "idle";

type Props = {
  className?: string;
  motion?: Motion;
  alt?: string;
};

const MOTION_CLASS: Record<Motion, string> = {
  ok: "fox-emoji-ok",
  load: "fox-emoji-load",
  sad: "fox-emoji-sad",
  idle: "",
};

/** Petit mascotte-renard (toast succès + loader). */
export function FoxEmoji({
  className,
  motion = "idle",
  alt = "ShipShop",
}: Props) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-visible",
        motion === "ok" && "fox-emoji-ok-wrap",
        motion === "load" && "fox-emoji-load-wrap",
        motion === "sad" && "fox-emoji-sad-wrap",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={FOX_EMOJI_SRC}
        alt={alt}
        width={40}
        height={40}
        draggable={false}
        className={cn(
          "size-full rounded-full object-cover",
          MOTION_CLASS[motion],
        )}
      />
    </span>
  );
}
