import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  label?: string;
  fullScreen?: boolean;
};

/** Loader circulaire centré pour le chargement de page. */
export function PageLoader({
  className,
  label,
  fullScreen = false,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-muted-foreground",
        fullScreen ? "min-h-dvh" : "h-[50dvh]",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={label ?? "Chargement"}
    >
      <Loader2 className="size-8 animate-spin text-primary" />
      {label ? <p className="text-xs">{label}</p> : null}
    </div>
  );
}
