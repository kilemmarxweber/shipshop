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
    /** Template visuel (cover | quote | split | product) */
    category?: string | null;
  }[];
  lives?: {
    id: string;
    title: string;
    status?: string;
    followedByMe?: boolean;
    user: { id?: string; name: string; image?: string | null };
    product?: {
      id: string;
      title: string;
      images: string[];
      priceCents: number;
    } | null;
  }[];
};

const SURFACE_EVENT = "ss:growth-surface";
/** Après un seed / publish, un reload hors TTL doit refetch (pas un cache éternel). */
const CACHE_TTL_MS = 20_000;

let cached: GrowthSurface | null = null;
let cachedAt = 0;
let inflight: Promise<GrowthSurface | null> | null = null;

async function loadSurface(force = false) {
  if (force) {
    cached = null;
    cachedAt = 0;
    inflight = null;
  }
  if (cached?.highlights?.some((row) => row.hasVideo && !row.images)) {
    cached = null;
    cachedAt = 0;
  }
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS && !force) {
    return cached;
  }
  if (inflight) return inflight;
  const bust = force || !cached ? `?t=${Date.now()}` : "";
  inflight = fetchJson<GrowthSurface>(`/api/growth/surface${bust}`).then(
    ({ data }) => {
      cached = data ?? null;
      cachedAt = Date.now();
      inflight = null;
      return cached;
    },
  );
  return inflight;
}

/** Invalide le cache module + notifie accueil / Découvrir pour refetch immédiat. */
export function invalidateGrowthSurface() {
  cached = null;
  cachedAt = 0;
  inflight = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SURFACE_EVENT));
  }
}

/** Force un nouveau GET surface (après publish / réactivation admin). */
export async function refreshGrowthSurface() {
  invalidateGrowthSurface();
  return loadSurface(true);
}

function daySeed(userId: string) {
  const now = new Date();
  return `${userId}:${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
}

export function useGrowthSurface() {
  const { data: session } = authClient.useSession();
  const [surface, setSurface] = useState<GrowthSurface | null>(cached);
  /** true dès que le 1er fetch (ou cache module) a répondu — évite flash produit→challenge */
  const [ready, setReady] = useState(() => cached != null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const memoryRef = useRef<Record<ChallengeSurface, ChallengeWeaveMemory>>({
    feed: emptyWeaveMemory(),
    discover: emptyWeaveMemory(),
  });

  const applySurface = useCallback((data: GrowthSurface | null) => {
    // Nouveau set de challenges → reset weave pour mettre en avant le lead
    memoryRef.current = {
      feed: emptyWeaveMemory(),
      discover: emptyWeaveMemory(),
    };
    setSurface(data ?? { challenges: [] });
    setReady(true);
  }, []);

  useEffect(() => {
    void loadSurface()
      .then(applySurface)
      .catch(() => applySurface(null));
  }, [session?.user?.id, applySurface]);

  useEffect(() => {
    const onRefresh = () => {
      void loadSurface(true)
        .then(applySurface)
        .catch(() => applySurface(null));
    };
    window.addEventListener(SURFACE_EVENT, onRefresh);
    return () => window.removeEventListener(SURFACE_EVENT, onRefresh);
  }, [applySurface]);

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
    const { res, data } = await fetchJson<{
      ok?: boolean;
      reference?: string;
    }>("/api/growth/challenge", {
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
    toast.success(
      data?.reference
        ? `Challenge relevé · réf. ${data.reference}`
        : "Challenge relevé",
    );
  }

  return {
    surface,
    challenges,
    ready,
    busyId,
    joinChallenge,
    placeChallenges,
    seed,
    refresh: () => refreshGrowthSurface().then(applySurface),
  };
}
