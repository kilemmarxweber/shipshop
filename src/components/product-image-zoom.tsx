"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { isVideoUrl, videoPosterUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

const MIN_SCALE = 1;
const MAX_SCALE = 4.5;
const TAP_PX = 10;

export function inspectImageUrls(images: string[]) {
  const out: string[] = [];
  for (const url of images) {
    const still = isVideoUrl(url) ? videoPosterUrl(url) : url;
    if (still && !out.includes(still)) out.push(still);
  }
  return out;
}

type ViewerProps = {
  src: string;
  alt: string;
  className?: string;
};

function ZoomViewport({ src, alt, className }: ViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null,
  );
  const lastTap = useRef(0);

  function commit(nextScale: number, nextTx: number, nextTy: number) {
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    let x = nextTx;
    let y = nextTy;
    if (s <= MIN_SCALE + 0.01) {
      x = 0;
      y = 0;
    }
    scaleRef.current = s;
    txRef.current = x;
    tyRef.current = y;
    setScale(s);
    setTx(x);
    setTy(y);
  }

  useEffect(() => {
    commit(1, 0, 0);
  }, [src]);

  function onPointerDown(e: React.PointerEvent) {
    const root = rootRef.current;
    if (!root) return;
    root.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        scale: scaleRef.current,
      };
      drag.current = null;
      return;
    }
    if (scaleRef.current > MIN_SCALE + 0.01) {
      drag.current = {
        x: e.clientX,
        y: e.clientY,
        tx: txRef.current,
        ty: tyRef.current,
      };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current.dist > 8) {
        commit(
          pinch.current.scale * (dist / pinch.current.dist),
          txRef.current,
          tyRef.current,
        );
      }
      return;
    }
    const d = drag.current;
    if (!d) return;
    commit(
      scaleRef.current,
      d.tx + (e.clientX - d.x),
      d.ty + (e.clientY - d.y),
    );
  }

  function endPointer(e: React.PointerEvent) {
    const start = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    drag.current = null;
    try {
      rootRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!start || pointers.current.size > 0) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > TAP_PX || Math.abs(dy) > TAP_PX) return;
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      if (scaleRef.current > 1.2) commit(1, 0, 0);
      else commit(2.4, 0, 0);
      return;
    }
    lastTap.current = now;
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const next = scaleRef.current * (e.deltaY < 0 ? 1.12 : 0.9);
    commit(next, txRef.current, tyRef.current);
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative overflow-hidden touch-none select-none",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={onWheel}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="pointer-events-none absolute inset-0 size-full object-contain"
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: "center center",
        }}
      />
    </div>
  );
}

type Props = {
  images: string[];
  alt?: string;
  className?: string;
  hint: string;
  openLabel: string;
  closeLabel: string;
  /** bouton seul (fiche produit) — le zoom s’ouvre en plein écran */
  trigger?: "pane" | "button";
};

export function ProductImageZoom({
  images,
  alt = "",
  className,
  hint,
  openLabel,
  closeLabel,
  trigger = "pane",
}: Props) {
  const stills = useMemo(() => inspectImageUrls(images), [images]);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const src = stills[Math.min(index, Math.max(0, stills.length - 1))] ?? null;

  useEffect(() => {
    setIndex(0);
    setOpen(false);
  }, [stills.join("|")]);

  if (!src) {
    return trigger === "pane" ? (
      <div className={cn("bg-surface-2", className)} />
    ) : null;
  }

  const thumbs =
    stills.length > 1 ? (
      <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5 px-2">
        {stills.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex(i);
            }}
            className={cn(
              "size-9 overflow-hidden rounded-lg border",
              i === index ? "border-white ring-2 ring-primary" : "border-white/40",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="size-full object-cover" />
          </button>
        ))}
      </div>
    ) : null;

  return (
    <>
      {trigger === "button" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "grid size-10 place-items-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur",
            className,
          )}
          aria-label={openLabel}
        >
          <Search className="size-4" />
        </button>
      ) : (
        <div className={cn("relative bg-black", className)}>
          <ZoomViewport src={src} alt={alt} className="absolute inset-0 size-full" />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur"
            aria-label={openLabel}
          >
            <Search className="size-4" />
          </button>
          {thumbs}
          <p
            className={cn(
              "pointer-events-none absolute left-1/2 z-10 w-max max-w-[90%] -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-[10px] font-semibold text-white/90 backdrop-blur",
              stills.length > 1 ? "bottom-14" : "bottom-3",
            )}
          >
            {hint}
          </p>
        </div>
      )}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex flex-col bg-black">
              <div className="flex shrink-0 items-center justify-between px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <p className="text-xs font-semibold text-white/80">{hint}</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid size-10 place-items-center rounded-full border border-white/20 bg-white/10 text-white"
                  aria-label={closeLabel}
                >
                  <X className="size-4" />
                </button>
              </div>
              <ZoomViewport src={src} alt={alt} className="min-h-0 flex-1" />
              {stills.length > 1 ? (
                <div className="flex justify-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
                  {stills.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setIndex(i)}
                      className={cn(
                        "h-14 w-14 overflow-hidden rounded-xl border",
                        i === index
                          ? "border-white ring-2 ring-primary"
                          : "border-white/30",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
