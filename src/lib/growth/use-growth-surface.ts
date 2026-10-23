"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { toast } from "sonner";
import {
  emptyWeaveMemory,
  weaveChallenges,
  type ChallengeCardModel,
  type ChallengeSurface,
  type ChallengeWeaveMemory,
} from "@/lib/growth/challenge-place";

export type GrowthSurface = {
  challenges?: ChallengeCardModel[];
  highlights?: {
    id: string;
    title: string;
    category: string;
    imageUrl: string | null;
    images?: string[];
    soundtrack?: { audioUrl: string; durationMs?: number } | null;
    soundtrackStartMs?: number;
    hasVideo: boolean;
    likesCount: number;
    viewsCount: number;
    creator: { name: string; image: string | null };
  }[];
  stories?: {
    id: string;
    title: string;
    kind: string;
    objective: string;
    body: string | null;
    mediaUrl: string | null;
    ctaUrl: string | null;
    productId: string | null;
  }[];
  lives?: {
    id: string;
    title: string;
    user: { name: string };
  }[];
};

let cached: GrowthSurface | null = null;
let inflight: Promise<GrowthSurface | null> | null = null;

async function loadSurface() {
  if (cached?.highlights?.some((row) => row.hasVideo && !row.images)) {
    cached = null;
  }
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = fetchJson<GrowthSurface>("/api/growth/surface").then(({ data }) => {
    cached = data ?? null;
    inflight = null;
    return cached;
  });
  return inflight;
}

function daySeed(userId: string) {
  const now = new Date();
  return `${userId}:${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
}

export function useGrowthSurface() {
  const { data: session } = authClient.useSession();
  const [surface, setSurface] = useState<GrowthSurface | null>(cached);
  const [busyId, setBusyId] = useState<string | null>(null);
  const memoryRef = useRef<Record<ChallengeSurface, ChallengeWeaveMemory>>({
    feed: emptyWeaveMemory(),
    discover: emptyWeaveMemory(),
  });

  useEffect(() => {
    void loadSurface().then((data) => {
      if (data) setSurface(data);
    });
  }, [session?.user?.id]);

  const challenges = surface?.challenges ?? [];
  const seed = daySeed(session?.user?.id ?? "anon");

  const placeChallenges = useCallback(
    <T,>(
      surfaceKind: ChallengeSurface,
      items: T[],
      itemKey: (item: T, index: number) => string,
    ) =>
      weaveChallenges(
        items,
        challenges,
        itemKey,
        seed,
        memoryRef.current[surfaceKind],
        surfaceKind,
      ),
    [challenges, seed],
  );

  async function joinChallenge(challengeId: string) {
    if (!session) {
      toast.error("Connectez-vous pour participer");
      return;
    }
    setBusyId(challengeId);
    const { res } = await fetchJson("/api/growth/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId }),
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error("Challenge impossible");
      return;
    }
    const next: GrowthSurface = {
      ...surface,
      challenges: (surface?.challenges ?? []).map((row) =>
        row.id === challengeId ? { ...row, done: true } : row,
      ),
    };
    cached = next;
    setSurface(next);
    toast.success("Challenge relevé");
  }

  return {
    surface,
    challenges,
    busyId,
    joinChallenge,
    placeChallenges,
    seed,
  };
}
