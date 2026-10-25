/**
 * Précharge média façon TikTok : un lot d’URL en mémoire (éléments <video>/<img>
 * détachés) pour que le scroll suivant démarre sans rebuffer.
 */
import { isVideoUrl } from "@/lib/media";

const MAX_ENTRIES = 8;
const pool = new Map<
  string,
  { el: HTMLVideoElement | HTMLImageElement; at: number }
>();

function touch(url: string) {
  const row = pool.get(url);
  if (row) row.at = Date.now();
}

function evictIfNeeded() {
  while (pool.size > MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [key, row] of pool) {
      if (row.at < oldestAt) {
        oldestAt = row.at;
        oldestKey = key;
      }
    }
    if (!oldestKey) break;
    const row = pool.get(oldestKey);
    pool.delete(oldestKey);
    if (row?.el instanceof HTMLVideoElement) {
      try {
        row.el.pause();
        row.el.removeAttribute("src");
        row.el.load();
      } catch {
        /* ignore */
      }
    }
  }
}

/** Garde l’URL chaude (cache navigateur + decode anticipé). */
export function warmFeedMedia(url: string | null | undefined) {
  if (typeof document === "undefined" || !url?.trim()) return;
  const src = url.trim();
  if (pool.has(src)) {
    touch(src);
    return;
  }
  evictIfNeeded();
  if (isVideoUrl(src)) {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.preload = "auto";
    video.src = src;
    try {
      video.load();
    } catch {
      /* ignore */
    }
    pool.set(src, { el: video, at: Date.now() });
  } else {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    pool.set(src, { el: img, at: Date.now() });
  }
  evictIfNeeded();
}

/** Précharge une fenêtre d’URLs (actif ± N). */
export function warmFeedMediaBatch(urls: Array<string | null | undefined>) {
  for (const url of urls) warmFeedMedia(url);
}

export function clearFeedMediaPool() {
  for (const [, row] of pool) {
    if (row.el instanceof HTMLVideoElement) {
      try {
        row.el.pause();
        row.el.removeAttribute("src");
        row.el.load();
      } catch {
        /* ignore */
      }
    }
  }
  pool.clear();
}
