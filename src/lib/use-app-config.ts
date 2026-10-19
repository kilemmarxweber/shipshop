"use client";

import { useEffect, useState } from "react";
import { MONTAGE_MAX_MS, SLIDE_MOTIONS, type SlideMotion } from "@/lib/montage";

export type PublicAppConfig = {
  source: "system" | "sanity";
  clipMs: number;
  clipSeconds: number;
  maxImages: number;
  motions: SlideMotion[];
  catalogTracks: {
    id: string;
    title: string;
    artist: string;
    mood: string;
    durationMs: number;
    audioUrl: string;
  }[];
  experimentId: string | null;
  scrollAdEnabled: boolean;
  scrollAdDelaySeconds: number;
  scrollAdVideos: string[];
};

const fallback: PublicAppConfig = {
  source: "system",
  clipMs: MONTAGE_MAX_MS,
  clipSeconds: 60,
  maxImages: 12,
  motions: [...SLIDE_MOTIONS],
  catalogTracks: [],
  experimentId: null,
  scrollAdEnabled: false,
  scrollAdDelaySeconds: 120,
  scrollAdVideos: [],
};

let cached: PublicAppConfig | null = null;
let inflight: Promise<PublicAppConfig> | null = null;
const CONFIG_EVENT = "chipshop-app-config";

export function clearPublicAppConfigCache() {
  cached = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CONFIG_EVENT));
  }
}

export async function loadPublicAppConfig(
  force = false,
): Promise<PublicAppConfig> {
  if (force) cached = null;
  if (cached) return cached;
  if (!inflight) {
    inflight = fetch("/api/app-config")
      .then(async (res) => {
        if (!res.ok) return fallback;
        const json = (await res.json()) as Partial<PublicAppConfig>;
        const next: PublicAppConfig = {
          ...fallback,
          ...json,
          clipMs: Number(json.clipMs) > 0 ? Number(json.clipMs) : fallback.clipMs,
          maxImages:
            Number(json.maxImages) > 0
              ? Math.min(12, Number(json.maxImages))
              : 12,
          motions:
            Array.isArray(json.motions) && json.motions.length
              ? json.motions
              : fallback.motions,
          catalogTracks: Array.isArray(json.catalogTracks)
            ? json.catalogTracks
            : [],
          scrollAdEnabled: Boolean(json.scrollAdEnabled),
          scrollAdDelaySeconds:
            Number(json.scrollAdDelaySeconds) >= 0
              ? Math.min(3600, Math.round(Number(json.scrollAdDelaySeconds)))
              : fallback.scrollAdDelaySeconds,
          scrollAdVideos: Array.isArray(json.scrollAdVideos)
            ? json.scrollAdVideos.filter(
                (item): item is string => typeof item === "string",
              )
            : [],
        };
        cached = next;
        return next;
      })
      .catch(() => fallback)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useAppConfig() {
  const [config, setConfig] = useState<PublicAppConfig>(cached ?? fallback);
  useEffect(() => {
    void loadPublicAppConfig().then(setConfig);
    const reload = () => {
      void loadPublicAppConfig(true).then(setConfig);
    };
    window.addEventListener(CONFIG_EVENT, reload);
    return () => window.removeEventListener(CONFIG_EVENT, reload);
  }, []);
  return config;
}
