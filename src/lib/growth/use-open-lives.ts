"use client";

import type { FeedLive } from "@/components/feed-live-badge";
import { fetchJson } from "@/lib/fetch-json";
import { invalidateGrowthSurface } from "@/lib/growth/use-growth-surface";
import { useEffect, useState } from "react";

const OPEN_LIVES_EVENT = "ss:open-lives";
const POLL_OPEN_MS = 2_000;
const POLL_IDLE_MS = 8_000;

export function notifyLiveEnded() {
  invalidateGrowthSurface();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_LIVES_EVENT));
  }
}

function onlyOpen(rows: FeedLive[] | undefined): FeedLive[] {
  return (rows ?? []).filter((row) => row.status !== "ENDED");
}

export function useOpenLives() {
  const [lives, setLives] = useState<FeedLive[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const clear = () => {
      if (timer) window.clearTimeout(timer);
      timer = 0;
    };

    const pull = async () => {
      try {
        const { data } = await fetchJson<{ lives?: FeedLive[] }>(
          `/api/growth/lives?t=${Date.now()}`,
        );
        if (cancelled) return;
        const next = onlyOpen(data?.lives);
        setLives(next);
        clear();
        timer = window.setTimeout(
          () => void pull(),
          next.length ? POLL_OPEN_MS : POLL_IDLE_MS,
        );
      } catch {
        if (cancelled) return;
        clear();
        timer = window.setTimeout(() => void pull(), POLL_IDLE_MS);
      }
    };

    void pull();
    const onPing = () => void pull();
    window.addEventListener(OPEN_LIVES_EVENT, onPing);
    document.addEventListener("visibilitychange", onPing);
    return () => {
      cancelled = true;
      clear();
      window.removeEventListener(OPEN_LIVES_EVENT, onPing);
      document.removeEventListener("visibilitychange", onPing);
    };
  }, []);

  return lives;
}
