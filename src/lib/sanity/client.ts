import { createClient, type SanityClient } from "next-sanity";
import { isSanityConfigured, sanityDataset, sanityProjectId } from "./env";

export function getSanityClient(): SanityClient | null {
  if (!isSanityConfigured()) return null;
  const token = process.env.SANITY_API_READ_TOKEN?.trim();
  return createClient({
    projectId: sanityProjectId(),
    dataset: sanityDataset(),
    apiVersion: "2026-10-18",
    useCdn: !token,
    token: token || undefined,
    perspective: "published",
  });
}

export function getSanityWriteClient(): SanityClient | null {
  if (!isSanityConfigured()) return null;
  const token = process.env.SANITY_API_WRITE_TOKEN?.trim();
  if (!token) return null;
  return createClient({
    projectId: sanityProjectId(),
    dataset: sanityDataset(),
    apiVersion: "2026-10-18",
    useCdn: false,
    token,
    perspective: "published",
  });
}
