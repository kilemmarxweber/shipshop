"use client";

import {
  useRef,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";

const LOCK_PX = 10;

type Axis = "x" | "y" | null;

/**
 * Rail horizontal : swipe gauche/droite = scroll du strip ;
 * swipe haut/bas = laisse le scroll page (.app-main).
 */
export function HScroll({
  className,
  children,
  fade = true,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { fade?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number; id: number; left: number } | null>(
    null,
  );
  const axisRef = useRef<Axis>(null);
  const capturedRef = useRef(false);
  const draggedRef = useRef(false);
  const suppressClickRef = useRef(false);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = rootRef.current;
    if (!el) return;
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      id: e.pointerId,
      left: el.scrollLeft,
    };
    axisRef.current = null;
    capturedRef.current = false;
    draggedRef.current = false;
    suppressClickRef.current = false;
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const start = startRef.current;
    const el = rootRef.current;
    if (!start || start.id !== e.pointerId || !el) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (!axisRef.current) {
      if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axisRef.current === "y") {
        // Scroll vertical page — abandonne le rail
        startRef.current = null;
        axisRef.current = null;
        return;
      }
      try {
        el.setPointerCapture(e.pointerId);
        capturedRef.current = true;
      } catch {
        /* ignore */
      }
      // preventDefault sur move exige touch-action: none
      el.style.touchAction = "none";
    }

    if (axisRef.current !== "x") return;
    draggedRef.current = true;
    e.preventDefault();
    el.scrollLeft = start.left - dx;
  }

  function endPointer(e: ReactPointerEvent<HTMLDivElement>) {
    const start = startRef.current;
    const el = rootRef.current;
    if (el) el.style.touchAction = "";
    if (capturedRef.current && el) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    const wasDrag = draggedRef.current;
    startRef.current = null;
    axisRef.current = null;
    capturedRef.current = false;
    draggedRef.current = false;
    if (wasDrag && start && start.id === e.pointerId) {
      suppressClickRef.current = true;
    }
  }

  function onClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div
      ref={rootRef}
      data-h-scroll=""
      className={cn("h-scroll", fade && "h-scroll-fade", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onClickCapture={onClickCapture}
      {...rest}
    >
      {children}
    </div>
  );
}
