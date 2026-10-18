"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Un seul écran a le droit de jouer du son :
 * la route visible, et seulement si l’onglet est au premier plan.
 */
type Listener = () => void;

const listeners = new Set<Listener>();
let route = "";
let documentVisible = true;

function notify() {
  for (const listener of listeners) listener();
}

export function getPageMediaRoute() {
  return route;
}

export function isPageMediaDocumentVisible() {
  return documentVisible;
}

export function isPageMediaLive(pageKey: string) {
  return Boolean(pageKey) && documentVisible && route === pageKey;
}

export function subscribePageMedia(listener: Listener) {
  listeners.add(listener);
  listener();
  return () => {
    listeners.delete(listener);
  };
}

export function pauseAllPageMedia() {
  if (typeof document === "undefined") return;
  document.querySelectorAll("audio, video").forEach((node) => {
    if (!(node instanceof HTMLMediaElement)) return;
    node.pause();
  });
}

export function bindPageMediaRoute(next: string) {
  if (route === next) return false;
  route = next;
  return true;
}

/** À monter une fois dans le shell. */
export function useBindPageMediaSession() {
  const pathname = usePathname();

  // Met à jour la route pendant le render, sans setState chez les enfants.
  bindPageMediaRoute(pathname);

  useLayoutEffect(() => {
    bindPageMediaRoute(pathname);
    pauseAllPageMedia();
  }, [pathname]);

  useEffect(() => {
    notify();
  }, [pathname]);

  useEffect(() => {
    const syncVis = () => {
      const vis = !document.hidden;
      if (vis === documentVisible) return;
      documentVisible = vis;
      if (!vis) pauseAllPageMedia();
      notify();
    };
    documentVisible = !document.hidden;
    document.addEventListener("visibilitychange", syncVis);
    return () => document.removeEventListener("visibilitychange", syncVis);
  }, []);
}

/** Clé figée au montage : une page cachée (cache Next) reste muette. */
export function usePageMediaLive() {
  const [pageKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return getPageMediaRoute() || window.location.pathname;
  });
  const [live, setLive] = useState(() => isPageMediaLive(pageKey));

  useEffect(() => {
    return subscribePageMedia(() => setLive(isPageMediaLive(pageKey)));
  }, [pageKey]);

  return live;
}

export function useFrozenPageKey() {
  const [pageKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return getPageMediaRoute() || window.location.pathname;
  });
  return pageKey;
}
