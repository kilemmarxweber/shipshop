"use client";

import { useEffect, useRef, useState } from "react";
import { isVideoUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

type Props = {
  images: string[];
  className?: string;
  intervalMs?: number;
  showDots?: boolean;
  overlay?: boolean;
  /** cover = remplit la card ; contain = image entière visible */
  fit?: "cover" | "contain";
  /** Charge tout de suite (fiche produit). Sinon, seulement hors écran proche. */
  eager?: boolean;
};

const SWIPE_MIN_PX = 42;
const IN_VIEW_RATIO = 0.55;
const LEFT_VIEW_RATIO = 0.4;

function mediaClass(fit: "cover" | "contain") {
  return cn(
    "pointer-events-none",
    fit === "cover"
      ? "absolute inset-0 size-full object-cover object-center"
      : "max-h-full max-w-full object-contain object-center",
  );
}

function SlideMedia({
  src,
  active,
  fit,
}: {
  src: string;
  active: boolean;
  fit: "cover" | "contain";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const video = isVideoUrl(src);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [active, src]);

  if (video) {
    return (
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        preload={active ? "auto" : "metadata"}
        className={mediaClass(fit)}
        style={{ objectPosition: "center center" }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      draggable={false}
      loading={active ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={active ? "high" : "low"}
      className={mediaClass(fit)}
      style={{ objectPosition: "center center" }}
    />
  );
}

function scrollRootFor(el: HTMLElement): Element | null {
  const snap = el.closest(".feed-snap");
  if (snap instanceof HTMLElement) {
    const overflowY = getComputedStyle(snap).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return snap;
  }
  const main = el.closest(".app-main");
  return main instanceof HTMLElement ? main : null;
}

export function ProductImageCarousel({
  images,
  className,
  intervalMs = 3200,
  showDots = true,
  overlay = false,
  fit = "cover",
  eager = false,
}: Props) {
  const list =
    images.length > 0
      ? images
      : ["https://picsum.photos/seed/chipshop/800/1000"];
  const [index, setIndex] = useState(0);
  const [inView, setInView] = useState(eager);
  const [nearView, setNearView] = useState(eager);
  /** Pause auto tant que l'utilisateur reste sur cette card après un swap manuel */
  const [manualHold, setManualHold] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const lockedAxis = useRef<"x" | "y" | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const target =
      el.closest(".feed-snap-item") instanceof HTMLElement
        ? (el.closest(".feed-snap-item") as HTMLElement)
        : el;
    const root = scrollRootFor(el);

    const loadIo = eager
      ? null
      : new IntersectionObserver(
          ([entry]) => {
            if (!entry) return;
            setNearView(entry.isIntersecting);
          },
          { root, rootMargin: "220px 0px", threshold: 0.01 },
        );

    const playIo = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const ratio = entry.intersectionRatio;
        if (ratio < LEFT_VIEW_RATIO) {
          setInView(false);
          setManualHold(false);
          return;
        }
        if (ratio >= IN_VIEW_RATIO) {
          setInView(true);
        }
      },
      {
        root,
        threshold: [0, 0.25, LEFT_VIEW_RATIO, IN_VIEW_RATIO, 0.75, 1],
      },
    );

    loadIo?.observe(target);
    playIo.observe(target);
    return () => {
      loadIo?.disconnect();
      playIo.disconnect();
    };
  }, [eager]);

  useEffect(() => {
    if (list.length <= 1 || manualHold || !inView) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % list.length);
    }, intervalMs);
    return () => clearInterval(t);
  }, [list.length, intervalMs, manualHold, inView]);

  function goManual(next: number) {
    setIndex(((next % list.length) + list.length) % list.length);
    setManualHold(true);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (list.length <= 1 || e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    lockedAxis.current = null;
    try {
      rootRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const start = startRef.current;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!lockedAxis.current) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      lockedAxis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (lockedAxis.current === "x") {
      e.preventDefault();
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const start = startRef.current;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const axis = lockedAxis.current;
    startRef.current = null;
    lockedAxis.current = null;
    try {
      rootRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (axis !== "x" || Math.abs(dx) < SWIPE_MIN_PX) return;
    if (dx < 0) goManual(index + 1);
    else goManual(index - 1);
  }

  function onPointerCancel() {
    startRef.current = null;
    lockedAxis.current = null;
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative touch-pan-y overflow-hidden bg-surface-2 select-none",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      role="group"
      aria-roledescription="carousel"
      aria-label="Images produit"
    >
      {list.map((src, i) => {
        const active = i === index;
        const neighbor =
          list.length > 1 &&
          (i === (index + 1) % list.length ||
            i === (index - 1 + list.length) % list.length);
        const mount = (eager || nearView) && (active || neighbor);
        return (
          <div
            key={`${src}-${i}`}
            className={cn(
              "absolute inset-0 flex items-center justify-center overflow-hidden transition-opacity duration-500",
              active ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
            aria-hidden={!active}
          >
            {mount ? (
              <SlideMedia src={src} active={active && inView} fit={fit} />
            ) : null}
            {overlay && (
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a0a0f]/95 via-[#0a0a0f]/25 to-transparent" />
            )}
          </div>
        );
      })}
      {showDots && list.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {list.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Image ${i + 1}`}
              aria-current={i === index}
              onClick={(e) => {
                e.stopPropagation();
                goManual(i);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-4 bg-white" : "w-1.5 bg-white/40",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
