"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

function readClientPageKey() {
  if (typeof window === "undefined") return "";
  return getPageMediaRoute() || window.location.pathname;
}

/** À monter une fois dans le shell. */
export function useBindPageMediaSession() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);

  bindPageMediaRoute(pathname);

  useLayoutEffect(() => {
    bindPageMediaRoute(pathname);
    if (prevPath.current && prevPath.current !== pathname) {
      pauseAllPageMedia();
    }
    prevPath.current = pathname;
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

/** Clé figée au montage (page en cache Next reste muette), corrigée après hydratation. */
export function useFrozenPageKey() {
  const [pageKey, setPageKey] = useState(readClientPageKey);

  useLayoutEffect(() => {
    const next = readClientPageKey();
    if (next && next !== pageKey) setPageKey(next);
  }, [pageKey]);

  return pageKey;
}

export function usePageMediaLive() {
  const pageKey = useFrozenPageKey();
  const [live, setLive] = useState(() => isPageMediaLive(pageKey));

  useLayoutEffect(() => {
    setLive(isPageMediaLive(pageKey));
  }, [pageKey]);

  useEffect(() => {
    return subscribePageMedia(() => setLive(isPageMediaLive(pageKey)));
  }, [pageKey]);

  return live;
}
