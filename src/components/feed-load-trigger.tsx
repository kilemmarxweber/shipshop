"use client";

import { useEffect, useRef } from "react";

function isScrollable(el: HTMLElement) {
  const oy = getComputedStyle(el).overflowY;
  if (oy !== "auto" && oy !== "scroll" && oy !== "overlay") return false;
  return el.scrollHeight > el.clientHeight + 8;
}

/** Conteneur qui scrolle vraiment (snap mobile, app-main desktop). */
function feedScrollRoot(el: Element, preferred?: string): HTMLElement | null {
  if (preferred) {
    const chosen = el.closest(preferred) ?? document.querySelector(preferred);
    if (chosen instanceof HTMLElement && isScrollable(chosen)) return chosen;
  }
  const snap = el.closest(".feed-snap");
  if (snap instanceof HTMLElement && isScrollable(snap)) return snap;
  const main = document.querySelector(".app-main");
  if (main instanceof HTMLElement && isScrollable(main)) return main;
  return null;
}

function observeUntilEnd(
  el: Element,
  onHit: () => void,
  rootMargin: string,
  preferredRoot?: string,
) {
  const root = feedScrollRoot(el, preferredRoot);
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) onHit();
    },
    { root, rootMargin, threshold: 0.01 },
  );
  io.observe(el);
  const onScroll = () => {
    const box = el.getBoundingClientRect();
    const rootBox = root?.getBoundingClientRect();
    const top = rootBox ? rootBox.bottom : window.innerHeight;
    if (box.top < top + 480) onHit();
  };
  const scrollEl: HTMLElement | Window = root ?? window;
  scrollEl.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    io.disconnect();
    scrollEl.removeEventListener("scroll", onScroll);
  };
}

/** Observe the 2nd-to-last snap card so the next page loads before the user arrives. */
export function FeedLoadTrigger({
  onNearEnd,
  disabled,
}: {
  onNearEnd: () => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onNearEndRef = useRef(onNearEnd);
  onNearEndRef.current = onNearEnd;

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;
    return observeUntilEnd(el, () => onNearEndRef.current(), "120% 0px");
  }, [disabled]);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0"
      aria-hidden
    />
  );
}

export function FeedLoadSentinel({
  onVisible,
  rootSelector = ".feed-snap",
  resumeKey,
}: {
  onVisible: () => void;
  rootSelector?: string;
  /** Change after each page so a still-visible sentinel loads the next lot. */
  resumeKey?: string | number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observeUntilEnd(
      el,
      () => onVisibleRef.current(),
      "80% 0px",
      rootSelector,
    );
  }, [rootSelector, resumeKey]);

  return <div ref={ref} className="h-px w-full shrink-0" aria-hidden />;
}
