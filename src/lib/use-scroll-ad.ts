"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useAppConfig } from "@/lib/use-app-config";
import {
  clockCooldownElapsed,
  loadScrollAdDay,
  localDayKey,
  nextEngagedGapMs,
  nextUnseenVideo,
  saveScrollAdDay,
  type ScrollAdDayState,
} from "@/lib/scroll-ad";

const ENGAGED_WINDOW_MS = 1200;
const IDLE_MS = 180;
const TICK_MS = 250;

function scrollRoots() {
  const roots: EventTarget[] = [window];
  for (const sel of [".feed-snap", ".app-main", ".discover-scroll"]) {
    document.querySelectorAll(sel).forEach((el) => roots.push(el));
  }
  return roots;
}

function isScrollAdPath(pathname: string) {
  return pathname === "/" || pathname === "/discover";
}

function isScrollAdSurface(pathname: string) {
  if (!isScrollAdPath(pathname)) return false;
  if (pathname === "/discover") return true;
  return document.documentElement.dataset.scrollAdFeed !== "off";
}

/** Accueil Pour toi / Abonnements, ou Découvrir. Pas « Je cherche ». */
export function ScrollAdFeedSurface({ on }: { on: boolean }) {
  useEffect(() => {
    document.documentElement.dataset.scrollAdFeed = on ? "on" : "off";
    return () => {
      delete document.documentElement.dataset.scrollAdFeed;
    };
  }, [on]);
  return null;
}

export function useScrollAd() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const cfg = useAppConfig();
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const lastScrollAt = useRef(0);
  const dayRef = useRef<ScrollAdDayState | null>(null);
  const openRef = useRef(false);
  const srcRef = useRef<string | null>(null);

  const videos = cfg.scrollAdVideos;
  const firstMs = Math.max(0, cfg.scrollAdDelaySeconds) * 1000;
  const onFeed = isScrollAdPath(pathname);
  const enabled =
    Boolean(session?.user?.id) &&
    cfg.scrollAdEnabled &&
    videos.length > 0 &&
    firstMs > 0 &&
    onFeed;

  function persist(next: ScrollAdDayState) {
    const today = localDayKey();
    const normalized =
      next.day === today
        ? { ...next, day: today }
        : { day: today, seen: [], shownAt: 0, engagedMs: 0 };
    dayRef.current = normalized;
    saveScrollAdDay(normalized);
  }

  useEffect(() => {
    dayRef.current = loadScrollAdDay();
  }, []);

  useEffect(() => {
    if (!enabled || open) return;
    const day = dayRef.current ?? loadScrollAdDay();
    const next = nextUnseenVideo(videos, day.seen);
    if (!next) return;
    const el = document.createElement("video");
    el.preload = "auto";
    el.src = next;
    el.muted = true;
    return () => {
      el.removeAttribute("src");
      el.load();
    };
  }, [enabled, open, videos]);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      setSrc(null);
      openRef.current = false;
      srcRef.current = null;
      return;
    }

    const attached = new Set<EventTarget>();
    const onScroll = () => {
      if (!isScrollAdSurface(pathname)) return;
      lastScrollAt.current = Date.now();
    };
    const bind = () => {
      for (const root of scrollRoots()) {
        if (attached.has(root)) continue;
        attached.add(root);
        root.addEventListener("scroll", onScroll, { capture: true, passive: true });
        root.addEventListener("touchmove", onScroll, { capture: true, passive: true });
        root.addEventListener("wheel", onScroll, { capture: true, passive: true });
      }
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    bind();
    const bindTimer = window.setInterval(bind, 2000);

    const tick = window.setInterval(() => {
      if (document.hidden) return;
      if (!isScrollAdSurface(pathname)) {
        if (openRef.current) {
          openRef.current = false;
          srcRef.current = null;
          setOpen(false);
          setSrc(null);
        }
        return;
      }
      if (openRef.current) return;

      let day = dayRef.current ?? loadScrollAdDay();
      if (day.day !== localDayKey()) {
        day = loadScrollAdDay();
        dayRef.current = day;
      }
      const clip = nextUnseenVideo(videos, day.seen);
      if (!clip) return;

      const now = Date.now();
      if (now - lastScrollAt.current < ENGAGED_WINDOW_MS) {
        const next = { ...day, engagedMs: day.engagedMs + TICK_MS };
        persist(next);
      }

      const current = dayRef.current ?? day;
      const gapMs = nextEngagedGapMs(firstMs, current.seen.length);
      if (
        current.engagedMs >= gapMs &&
        clockCooldownElapsed(current.shownAt, now) &&
        lastScrollAt.current > 0 &&
        now - lastScrollAt.current >= IDLE_MS
      ) {
        openRef.current = true;
        srcRef.current = clip;
        setSrc(clip);
        setOpen(true);
      }
    }, TICK_MS);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(bindTimer);
      document.removeEventListener("scroll", onScroll, true);
      for (const root of attached) {
        root.removeEventListener("scroll", onScroll, true);
        root.removeEventListener("touchmove", onScroll, true);
        root.removeEventListener("wheel", onScroll, true);
      }
    };
  }, [enabled, firstMs, videos, pathname]);

  function close() {
    if (!openRef.current) return;
    const url = srcRef.current;
    openRef.current = false;
    srcRef.current = null;
    setOpen(false);
    setSrc(null);
    const day = dayRef.current ?? loadScrollAdDay();
    const seen = url && !day.seen.includes(url) ? [...day.seen, url] : day.seen;
    persist({
      ...day,
      seen,
      shownAt: Date.now(),
      engagedMs: 0,
    });
  }

  return { open, src, close };
}
