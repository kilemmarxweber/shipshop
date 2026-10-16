/** Images catalogue (seed picsum) : 800×1000, typiquement 80–200 Ko. */
export const IMAGE_MAX_WIDTH = 800;
export const IMAGE_MAX_HEIGHT = 1000;
export const AVATAR_MAX_EDGE = 800;
export const DOCUMENT_MAX_EDGE = 1600;

/** Cible fichiers image après compression (largement sous 5 Mo). */
export const IMAGE_TARGET_BYTES = 400 * 1024;

/** Plafond stocké / servi (images et vidéos). */
export const STORED_MAX_BYTES = 5 * 1024 * 1024;

/** Taille source acceptée avant compression locale. */
export const SOURCE_MAX_BYTES = 80 * 1024 * 1024;

export const VIDEO_MAX_EDGE = 720;
export const VIDEO_MAX_DURATION_SEC = 25;

export type MediaKind = "image" | "video";
export type CompressVariant = "product" | "avatar" | "document";

export function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

export function isImageUrl(url: string) {
  return /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url);
}

export function detectUrlKind(url: string): MediaKind | null {
  if (isVideoUrl(url)) return "video";
  if (isImageUrl(url) || url.includes("picsum.photos")) return "image";
  return null;
}
