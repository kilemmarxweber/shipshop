import {
  MONTAGE_MAX_MS,
  MONTAGE_MAX_SECONDS,
  PRODUCT_CLIP_MOOD,
  SLIDE_MOTIONS,
  type SlideMotion,
} from "@/lib/montage";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSanityClient } from "@/lib/sanity/client";
import { isSanityConfigured, sanityDataset, sanityProjectId } from "@/lib/sanity/env";
import {
  appConfigQuery,
  catalogTracksQuery,
  seoDefaultsQuery,
} from "@/lib/sanity/queries";

export type ContentSource = "system" | "sanity";

export type CatalogTrack = {
  id: string;
  title: string;
  artist: string;
  mood: string;
  durationMs: number;
  audioUrl: string;
};

export type NsfwPolicy = {
  forbidden: true;
  humanReview: boolean;
  blockedLabels: string[];
  rejectFr: string;
  rejectEn: string;
  rejectPt: string;
};

export type AppContentConfig = {
  source: ContentSource;
  requestedSource: ContentSource;
  sanityConfigured: boolean;
  projectId: string;
  dataset: string;
  clipSeconds: number;
  clipMs: number;
  maxImages: number;
  motions: SlideMotion[];
  nsfwPolicy: NsfwPolicy;
  catalogTracks: CatalogTrack[];
  experimentId: string | null;
};

export type SeoDefaults = {
  titleTemplate: string;
  description: string;
  faq: { question: string; answer: string }[];
};

const SYSTEM_SEO: SeoDefaults = {
  titleTemplate: "ShipShop — Marketplace de confiance",
  description:
    "Achetez et vendez en sécurité avec portefeuille Mobile Money prépayé.",
  faq: [],
};

const SYSTEM_NSFW: Omit<NsfwPolicy, "humanReview"> = {
  forbidden: true,
  blockedLabels: [],
  rejectFr: "Contenu pornographique interdit sur ShipShop",
  rejectEn: "Pornographic content is forbidden on ShipShop",
  rejectPt: "Conteúdo pornográfico é proibido no ShipShop",
};

function parseSource(value: string | null | undefined): ContentSource {
  return value?.trim().toLowerCase() === "sanity" ? "sanity" : "system";
}

function clampClipSeconds(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return MONTAGE_MAX_SECONDS;
  return Math.min(120, Math.max(5, Math.round(n)));
}

function clampMaxImages(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 12;
  return Math.min(12, Math.max(1, Math.round(n)));
}

function parseMotions(value: unknown): SlideMotion[] {
  const raw = Array.isArray(value) ? value : SLIDE_MOTIONS;
  const allowed = raw.filter(
    (item): item is SlideMotion =>
      typeof item === "string" &&
      (SLIDE_MOTIONS as readonly string[]).includes(item),
  );
  return allowed.length ? allowed : [...SLIDE_MOTIONS];
}

async function readSwitch() {
  const envSource = parseSource(process.env.CONTENT_SOURCE);
  try {
    const row = await withDbRetry(() =>
      prisma.contentSourceConfig.findUnique({ where: { id: "default" } }),
    );
    return {
      requested: parseSource(row?.source ?? envSource),
      humanReview: Boolean(row?.nsfwReview),
    };
  } catch {
    return { requested: envSource, humanReview: false };
  }
}

async function systemTracks(): Promise<CatalogTrack[]> {
  try {
    return await withDbRetry(() =>
      prisma.soundtrack.findMany({
        where: {
          isActive: true,
          userId: null,
          mood: { not: PRODUCT_CLIP_MOOD },
        },
        orderBy: { title: "asc" },
        select: {
          id: true,
          title: true,
          artist: true,
          mood: true,
          durationMs: true,
          audioUrl: true,
        },
      }),
    );
  } catch {
    return [];
  }
}

type SanityAppDoc = {
  montage?: {
    clipSeconds?: number;
    maxImages?: number;
    motions?: string[];
  };
  nsfw?: {
    blockedLabels?: string[];
    rejectFr?: string;
    rejectEn?: string;
    rejectPt?: string;
  };
  experimentId?: string;
};

type SanityTrackDoc = {
  _id: string;
  title?: string;
  artist?: string;
  mood?: string;
  durationMs?: number;
  audioUrl?: string;
};

async function fetchSanityConfig(): Promise<{
  doc: SanityAppDoc | null;
  tracks: CatalogTrack[];
}> {
  const client = getSanityClient();
  if (!client) return { doc: null, tracks: [] };
  try {
    const [doc, rows] = await Promise.all([
      client.fetch<SanityAppDoc | null>(appConfigQuery),
      client.fetch<SanityTrackDoc[]>(catalogTracksQuery),
    ]);
    const tracks = (rows ?? [])
      .filter((row) => row.audioUrl)
      .map((row) => ({
        id: `st-sanity-${row._id}`,
        title: row.title?.trim() || "Sans titre",
        artist: row.artist?.trim() || "ShipShop",
        mood: row.mood?.trim() || "catalog",
        durationMs: Math.max(0, Math.round(row.durationMs ?? 0)),
        audioUrl: row.audioUrl as string,
      }));
    return { doc: doc ?? null, tracks };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sanity inaccessible";
    console.error("[content-source] Sanity fetch failed:", message);
    return { doc: null, tracks: [] };
  }
}

async function syncSanityTracks(tracks: CatalogTrack[]) {
  for (const track of tracks) {
    try {
      await withDbRetry(() =>
        prisma.soundtrack.upsert({
          where: { id: track.id },
          create: {
            id: track.id,
            title: track.title,
            artist: track.artist,
            mood: track.mood,
            durationMs: track.durationMs || MONTAGE_MAX_MS,
            audioUrl: track.audioUrl,
            isActive: true,
            userId: null,
          },
          update: {
            title: track.title,
            artist: track.artist,
            mood: track.mood,
            durationMs: track.durationMs || undefined,
            audioUrl: track.audioUrl,
            isActive: true,
          },
        }),
      );
    } catch (error) {
      console.error("[content-source] track sync failed:", track.id, error);
    }
  }
}

export async function getAppConfig(): Promise<AppContentConfig> {
  const { requested, humanReview } = await readSwitch();
  const sanityConfigured = isSanityConfigured();
  const source: ContentSource =
    requested === "sanity" && sanityConfigured ? "sanity" : "system";

  const nsfwPolicy: NsfwPolicy = { ...SYSTEM_NSFW, humanReview };
  const base: AppContentConfig = {
    source,
    requestedSource: requested,
    sanityConfigured,
    projectId: sanityProjectId(),
    dataset: sanityDataset(),
    clipSeconds: MONTAGE_MAX_SECONDS,
    clipMs: MONTAGE_MAX_MS,
    maxImages: 12,
    motions: [...SLIDE_MOTIONS],
    nsfwPolicy,
    catalogTracks: [],
    experimentId: null,
  };

  if (source !== "sanity") {
    base.catalogTracks = await systemTracks();
    return base;
  }

  const { doc, tracks } = await fetchSanityConfig();
  if (tracks.length) await syncSanityTracks(tracks);
  const clipSeconds = clampClipSeconds(doc?.montage?.clipSeconds);
  return {
    ...base,
    clipSeconds,
    clipMs: clipSeconds * 1000,
    maxImages: clampMaxImages(doc?.montage?.maxImages),
    motions: parseMotions(doc?.montage?.motions),
    nsfwPolicy: {
      forbidden: true,
      humanReview,
      blockedLabels: (doc?.nsfw?.blockedLabels ?? []).filter(
        (label): label is string => typeof label === "string" && label.trim().length > 0,
      ),
      rejectFr: doc?.nsfw?.rejectFr?.trim() || SYSTEM_NSFW.rejectFr,
      rejectEn: doc?.nsfw?.rejectEn?.trim() || SYSTEM_NSFW.rejectEn,
      rejectPt: doc?.nsfw?.rejectPt?.trim() || SYSTEM_NSFW.rejectPt,
    },
    catalogTracks: tracks.length ? tracks : await systemTracks(),
    experimentId: doc?.experimentId?.trim() || null,
  };
}

export async function getSeoDefaults(): Promise<SeoDefaults> {
  const cfg = await getAppConfig();
  if (cfg.source !== "sanity") return SYSTEM_SEO;
  const client = getSanityClient();
  if (!client) return SYSTEM_SEO;
  try {
    const doc = await client.fetch<{
      titleTemplate?: string;
      description?: string;
      faq?: { question?: string; answer?: string }[];
    } | null>(seoDefaultsQuery);
    return {
      titleTemplate: doc?.titleTemplate?.trim() || SYSTEM_SEO.titleTemplate,
      description: doc?.description?.trim() || SYSTEM_SEO.description,
      faq: (doc?.faq ?? [])
        .filter((item) => item.question && item.answer)
        .map((item) => ({
          question: item.question!.trim(),
          answer: item.answer!.trim(),
        })),
    };
  } catch {
    return SYSTEM_SEO;
  }
}

export async function setContentSource(input: {
  source: ContentSource;
  nsfwReview: boolean;
}) {
  return withDbRetry(() =>
    prisma.contentSourceConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        source: input.source,
        nsfwReview: input.nsfwReview,
      },
      update: {
        source: input.source,
        nsfwReview: input.nsfwReview,
      },
    }),
  );
}

export function publicAppConfig(cfg: AppContentConfig) {
  return {
    source: cfg.source,
    clipMs: cfg.clipMs,
    clipSeconds: cfg.clipSeconds,
    maxImages: cfg.maxImages,
    motions: cfg.motions,
    catalogTracks: cfg.catalogTracks,
    experimentId: cfg.experimentId,
  };
}
