import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";
import { DEFAULT_UPLOAD_URL, getPublicUploadUrl, toPublicUploadPath } from "@/lib/upload-url";

export const WINDOWS_UPLOAD_DIRECTORY = "C:\\chipshop-uploads";
export const LINUX_UPLOAD_DIRECTORY = "/var/www/chipshop-uploads";

/** Lecture runtime (évite que Next inline UPLOAD_DIR au `next build`). */
function runtimeEnv(name: string): string {
  const bag = process.env as Record<string, string | undefined>;
  return (bag[name] ?? "").trim();
}

function isWindowsDrivePath(value: string) {
  return /^[A-Za-z]:[\\/]/.test(value);
}

function addUniqueDir(dirs: string[], value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return;
  if (process.platform !== "win32" && isWindowsDrivePath(trimmed)) return;
  const resolved = path.resolve(/*turbopackIgnore: true*/ trimmed);
  if (!dirs.includes(resolved)) dirs.push(resolved);
}

export function platformUploadDirectory(): string {
  return process.platform === "win32"
    ? WINDOWS_UPLOAD_DIRECTORY
    : LINUX_UPLOAD_DIRECTORY;
}

/**
 * Dossier physique des photos / vidéos (comme Eteyelo).
 * Windows : C:\chipshop-uploads — Linux : /var/www/chipshop-uploads
 * UPLOAD_DIR surcharge si le chemin est valide pour l’OS.
 */
export function getUploadDirectory(): string {
  const configured = runtimeEnv("UPLOAD_DIR");
  if (configured) {
    if (process.platform === "win32" || !isWindowsDrivePath(configured)) {
      return path.resolve(/*turbopackIgnore: true*/ configured);
    }
  }
  return path.resolve(/*turbopackIgnore: true*/ platformUploadDirectory());
}

export function listUploadDirectories(): string[] {
  const dirs: string[] = [];
  addUniqueDir(dirs, getUploadDirectory());
  if (process.platform === "win32") {
    addUniqueDir(dirs, WINDOWS_UPLOAD_DIRECTORY);
    addUniqueDir(dirs, "C:/chipshop-uploads");
  } else {
    addUniqueDir(dirs, LINUX_UPLOAD_DIRECTORY);
  }
  addUniqueDir(dirs, runtimeEnv("UPLOAD_DIR"));
  return dirs;
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

  const publicPrefix = getPublicUploadUrl().replace(/^\/+/, "");
  const defaultPrefix = DEFAULT_UPLOAD_URL.replace(/^\/+/, "");

  let normalized = raw.replace(/\\/g, "/").replace(/^https?:\/\/[^/]+/i, "");
  normalized = normalized.replace(/^\/+/, "");
  for (const prefix of [`api/${publicPrefix}`, publicPrefix, `api/${defaultPrefix}`, defaultPrefix]) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      normalized = normalized.slice(prefix.length).replace(/^\/+/, "");
      break;
    }
  }

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

export async function writeUploadBuffer(fileName: string, buffer: Buffer) {
  const relative = relativeUploadPathFromUrl(fileName) ?? fileName;
  if (!relative || relative.includes("..")) {
    throw new Error("Nom de fichier invalide.");
  }
  const uploadDirectory = await ensureUploadDirectory();
  const filePath = path.join(
    /*turbopackIgnore: true*/ uploadDirectory,
    relative,
  );
  if (!isPathInside(uploadDirectory, filePath)) {
    throw new Error("Chemin de fichier invalide.");
  }
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(filePath), {
    recursive: true,
  });
  await fs.writeFile(/*turbopackIgnore: true*/ filePath, buffer);
  const stored = relative.replace(/\\/g, "/");
  return { fileName: stored, url: toPublicUploadPath(stored) };
}

export async function findUploadedFilePath(
  relativePath: string,
): Promise<string | null> {
  for (const directory of listUploadDirectories()) {
    const absolute = path.resolve(
      /*turbopackIgnore: true*/ directory,
      relativePath,
    );
    if (!isPathInside(directory, absolute)) continue;
    try {
      const fileStat = await fs.stat(/*turbopackIgnore: true*/ absolute);
      if (fileStat.isFile()) return absolute;
    } catch {
      // essayer le dossier suivant
    }
  }
  return null;
}

export const MEDIA_MAX_BYTES = 8 * 1024 * 1024; // marge post-compression client

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
