"use client";

import {
  AVATAR_MAX_EDGE,
  DOCUMENT_MAX_EDGE,
  IMAGE_MAX_HEIGHT,
  IMAGE_MAX_WIDTH,
  IMAGE_STORED_MAX_BYTES,
  IMAGE_TARGET_BYTES,
  MEDIA_INPUT_MAX_BYTES,
  VIDEO_RECOMMENDED_BYTES,
  VIDEO_INPUT_MAX_BYTES,
  looksLikeImageFile,
  looksLikeVideoFile,
  type CompressVariant,
  type MediaKind,
} from "@/lib/media";

function boundsFor(variant: CompressVariant) {
  if (variant === "avatar") {
    return { width: AVATAR_MAX_EDGE, height: AVATAR_MAX_EDGE };
  }
  if (variant === "document") {
    return { width: DOCUMENT_MAX_EDGE, height: DOCUMENT_MAX_EDGE };
  }
  return { width: IMAGE_MAX_WIDTH, height: IMAGE_MAX_HEIGHT };
}

function fitInside(
  width: number,
  height: number,
  maxW: number,
  maxH: number,
) {
  const ratio = Math.min(maxW / width, maxH / height, 1);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function blobToFile(blob: Blob, name: string, type: string) {
  const base = name.replace(/\.[^.]+$/, "") || "media";
  const ext = type.includes("webp") ? "webp" : "jpg";
  return new File([blob], `${base}.${ext}`, { type });
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
  if (!blob) throw new Error("Compression image impossible");
  return blob;
}

/** Compression image rapide (1–2 passes JPEG). Pas de re-encodage vidéo. */
async function compressImageFile(file: File, variant: CompressVariant) {
  const { width: maxW, height: maxH } = boundsFor(variant);
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const needsResize = bitmap.width > maxW || bitmap.height > maxH;
    const alreadyLight =
      file.size <= IMAGE_TARGET_BYTES &&
      !needsResize &&
      /^image\/(jpeg|jpg|webp)$/i.test(file.type);
    if (alreadyLight) return file;

    const { width, height } = fitInside(
      bitmap.width,
      bitmap.height,
      maxW,
      maxH,
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const preferWebp =
      /^image\/webp$/i.test(file.type) || /\.webp$/i.test(file.name);
    const ctx = canvas.getContext("2d", { alpha: preferWebp });
    if (!ctx) throw new Error("Canvas indisponible");
    if (!preferWebp) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Spotlight / uploads webp : garder webp (meilleure qualité + alpha)
    const type = preferWebp ? "image/webp" : "image/jpeg";
    let quality = file.size > 2 * 1024 * 1024 ? 0.78 : 0.84;
    let blob = await canvasToBlob(canvas, type, quality);

    if (blob.size > IMAGE_TARGET_BYTES * 1.35 && quality > 0.72) {
      quality = 0.72;
      blob = await canvasToBlob(canvas, type, quality);
    }
    if (blob.size > IMAGE_STORED_MAX_BYTES) {
      blob = await canvasToBlob(canvas, type, 0.65);
    }
    if (blob.size > IMAGE_STORED_MAX_BYTES) {
      throw new Error("Impossible d'envoyer ce fichier");
    }
    if (blob.size >= file.size && file.size <= IMAGE_STORED_MAX_BYTES) {
      return file;
    }
    return blobToFile(blob, file.name, type);
  } finally {
    bitmap.close();
  }
}

export async function compressMediaFile(
  file: File,
  variant: CompressVariant = "product",
): Promise<File> {
  if (file.size <= 0) throw new Error("Fichier vide");
  if (file.size > MEDIA_INPUT_MAX_BYTES) {
    throw new Error("Fichier trop volumineux (max 100 Mo)");
  }

  if (looksLikeImageFile(file)) {
    try {
      return await compressImageFile(file, variant);
    } catch (error) {
      if (file.size <= IMAGE_STORED_MAX_BYTES && looksLikeImageFile(file)) {
        return file;
      }
      throw error instanceof Error
        ? error
        : new Error("Impossible d'envoyer ce fichier");
    }
  }

  // Vidéo : envoi brut rapide ; compression ffmpeg côté serveur.
  if (looksLikeVideoFile(file)) {
    if (file.size > VIDEO_INPUT_MAX_BYTES) {
      throw new Error("Fichier trop volumineux (max 100 Mo)");
    }
    return file;
  }

  throw new Error("Formats acceptés : image ou vidéo");
}

export function exceedsRecommendedVideoSize(file: File) {
  return looksLikeVideoFile(file) && file.size > VIDEO_RECOMMENDED_BYTES;
}

export class MediaUploadError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "MediaUploadError";
    this.code = code;
  }
}

export function mediaUploadToastMessage(
  error: unknown,
  t: (
    path:
      | "media.nsfwRejected"
      | "media.moderationUnavailable"
      | "auth.accountDisabled",
  ) => string,
): string {
  const code = error instanceof MediaUploadError ? error.code : undefined;
  if (code === "ACCOUNT_DISABLED") return t("auth.accountDisabled");
  if (code === "NSFW_REJECTED" || code === "CSAM_HOLD") {
    return t("media.nsfwRejected");
  }
  if (code === "MODERATION_UNAVAILABLE") return t("media.moderationUnavailable");
  return error instanceof Error ? error.message : "Échec upload";
}

export async function uploadCompressedMedia(
  file: File,
  variant: CompressVariant = "product",
): Promise<{
  url: string;
  posterUrl?: string;
  kind: MediaKind;
  size: number;
}> {
  const compressed = await compressMediaFile(file, variant);
  const form = new FormData();
  form.append("file", compressed);
  form.append("variant", variant);
  if (looksLikeImageFile(compressed)) {
    form.append("precompressed", "1");
  }
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const json = (await res.json()) as {
    url?: string;
    posterUrl?: string;
    kind?: MediaKind;
    size?: number;
    error?: string;
    code?: string;
  };
  if (!res.ok || !json.url) {
    throw new MediaUploadError(json.error ?? "Échec upload", json.code);
  }
  return {
    url: json.url,
    posterUrl: json.posterUrl,
    kind: json.kind ?? "image",
    size: json.size ?? compressed.size,
  };
}
