import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";

/**
 * Dossier physique des uploads (images / vidéos produits).
 * Priorité : UPLOAD_DIR → C:\chipshop-uploads (Win) → /var/www/chipshop-uploads (Linux)
 * → public/uploads en dev.
 */
export function getUploadDirectory(): string {
  const configured = process.env.UPLOAD_DIR?.trim();
  if (configured) {
    return path.resolve(/*turbopackIgnore: true*/ configured);
  }

  if (process.platform === "win32") {
    return path.resolve(/*turbopackIgnore: true*/ "C:\\chipshop-uploads");
  }

  if (process.platform === "linux") {
    return path.resolve(
      /*turbopackIgnore: true*/ "/var/www/chipshop-uploads",
    );
  }

  if (process.env.NODE_ENV !== "production") {
    return path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      "public",
      "uploads",
    );
  }

  throw new Error(
    "La variable d'environnement UPLOAD_DIR est obligatoire en production.",
  );
}

export function uploadDirectoryError(dir: string, err: unknown): string {
  const code = (err as NodeJS.ErrnoException)?.code;
  if (code === "EACCES" || code === "EPERM") {
    return `Impossible d’écrire dans ${dir} (droits insuffisants).`;
  }
  if (code === "ENOSPC") {
    return `Disque plein : impossible d’enregistrer dans ${dir}.`;
  }
  if (code === "ENOENT") {
    return `Dossier d’uploads introuvable (${dir}).`;
  }
  const msg = err instanceof Error ? err.message : "erreur inconnue";
  return `Impossible d’utiliser le dossier d’uploads (${dir}) : ${msg}`;
}

export async function ensureUploadDirectory(): Promise<string> {
  const dir = getUploadDirectory();
  try {
    await fs.mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
    await fs.access(/*turbopackIgnore: true*/ dir, fsConstants.W_OK);
    return dir;
  } catch (err) {
    throw new Error(uploadDirectoryError(dir, err));
  }
}

export function publicUploadsDirectory(): string {
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "public",
    "uploads",
  );
}

function isPathInside(root: string, absolute: string): boolean {
  const resolvedRoot = path.resolve(/*turbopackIgnore: true*/ root);
  const resolvedAbs = path.resolve(/*turbopackIgnore: true*/ absolute);
  const relative = path.relative(resolvedRoot, resolvedAbs);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export function relativeUploadPathFromUrl(
  url: string | null | undefined,
): string | null {
  const raw = url?.trim().split("?")[0] ?? "";
  if (!raw) return null;

  const normalized = raw
    .replace(/\\/g, "/")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/^api\/uploads\//, "")
    .replace(/^uploads\//, "");

  if (!normalized || normalized.includes("..")) return null;

  const segments = normalized.split("/").filter(Boolean);
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment === "." || segment === ".." || segment.startsWith("."),
    )
  ) {
    return null;
  }

  return segments.join("/");
}

export function resolveUploadAbsolutePath(relativePath: string): string {
  const root = path.resolve(/*turbopackIgnore: true*/ getUploadDirectory());
  const absolute = path.resolve(/*turbopackIgnore: true*/ root, relativePath);
  if (!isPathInside(root, absolute)) {
    throw new Error("Chemin de fichier invalide.");
  }
  return absolute;
}

export async function findUploadedFilePath(
  relativePath: string,
): Promise<string | null> {
  const sharedPath = resolveUploadAbsolutePath(relativePath);
  try {
    const stat = await fs.stat(/*turbopackIgnore: true*/ sharedPath);
    if (stat.isFile()) return sharedPath;
  } catch {
    // pas encore dans le dossier partagé
  }

  const publicRoot = path.resolve(
    /*turbopackIgnore: true*/ publicUploadsDirectory(),
  );
  const publicPath = path.resolve(
    /*turbopackIgnore: true*/ publicRoot,
    relativePath,
  );
  if (!isPathInside(publicRoot, publicPath)) return null;

  try {
    const stat = await fs.stat(/*turbopackIgnore: true*/ publicPath);
    if (!stat.isFile()) return null;
  } catch {
    return null;
  }

  try {
    await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(sharedPath), {
      recursive: true,
    });
    await fs.copyFile(
      /*turbopackIgnore: true*/ publicPath,
      /*turbopackIgnore: true*/ sharedPath,
    );
    return sharedPath;
  } catch {
    return publicPath;
  }
}

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024; // 10 Mo

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".mov"]);

export function detectMediaKind(
  file: { name?: string; type?: string },
): "image" | "video" | null {
  const mime = (file.type ?? "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  const ext = path.extname(file.name ?? "").toLowerCase();
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  return null;
}

export function extForMedia(
  file: { name?: string; type?: string },
  kind: "image" | "video",
): string {
  const fromName = path.extname(file.name ?? "").toLowerCase();
  if (fromName && (IMAGE_EXT.has(fromName) || VIDEO_EXT.has(fromName))) {
    return fromName.slice(1);
  }
  if (kind === "video") {
    if (file.type?.includes("webm")) return "webm";
    if (file.type?.includes("quicktime")) return "mov";
    return "mp4";
  }
  if (file.type?.includes("png")) return "png";
  if (file.type?.includes("webp")) return "webp";
  if (file.type?.includes("gif")) return "gif";
  return "jpg";
}
