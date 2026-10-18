"use client";

import { useEffect, useRef } from "react";

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
    const root = el.closest(".feed-snap");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onNearEndRef.current();
      },
      {
        root: root instanceof HTMLElement ? root : null,
        rootMargin: "80% 0px",
        threshold: 0.01,
      },
    );
    io.observe(el);
    return () => io.disconnect();
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
}: {
  onVisible: () => void;
  rootSelector?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rootEl = el.closest(rootSelector);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onVisibleRef.current();
      },
      {
        root: rootEl instanceof HTMLElement ? rootEl : null,
        rootMargin: "40% 0px",
        threshold: 0.01,
      },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootSelector]);

  return <div ref={ref} className="h-px w-full shrink-0" aria-hidden />;
}
