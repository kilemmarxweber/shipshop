/** Images catalogue : assez nettes pour le fil, encore légères. */
export const IMAGE_MAX_WIDTH = 1080;
export const IMAGE_MAX_HEIGHT = 1350;
export const AVATAR_MAX_EDGE = 800;
export const DOCUMENT_MAX_EDGE = 1600;

/** Cible compression image (qualité élevée, poids modéré). */
export const IMAGE_TARGET_BYTES = 550 * 1024;

/** Plafond après compression image. */
export const IMAGE_STORED_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Vidéo : upload brut rapide côté client, compression ffmpeg côté serveur.
 * - INPUT : taille max reçue
 * - SKIP : déjà assez léger → pas de re-encodage
 * - STORED : plafond après compression
 */
/** Upload brut jusqu’à 100 Mo, puis compression serveur → plafond stocké. */
export const VIDEO_INPUT_MAX_BYTES = 100 * 1024 * 1024;
export const VIDEO_COMPRESS_SKIP_BYTES = 3 * 1024 * 1024;
/** Après compression : cible stockage légère. */
export const VIDEO_STORED_MAX_BYTES = 12 * 1024 * 1024;
/** Recommandation UX (non bloquante) pour une lecture plus fluide. */
export const VIDEO_RECOMMENDED_BYTES = 10 * 1024 * 1024;
/** Limite métier des vidéos produit (trim serveur). */
export const PRODUCT_VIDEO_MAX_SECONDS = 60;

export const STORED_MAX_BYTES = IMAGE_STORED_MAX_BYTES;
export const MEDIA_INPUT_MAX_BYTES = VIDEO_INPUT_MAX_BYTES;

export type MediaKind = "image" | "video";
export type CompressVariant = "product" | "avatar" | "document";

export function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|m4v|mkv|avi|3gp|ogv|mpeg|mpg|wmv)(\?|$)/i.test(url);
}

export function isImageUrl(url: string) {
  return /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|tiff?)(\?|$)/i.test(url);
}

/** Poster JPEG généré à l’upload : même nom que la vidéo, extension .jpg */
export function videoPosterUrl(videoUrl: string) {
  return videoUrl.replace(
    /\.(mp4|webm|mov|m4v|mkv|avi|3gp|ogv|mpeg|mpg|wmv)(\?|$)/i,
    ".jpg$2",
  );
}

/** Première image, sinon poster de la 1ère vidéo (pour miniatures). */
export function mediaCoverUrl(images: string[]): string | null {
  if (!images.length) return null;
  const image = images.find((url) => isImageUrl(url));
  if (image) return image;
  const video = images.find((url) => isVideoUrl(url));
  if (video) return videoPosterUrl(video);
  return images[0] ?? null;
}

export function detectUrlKind(url: string): MediaKind | null {
  if (isVideoUrl(url)) return "video";
  if (isImageUrl(url) || url.includes("picsum.photos")) return "image";
  return null;
}

export function looksLikeImageFile(file: { name?: string; type?: string }) {
  const mime = (file.type ?? "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|tiff?)$/i.test(
    file.name ?? "",
  );
}

export function looksLikeVideoFile(file: { name?: string; type?: string }) {
  const mime = (file.type ?? "").toLowerCase();
  if (mime.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|m4v|mkv|avi|3gp|ogv|mpeg|mpg|wmv|flv)$/i.test(
    file.name ?? "",
  );
}
