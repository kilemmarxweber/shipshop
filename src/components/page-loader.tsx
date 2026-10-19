"use client";

import { FoxEmoji } from "@/components/fox-emoji";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  label?: string;
  fullScreen?: boolean;
};

/** Loader mascotte centré pour le chargement de page. */
export function PageLoader({
  className,
  label,
  fullScreen = false,
}: Props) {
  const aria = label ?? "Chargement";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-muted-foreground",
        fullScreen ? "min-h-dvh" : "h-[50dvh]",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={aria}
    >
      <FoxEmoji motion="load" className="size-16" alt="" />
      {label ? <p className="text-xs">{label}</p> : null}
    </div>
  );
}
