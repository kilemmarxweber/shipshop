const PLACEHOLDERS = new Set([
  "unset",
  "xxxxxxxx",
  "your-project-id",
  "projectid",
  "project_id",
]);

/** Aligné sur `@sanity/client` : `projectId` = `[-a-z0-9]+`. */
const SANITY_PROJECT_ID_RE = /^[-a-z0-9]+$/i;

/** Vrai projectId Sanity, pas un placeholder. */
export function sanityProjectId() {
  const id = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim() ?? "";
  if (!id || PLACEHOLDERS.has(id.toLowerCase())) return "";
  if (!SANITY_PROJECT_ID_RE.test(id)) return "";
  const unique = new Set(id.toLowerCase());
  if (unique.size < 3) return "";
  return id;
}

export function sanityDataset() {
  return process.env.NEXT_PUBLIC_SANITY_DATASET?.trim() || "production";
}

export function isSanityConfigured() {
  return Boolean(sanityProjectId());
}
