"use client";

import { useEffect } from "react";

function isIos() {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Remplit toujours la fenêtre (Chrome / Android / desktop).
 * Sur iOS, ne resserre que si le clavier ouvre (visualViewport plus petit).
 */
export function useVisualViewportLock() {
  useEffect(() => {
    const root = document.documentElement;

    const sync = () => {
      const inner = window.innerHeight;
      const vv = window.visualViewport;
      const vvH = vv?.height ?? inner;
      const vvTop = vv?.offsetTop ?? 0;
      const keyboardOpen = isIos() && vvH < inner - 80;

      root.style.setProperty("--app-height", `${Math.round(inner)}px`);
      if (keyboardOpen) {
        root.style.setProperty("--vv-top", `${Math.round(vvTop)}px`);
        root.style.setProperty(
          "--vv-bottom",
          `${Math.round(Math.max(0, inner - vvTop - vvH))}px`,
        );
      } else {
        root.style.setProperty("--vv-top", "0px");
        root.style.setProperty("--vv-bottom", "0px");
      }
    };

    sync();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("orientationchange", sync);
    window.addEventListener("resize", sync);
    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);
}
