export function sanityProjectId() {
  const id = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim() ?? "";
  if (!id || id === "unset") return "";
  return id;
}

export function sanityDataset() {
  return process.env.NEXT_PUBLIC_SANITY_DATASET?.trim() || "production";
}

export function isSanityConfigured() {
  return Boolean(sanityProjectId());
}
