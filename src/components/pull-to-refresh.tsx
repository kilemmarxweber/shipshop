"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { clearAllFeedListCaches } from "@/lib/feed-list-cache";
import { cn } from "@/lib/utils";

const THRESHOLD = 68;

function canYScroll(el: HTMLElement) {
  const { overflowY } = window.getComputedStyle(el);
  if (!/(auto|scroll|overlay)/.test(overflowY)) return false;
  return el.scrollHeight > el.clientHeight + 2;
}

function isScrollNotAtTop(target: EventTarget | null, root: HTMLElement) {
  let node: HTMLElement | null =
    target instanceof HTMLElement
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  while (node) {
    if (canYScroll(node) && node.scrollTop > 8) return true;
    if (node === root) break;
    node = node.parentElement;
  }
  return canYScroll(root) && root.scrollTop > 8;
}

function isBlocked(target: EventTarget | null) {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  return Boolean(
    el.closest(
      "[data-slot='sheet-content'], [data-slot='dialog-content'], [role='dialog'], [data-no-ptr]",
    ),
  );
}

export function PullToRefresh({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const dyRef = useRef(0);
  const [dy, setDy] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const setPull = (value: number) => {
      dyRef.current = value;
      setDy(value);
    };

    const isFinger = (event: PointerEvent) =>
      event.pointerType === "touch" || event.pointerType === "pen";

    const onStart = (event: PointerEvent) => {
      if (busy || !isFinger(event) || isBlocked(event.target)) {
        pulling.current = false;
        return;
      }
      pulling.current = !isScrollNotAtTop(event.target, root);
      startY.current = event.clientY;
    };

    const onMove = (event: PointerEvent) => {
      if (!pulling.current || busy || !isFinger(event)) return;
      const raw = event.clientY - startY.current;
      if (raw <= 0) {
        setPull(0);
        return;
      }
      if (isScrollNotAtTop(event.target, root)) {
        pulling.current = false;
        setPull(0);
        return;
      }
      const next = Math.min(128, raw * 0.45);
      setPull(next);
      if (next > 10) event.preventDefault();
    };

    const finish = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      if (!pulling.current) {
        setPull(0);
        return;
      }
      pulling.current = false;
      if (dyRef.current >= THRESHOLD) {
        setBusy(true);
        clearAllFeedListCaches();
        window.location.reload();
        return;
      }
      setPull(0);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (busy || event.touches.length !== 1 || isBlocked(event.target)) {
        pulling.current = false;
        return;
      }
      pulling.current = !isScrollNotAtTop(event.target, root);
      startY.current = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!pulling.current || busy) return;
      const y = event.touches[0]?.clientY ?? 0;
      const raw = y - startY.current;
      if (raw <= 0) {
        setPull(0);
        return;
      }
      if (isScrollNotAtTop(event.target, root)) {
        pulling.current = false;
        setPull(0);
        return;
      }
      const next = Math.min(128, raw * 0.45);
      setPull(next);
      if (next > 10) event.preventDefault();
    };
    const onTouchEnd = () => {
      finish({ pointerType: "touch" } as PointerEvent);
    };

    root.addEventListener("pointerdown", onStart, { passive: true });
    root.addEventListener("pointermove", onMove, { passive: false });
    root.addEventListener("pointerup", finish);
    root.addEventListener("pointercancel", finish);
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", onTouchEnd);
    root.addEventListener("touchcancel", onTouchEnd);
    return () => {
      root.removeEventListener("pointerdown", onStart);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerup", finish);
      root.removeEventListener("pointercancel", finish);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [busy]);

  const show = dy > 8 || busy;
  const ready = dy >= THRESHOLD || busy;

  return (
    <div
      ref={rootRef}
      className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex items-start justify-center overflow-hidden"
        style={{ height: show ? Math.max(dy, busy ? 52 : 0) : 0 }}
        aria-hidden={!show}
      >
        {show ? (
          <div className="mt-[max(0.5rem,env(safe-area-inset-top))] grid size-8 place-items-center rounded-full border border-border bg-background/95 shadow">
            <Loader2
              className={cn("size-4 text-primary", ready && "animate-spin")}
            />
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
