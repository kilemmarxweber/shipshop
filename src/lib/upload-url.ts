export const DEFAULT_UPLOAD_URL = "/uploads";

/** `/uploads` même si NEXT_PUBLIC_UPLOAD_URL vaut `uploads` ou `/uploads/`. */
export function normalizePublicUploadUrl(value?: string | null) {
  const raw = value?.trim() || DEFAULT_UPLOAD_URL;
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  const normalized = withSlash.replace(/\/+$/, "");
  return normalized || DEFAULT_UPLOAD_URL;
}

/** Préfixe public des fichiers (ex. /uploads). */
export function getPublicUploadUrl() {
  return normalizePublicUploadUrl(process.env.NEXT_PUBLIC_UPLOAD_URL);
}

export function toPublicUploadPath(filename: string) {
  const name = filename.replace(/^\/+/, "").replace(/\\/g, "/");
  return `${getPublicUploadUrl()}/${name}`;
}

export function isPublicUploadPath(url: string) {
  const u = url.trim();
  const prefix = `${getPublicUploadUrl()}/`;
  return u.startsWith(prefix) || u.startsWith(`${DEFAULT_UPLOAD_URL}/`);
}
