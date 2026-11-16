"use client";

import { Button } from "@/components/ui/button";
import {
    LIVE_VIDEO_FILTERS,
    applyLiveVideoFilterPick,
    encodeLiveVideoFilterCombo,
    isPropKind,
    isToneKind,
    parseLiveVideoFilterCombo,
    type LiveVideoFilterId,
} from "@/lib/growth/live-video-filters";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  busy?: boolean;
  current?: string | null;
  onClose: () => void;
  onApply: (filterId: LiveVideoFilterId | string) => Promise<boolean>;
};

/** Galerie : teint + accessoire simultanés (glisse horizontale). */
export function LiveVideoFilterPicker({
  open,
  busy,
  current,
  onClose,
  onApply,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const parsed = useMemo(() => parseLiveVideoFilterCombo(current), [current]);
  const [draft, setDraft] = useState({
    toneId: null as string | null,
    propId: null as string | null,
  });

  useEffect(() => {
    if (!open) return;
    setDraft({
      toneId: parsed.tone?.id ?? null,
      propId: parsed.prop?.id ?? null,
    });
  }, [open, parsed.tone?.id, parsed.prop?.id]);

  if (!open) return null;

  const tones = LIVE_VIDEO_FILTERS.filter(
    (f) => f.id === "natural" || isToneKind(f.kind),
  );
  const props = LIVE_VIDEO_FILTERS.filter((f) => isPropKind(f.kind));

  function selected(id: string) {
    if (id === "natural") return !draft.toneId && !draft.propId;
    return draft.toneId === id || draft.propId === id;
  }

  function onPick(id: string) {
    setDraft((prev) => applyLiveVideoFilterPick(prev, id));
  }

  async function save() {
    const encoded = encodeLiveVideoFilterCombo(draft);
    const ok = await onApply(encoded);
    if (ok) {
      const toneLabel =
        LIVE_VIDEO_FILTERS.find((f) => f.id === draft.toneId)?.label ?? null;
      const propLabel =
        LIVE_VIDEO_FILTERS.find((f) => f.id === draft.propId)?.label ?? null;
      toast.success(
        !toneLabel && !propLabel
          ? "Filtres désactivés"
          : [toneLabel, propLabel].filter(Boolean).join(" + "),
      );
      onClose();
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 z-[39] bg-black/55"
        onClick={onClose}
      />
      <div
        className="pointer-events-auto absolute inset-x-3 z-40 rounded-2xl border border-white/15 bg-[#121218]/95 p-3 shadow-xl backdrop-blur-md bottom-[max(5.25rem,calc(env(safe-area-inset-bottom)+4.75rem))] sm:bottom-24"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-white">Filtres Live</p>
            <p className="text-[11px] text-white/50">
              Teint + accessoire en même temps · glisse →
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

        <p className="mb-1.5 text-[10px] font-bold tracking-wide text-white/45 uppercase">
          Teint
        </p>
        <FilterRow
          scrollerRef={scrollerRef}
          items={tones}
          selected={selected}
          busy={busy}
          onPick={onPick}
        />

        <p className="mb-1.5 mt-3 text-[10px] font-bold tracking-wide text-white/45 uppercase">
          Accessoire (yeux / tête)
        </p>
        <FilterRow
          items={props}
          selected={selected}
          busy={busy}
          onPick={onPick}
        />

        <Button
          type="button"
          className="mt-3 h-10 w-full font-extrabold"
          disabled={busy}
          onClick={() => void save()}
        >
          Appliquer
          {draft.toneId || draft.propId
            ? ` · ${[draft.toneId, draft.propId].filter(Boolean).join(" + ")}`
            : " · aucun"}
        </Button>
      </div>
    </>
  );
}

function FilterRow({
  items,
  selected,
  busy,
  onPick,
  scrollerRef,
}: {
  items: typeof LIVE_VIDEO_FILTERS;
  selected: (id: string) => boolean;
  busy?: boolean;
  onPick: (id: string) => void;
  scrollerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={scrollerRef}
      className="min-w-0 w-full touch-pan-x overscroll-x-contain overflow-x-auto overflow-y-hidden pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
      onWheel={(e) => {
        const el = e.currentTarget;
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          el.scrollLeft += e.deltaY;
          e.preventDefault();
        }
        e.stopPropagation();
      }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex w-max gap-3 px-1">
        {items.map((f) => {
          const on = selected(f.id);
          return (
            <button
              key={f.id}
              type="button"
              disabled={busy}
              onClick={() => onPick(f.id)}
              className="flex w-14 shrink-0 flex-col items-center gap-1.5 transition active:scale-[0.97]"
            >
              <span
                className={cn(
                  "grid size-12 place-items-center rounded-full border-2 text-xl",
                  on
                    ? "border-white bg-[#00D68F] shadow-[0_0_0_2px_rgba(0,214,143,0.35)]"
                    : "border-white/20 bg-black/45",
                )}
                style={on ? undefined : { backgroundImage: f.swatch }}
              >
                {f.emoji ?? ""}
              </span>
              <span
                className={cn(
                  "w-full truncate text-center text-[10px] font-bold",
                  on ? "text-[#7dffb3]" : "text-white/70",
                )}
              >
                {f.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
