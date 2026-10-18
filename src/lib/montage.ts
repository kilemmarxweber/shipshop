/** Durée max du montage (musique + clip vidéo publié). */
export const MONTAGE_MAX_SECONDS = 60;
export const MONTAGE_MAX_MS = MONTAGE_MAX_SECONDS * 1000;

/** Source temporaire (navigateur) — jamais stockée entière. */
export const SOUNDTRACK_SOURCE_MAX_SECONDS = 10 * 60;
export const SOUNDTRACK_START_MAX_MS = SOUNDTRACK_SOURCE_MAX_SECONDS * 1000;

/** Extrait 1 min attaché au produit (pas une bibliothèque d’imports). */
export const PRODUCT_CLIP_MOOD = "product_clip";
export const LOCAL_SOUNDTRACK_ID = "local";

export function clampSoundtrackStartMs(
  startMs: number,
  durationMs: number,
  clipMs = MONTAGE_MAX_MS,
) {
  const windowMs = Math.min(clipMs, Math.max(0, durationMs));
  const maxStart = Math.max(0, durationMs - windowMs);
  return Math.min(maxStart, Math.max(0, Math.round(startMs)));
}

export function formatClipClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const SLIDE_MOTIONS = [
  "zoom-in",
  "zoom-out",
  "pan-left",
  "pan-right",
  "pan-up",
] as const;

export type SlideMotion = (typeof SLIDE_MOTIONS)[number];

export function isSlideMotion(value: string): value is SlideMotion {
  return (SLIDE_MOTIONS as readonly string[]).includes(value);
}

/** Répartit la minute de son sur 1–12 visuels (peu d’images = plus lent). */
export function slideshowSlotMs(
  count: number,
  clipMs = MONTAGE_MAX_MS,
  maxImages = 12,
) {
  const n = Math.max(1, Math.min(maxImages, count));
  const windowMs = Math.max(1000, clipMs);
  return Math.max(800, Math.round(windowMs / n));
}

export function slideshowWindow(
  index: number,
  count: number,
  clipMs = MONTAGE_MAX_MS,
  maxImages = 12,
) {
  const n = Math.max(1, Math.min(maxImages, count));
  const slot = slideshowSlotMs(n, clipMs);
  const start = Math.min(clipMs, index * slot);
  const end = index >= n - 1 ? clipMs : Math.min(clipMs, (index + 1) * slot);
  return { start, end, slot };
}

export function defaultSlideMotion(index: number): SlideMotion {
  return SLIDE_MOTIONS[index % SLIDE_MOTIONS.length]!;
}

export function normalizeMotions(
  count: number,
  motions?: string[] | null,
  maxImages = 12,
): SlideMotion[] {
  const n = Math.max(0, Math.min(maxImages, count));
  return Array.from({ length: n }, (_, i) => {
    const raw = motions?.[i];
    return raw && isSlideMotion(raw) ? raw : defaultSlideMotion(i);
  });
}
