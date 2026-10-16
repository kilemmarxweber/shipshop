"use client";

import {
  AVATAR_MAX_EDGE,
  DOCUMENT_MAX_EDGE,
  IMAGE_MAX_HEIGHT,
  IMAGE_MAX_WIDTH,
  IMAGE_TARGET_BYTES,
  SOURCE_MAX_BYTES,
  STORED_MAX_BYTES,
  VIDEO_MAX_DURATION_SEC,
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
  const base = name.replace(/\.[^.]+$/, "");
  const ext = type.includes("webm")
    ? "webm"
    : type.includes("mp4")
      ? "mp4"
      : type.includes("webp")
        ? "webp"
        : "jpg";
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

async function compressImageFile(file: File, variant: CompressVariant) {
  const { width: maxW, height: maxH } = boundsFor(variant);
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const { width, height } = fitInside(
      bitmap.width,
      bitmap.height,
      maxW,
      maxH,
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponible");
    ctx.drawImage(bitmap, 0, 0, width, height);

    let quality = 0.82;
    let type = "image/webp";
    let blob = await canvasToBlob(canvas, type, quality);
    if (blob.size < 32 || blob.type === "image/png") {
      type = "image/jpeg";
      blob = await canvasToBlob(canvas, type, quality);
    }
    while (blob.size > IMAGE_TARGET_BYTES && quality > 0.5) {
      quality -= 0.12;
      blob = await canvasToBlob(canvas, type, quality);
    }
    if (blob.size > STORED_MAX_BYTES) {
      type = "image/jpeg";
      blob = await canvasToBlob(canvas, type, 0.55);
    }
    if (blob.size > STORED_MAX_BYTES) {
      throw new Error("Image trop lourde même après compression (< 5 Mo)");
    }
    return blobToFile(blob, file.name, type);
  } finally {
    bitmap.close();
  }
}

function pickRecorderMime() {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((type) => {
    try {
      return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

function captureVideoStream(video: HTMLVideoElement): MediaStream | null {
  const el = video as HTMLVideoElement & {
    captureStream?: (fps?: number) => MediaStream;
    mozCaptureStream?: (fps?: number) => MediaStream;
  };
  try {
    if (typeof el.captureStream === "function") return el.captureStream();
    if (typeof el.mozCaptureStream === "function") return el.mozCaptureStream();
  } catch {
    return null;
  }
  return null;
}

async function compressVideoFile(file: File): Promise<File> {
  /** Ne pas ré-encoder : le canvas/MediaRecorder produisait des WebM illisibles. */
  if (file.size <= STORED_MAX_BYTES) {
    return file;
  }
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Vidéo trop lourde (max 5 Mo)");
  }
  const mime = pickRecorderMime();
  if (!mime) {
    throw new Error("Vidéo trop lourde (max 5 Mo)");
  }

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "true");
  video.preload = "auto";
  video.src = objectUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      const fail = () => reject(new Error("Lecture vidéo impossible"));
      video.onloadeddata = () => resolve();
      video.onerror = fail;
      video.load();
    });

    const duration = Number.isFinite(video.duration) ? video.duration : NaN;
    if (Number.isFinite(duration) && duration > VIDEO_MAX_DURATION_SEC + 0.4) {
      throw new Error(`Vidéo trop longue (max ${VIDEO_MAX_DURATION_SEC} s)`);
    }

    const stream = captureVideoStream(video);
    if (!stream) {
      throw new Error("Vidéo trop lourde (max 5 Mo)");
    }

    const rec = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: Math.min(
        1_200_000,
        Math.floor(
          (STORED_MAX_BYTES * 8 * 0.7) /
            Math.max(Number.isFinite(duration) ? duration : 12, 1),
        ),
      ),
    });
    const chunks: Blob[] = [];
    rec.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };

    const recorded = new Promise<Blob>((resolve, reject) => {
      rec.onerror = () => reject(new Error("Compression vidéo impossible"));
      rec.onstop = () =>
        resolve(new Blob(chunks, { type: mime.split(";")[0] }));
    });

    rec.start(200);
    await video.play();
    await new Promise<void>((resolve) => {
      if (video.ended) {
        resolve();
        return;
      }
      video.onended = () => resolve();
    });
    if (rec.state !== "inactive") rec.stop();
    const blob = await recorded;
    for (const track of stream.getTracks()) track.stop();
    if (blob.size < 2048 || blob.size > STORED_MAX_BYTES) {
      throw new Error("Vidéo trop lourde même après compression (< 5 Mo)");
    }
    return blobToFile(blob, file.name, blob.type || "video/webm");
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

export async function compressMediaFile(
  file: File,
  variant: CompressVariant = "product",
): Promise<File> {
  if (file.size <= 0) throw new Error("Fichier vide");
  if (file.size > SOURCE_MAX_BYTES) {
    throw new Error("Fichier trop volumineux (max 80 Mo avant compression)");
  }
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name)) {
    try {
      return await compressImageFile(file, variant);
    } catch (error) {
      if (file.size <= STORED_MAX_BYTES && file.type.startsWith("image/")) {
        return file;
      }
      throw error instanceof Error ? error : new Error("Compression image impossible");
    }
  }
  if (file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name)) {
    return compressVideoFile(file);
  }
  throw new Error("Formats acceptés : image ou vidéo");
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
  t: (path: "media.nsfwRejected" | "media.moderationUnavailable" | "auth.accountDisabled") => string,
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
): Promise<{ url: string; kind: MediaKind; size: number }> {
  const compressed = await compressMediaFile(file, variant);
  const form = new FormData();
  form.append("file", compressed);
  form.append("variant", variant);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const json = (await res.json()) as {
    url?: string;
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
    kind: json.kind ?? "image",
    size: json.size ?? compressed.size,
  };
}
