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
};

const fallback: PublicAppConfig = {
  source: "system",
  clipMs: MONTAGE_MAX_MS,
  clipSeconds: 60,
  maxImages: 12,
  motions: [...SLIDE_MOTIONS],
  catalogTracks: [],
  experimentId: null,
};

let cached: PublicAppConfig | null = null;
let inflight: Promise<PublicAppConfig> | null = null;

export async function loadPublicAppConfig(): Promise<PublicAppConfig> {
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
  }, []);
  return config;
}
