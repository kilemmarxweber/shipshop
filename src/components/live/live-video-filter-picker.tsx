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
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-white">Filtres Live</p>
            <p className="text-[11px] text-white/50">
              Aucun · beauté · couleurs · chapeau · lunettes · emojis
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

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                className={cn(
                  "w-[4.5rem] shrink-0 overflow-hidden rounded-xl border text-center transition active:scale-[0.98]",
                  selected
                    ? "border-[#7dffb3] ring-1 ring-[#7dffb3]/60"
                    : "border-white/15",
                )}
              >
                <div
                  className="grid aspect-square w-full place-items-center text-2xl"
                  style={{ backgroundImage: f.swatch }}
                >
                  {f.emoji ?? ""}
                </div>
                <div className="bg-black/45 px-1 py-1">
                  <p className="truncate text-[10px] font-bold text-white">
                    {f.label}
                  </p>
                  <p className="truncate text-[9px] text-white/50">{f.hint}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
