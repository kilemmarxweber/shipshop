"use client";

import Link from "next/link";
import { useRef } from "react";
import { X } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import type { LiveOverlay } from "@/lib/growth/live-overlays";

type Props = {
  overlays: LiveOverlay[];
  editable: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (next: LiveOverlay[]) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function LiveStageOverlays({
  overlays,
  editable,
  selectedId,
  onSelect,
  onChange,
}: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);

  function patch(id: string, partial: Partial<LiveOverlay>) {
    onChange(
      overlays.map((o) =>
        o.id === id ? ({ ...o, ...partial } as LiveOverlay) : o,
      ),
    );
  }

  function remove(id: string) {
    onChange(overlays.filter((o) => o.id !== id));
    if (selectedId === id) onSelect(null);
  }

  function startDrag(
    e: React.PointerEvent,
    id: string,
    mode: "move" | "scale",
  ) {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(id);
    const el = stageRef.current;
    const item = overlays.find((o) => o.id === id);
    if (!el || !item) return;
    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* older WebViews */
    }
    const rect = el.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = item.x;
    const origY = item.y;
    const origScale = item.scale;

    const onMove = (ev: PointerEvent) => {
      if (mode === "move") {
        const dx = ((ev.clientX - startX) / rect.width) * 100;
        const dy = ((ev.clientY - startY) / rect.height) * 100;
        patch(id, {
          x: clamp(origX + dx, 4, 96),
          y: clamp(origY + dy, 6, 94),
        });
      } else {
        const dx = ev.clientX - startX;
        const next = clamp(origScale + dx / 140, 0.55, 2.3);
        patch(id, { scale: next });
      }
    };
    const onUp = (ev: PointerEvent) => {
      try {
        target.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  return (
    <div
      ref={stageRef}
      className="pointer-events-none absolute inset-0 z-[15]"
      onClick={() => editable && onSelect(null)}
    >
      {overlays.map((o) => {
        const selected = editable && selectedId === o.id;
        const base = cn(
          "absolute -translate-x-1/2 -translate-y-1/2 touch-none select-none",
          editable ? "pointer-events-auto cursor-grab active:cursor-grabbing" : "pointer-events-auto",
          selected && "z-20 ring-2 ring-white/80 ring-offset-2 ring-offset-transparent",
        );
        const style = {
          left: `${o.x}%`,
          top: `${o.y}%`,
          transform: `translate(-50%, -50%) scale(${o.scale})`,
        } as const;

        if (o.kind === "text") {
          return (
            <div
              key={o.id}
              className={base}
              style={style}
              onPointerDown={(e) => startDrag(e, o.id, "move")}
              onClick={(e) => {
                e.stopPropagation();
                if (editable) onSelect(o.id);
              }}
            >
              <p
                className="max-w-[14rem] rounded-xl bg-black/55 px-3 py-1.5 text-center text-[15px] font-extrabold leading-snug text-white shadow-lg backdrop-blur-sm"
                style={o.color ? { color: o.color } : undefined}
              >
                {o.text}
              </p>
              {selected ? (
                <OverlayChrome
                  onScale={(e) => startDrag(e, o.id, "scale")}
                  onRemove={() => remove(o.id)}
                />
              ) : null}
            </div>
          );
        }

        const card = (
          <div className="w-[9.5rem] overflow-hidden rounded-2xl border border-white/25 bg-black/60 shadow-xl backdrop-blur-md">
            {o.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={o.image}
                alt=""
                className="aspect-square w-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="aspect-square w-full bg-white/10" />
            )}
            <div className="space-y-0.5 p-2">
              <p className="line-clamp-2 text-[11px] font-bold leading-tight text-white">
                {o.title}
              </p>
              <p className="text-[12px] font-extrabold text-[#7dffb3]">
                {formatMoney(o.priceCents)}
              </p>
              {o.note ? (
                <p className="line-clamp-3 text-[10px] leading-snug text-white/75">
                  {o.note}
                </p>
              ) : null}
            </div>
          </div>
        );

        return (
          <div
            key={o.id}
            className={base}
            style={style}
            onPointerDown={(e) => {
              if (editable) startDrag(e, o.id, "move");
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (editable) onSelect(o.id);
            }}
          >
            {editable ? (
              card
            ) : (
              <Link href={`/product/${o.productId}`} className="block">
                {card}
              </Link>
            )}
            {selected ? (
              <OverlayChrome
                onScale={(e) => startDrag(e, o.id, "scale")}
                onRemove={() => remove(o.id)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function OverlayChrome({
  onScale,
  onRemove,
}: {
  onScale: (e: React.PointerEvent) => void;
  onRemove: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-destructive text-white shadow"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label="Retirer"
      >
        <X className="size-3.5" />
      </button>
      <button
        type="button"
        className="absolute -bottom-2 -right-2 size-5 rounded-full border-2 border-white bg-trust shadow"
        onPointerDown={(e) => {
          e.stopPropagation();
          onScale(e);
        }}
        aria-label="Redimensionner"
      />
    </>
  );
}
