"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadCompressedMedia } from "@/lib/compress-media";
import {
  LIVE_BACKDROP_PRESETS,
  type LiveBackdropPresetId,
} from "@/lib/growth/live-backdrops";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  busy?: boolean;
  currentPreset?: string | null;
  currentUrl?: string | null;
  onClose: () => void;
  onApply: (next: {
    preset?: LiveBackdropPresetId | null;
    url?: string | null;
  }) => Promise<boolean>;
};

export function LiveBackdropPicker({
  open,
  busy,
  currentPreset,
  currentUrl,
  onClose,
  onApply,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  if (!open) return null;

  const locked = Boolean(busy || uploading);

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
            <p className="text-sm font-bold text-white">Fond du live</p>
            <p className="text-[11px] text-white/50">
              Temporaire — supprimé à la fin du live
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

        <div className="grid grid-cols-3 gap-2">
          {LIVE_BACKDROP_PRESETS.map((p) => {
            const active = currentPreset === p.id && !currentUrl;
            return (
              <button
                key={p.id}
                type="button"
                disabled={locked}
                onClick={() => {
                  void (async () => {
                    const ok = await onApply({ preset: p.id, url: null });
                    if (ok) {
                      toast.success(`Fond « ${p.label} »`);
                      onClose();
                    }
                  })();
                }}
                className={cn(
                  "overflow-hidden rounded-xl border text-left transition active:scale-[0.98]",
                  active
                    ? "border-[#7dffb3] ring-1 ring-[#7dffb3]/60"
                    : "border-white/15",
                )}
              >
                <div
                  className="aspect-[4/3] w-full"
                  style={{ backgroundImage: p.css }}
                />
                <p className="truncate bg-black/40 px-2 py-1 text-[10px] font-semibold text-white/85">
                  {p.label}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              void (async () => {
                setUploading(true);
                try {
                  const { url } = await uploadCompressedMedia(file, "product");
                  const ok = await onApply({ preset: null, url });
                  if (ok) {
                    toast.success("Image de fond ajoutée");
                    onClose();
                  }
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Upload impossible",
                  );
                } finally {
                  setUploading(false);
                }
              })();
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={locked}
            className="flex-1 rounded-full bg-white/10 font-semibold text-white hover:bg-white/15"
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="mr-1.5 size-4" />
            {uploading ? "Envoi…" : "Mon image"}
          </Button>
          {(currentPreset || currentUrl) && (
            <Button
              type="button"
              size="sm"
              disabled={locked}
              variant="ghost"
              className="rounded-full text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
              onClick={() => {
                void (async () => {
                  const ok = await onApply({ preset: null, url: null });
                  if (ok) {
                    toast.message("Fond retiré");
                    onClose();
                  }
                })();
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>

        {currentUrl ? (
          <p className="mt-2 truncate text-[10px] text-white/45">
            Image perso active (supprimée à la fin)
          </p>
        ) : null}
      </div>
    </>
  );
}
