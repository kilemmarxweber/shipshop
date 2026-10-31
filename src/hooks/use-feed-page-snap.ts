"use client";

import { type RefObject, useEffect } from "react";

function isMobileReel() {
  return window.matchMedia("(orientation: portrait) and (max-width: 767px)")
    .matches;
}

/**
 * Mobile : un swipe = une card (TikTok).
 * CSS scroll-snap mandatory + correction si Android laisse un interstice.
 */
export function useFeedPageSnap(
  scrollRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const el = scrollRef.current;
    if (!el) return;

    let timer = 0;
    let touching = false;

    const items = () =>
      [...el.querySelectorAll(":scope > .feed-snap-item")].filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
      );

    const snap = () => {
      if (!isMobileReel() || touching) return;
      const list = items();
      if (!list.length) return;
      const y = el.scrollTop;
      let best = list[0];
      let dist = Math.abs(best.offsetTop - y);
      for (const item of list) {
        const d = Math.abs(item.offsetTop - y);
        if (d < dist) {
          dist = d;
          best = item;
        }
      }
      if (dist <= 2) return;
      el.scrollTo({
        top: best.offsetTop,
        behavior: dist < el.clientHeight * 0.4 ? "smooth" : "auto",
      });
    };

    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(snap, 90);
    };

    const onTouchStart = () => {
      touching = true;
      window.clearTimeout(timer);
    };
    const onTouchEnd = () => {
      touching = false;
      window.clearTimeout(timer);
      timer = window.setTimeout(snap, 60);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", snap);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("resize", snap, { passive: true });

    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", snap);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("resize", snap);
    };
  }, [scrollRef, enabled]);
}
