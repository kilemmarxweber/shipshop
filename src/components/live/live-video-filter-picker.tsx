"use client";

import { Button } from "@/components/ui/button";
import {
    LIVE_VIDEO_FILTERS,
    type LiveVideoFilterId,
} from "@/lib/growth/live-video-filters";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  open: boolean;
  busy?: boolean;
  current?: string | null;
  onClose: () => void;
  onApply: (filterId: LiveVideoFilterId) => Promise<boolean>;
};

/** Galerie chips ronds (même langage que l’app mobile Live). */
export function LiveVideoFilterPicker({
  open,
  busy,
  current,
  onClose,
  onApply,
}: Props) {
  if (!open) return null;
  const active = current?.trim() || "natural";

  return (
    <>
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 z-[39] bg-black/55"
        onClick={onClose}
      />
      <div className="absolute inset-x-3 z-40 rounded-2xl border border-white/15 bg-[#121218]/95 p-3 shadow-xl backdrop-blur-md bottom-[max(5.25rem,calc(env(safe-area-inset-bottom)+4.75rem))] sm:bottom-24">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-white">Filtres Live</p>
            <p className="text-[11px] text-white/50">
              Looks · beauté · AR · stickers
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-white/70"
            onClick={onClose}
          >
            Fermer
          </Button>
        </div>

        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LIVE_VIDEO_FILTERS.map((f) => {
            const selected = active === f.id;
            return (
              <button
                key={f.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    const ok = await onApply(f.id);
                    if (ok) {
                      toast.success(
                        f.id === "natural"
                          ? "Filtres désactivés"
                          : `Filtre « ${f.label} »`,
                      );
                      onClose();
                    }
                  })();
                }}
                className="flex w-14 shrink-0 flex-col items-center gap-1.5 transition active:scale-[0.97]"
              >
                <span
                  className={cn(
                    "grid size-12 place-items-center rounded-full border-2 text-xl",
                    selected
                      ? "border-white bg-[#00D68F] shadow-[0_0_0_2px_rgba(0,214,143,0.35)]"
                      : "border-white/20 bg-black/45",
                  )}
                  style={selected ? undefined : { backgroundImage: f.swatch }}
                >
                  {f.emoji ?? ""}
                </span>
                <span
                  className={cn(
                    "w-full truncate text-center text-[10px] font-bold",
                    selected ? "text-[#7dffb3]" : "text-white/70",
                  )}
                >
                  {f.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
