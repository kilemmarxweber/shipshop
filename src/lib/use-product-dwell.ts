"use client";

import { useEffect, useRef } from "react";

const PING_MS = 8_000;
const MIN_FLUSH_MS = 4_000;
const MAX_DELTA_MS = 20_000;

function sendDwell(
  productId: string,
  deltaMs: number,
  source: "feed" | "product" = "feed",
) {
  const ms = Math.min(MAX_DELTA_MS, Math.trunc(deltaMs));
  if (!productId || ms < MIN_FLUSH_MS) return;
  void fetch(`/api/products/${productId}/dwell`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deltaMs: ms, source }),
    keepalive: true,
  }).catch(() => undefined);
}

/** Compte le temps réel passé à regarder un produit (onglet visible). */
export function useProductDwell(
  productId: string | null | undefined,
  enabled: boolean,
) {
  const acc = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    if (!enabled || !productId) return;
    acc.current = 0;
    last.current = Date.now();

    function tick(force: boolean) {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        last.current = Date.now();
        return;
      }
      const now = Date.now();
      acc.current += now - last.current;
      last.current = now;
      if (force || acc.current >= PING_MS) {
        sendDwell(productId!, acc.current, "product");
        acc.current = 0;
      }
    }

    const interval = window.setInterval(() => tick(false), PING_MS);
    const onHide = () => tick(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      tick(true);
    };
  }, [productId, enabled]);
}

/** Feed : n’envoie le dwell que si la carte est majoritairement à l’écran. */
export function useVisibleProductDwell(
  productId: string,
  enabled: boolean,
  node: { current: Element | null },
) {
  const visible = useRef(false);
  const acc = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    if (!enabled || !productId) return;
    const el = node.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      ([entry]) => {
        const now = Date.now();
        if (visible.current && last.current) {
          acc.current += now - last.current;
        }
        visible.current = Boolean(entry?.isIntersecting);
        last.current = now;
      },
      { threshold: 0.55 },
    );
    io.observe(el);

    function flush(force: boolean) {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        last.current = Date.now();
        return;
      }
      const now = Date.now();
      if (visible.current && last.current) {
        acc.current += now - last.current;
      }
      last.current = now;
      if (force || acc.current >= PING_MS) {
        sendDwell(productId, acc.current, "feed");
        acc.current = 0;
      }
    }

    const interval = window.setInterval(() => flush(false), PING_MS);
    const onHide = () => flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      io.disconnect();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      flush(true);
    };
  }, [productId, enabled, node]);
}
