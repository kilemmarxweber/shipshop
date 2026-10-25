"use client";

import { type RefObject, useEffect, useState } from "react";

/**
 * Index de la card snap visible (scrollTop / hauteur viewport) — base
 * pour la fenêtre mémoire TikTok (actif ± N).
 */
export function useSnapActiveIndex(
  scrollRef: RefObject<HTMLElement | null>,
  itemCount: number,
  resetKey?: string | number,
) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [resetKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || itemCount <= 0) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      const h = el.clientHeight;
      if (h <= 0) return;
      // Hystérésis : bascule dès ~45 % vers la card suivante (son + warm plus tôt)
      const raw = el.scrollTop / h;
      setActiveIndex((prev) => {
        let next = prev;
        if (raw > prev + 0.45) next = Math.floor(raw + 0.55);
        else if (raw < prev - 0.45) next = Math.ceil(raw - 0.55);
        else next = Math.round(raw);
        next = Math.max(0, Math.min(itemCount - 1, next));
        return next === prev ? prev : next;
      });
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(measure);
    };

    measure();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [scrollRef, itemCount, resetKey]);

  return activeIndex;
}

/** Fenêtre mémoire : cards dont le player reste monté. */
export const FEED_WARM_RADIUS = 2;

export function isFeedIndexWarm(
  index: number,
  activeIndex: number,
  radius = FEED_WARM_RADIUS,
) {
  return Math.abs(index - activeIndex) <= radius;
}
