import { z } from "zod";
import { isProbablyVideo } from "@/lib/growth/challenge-look";

export const challengeSpotlightSchema = z.object({
  url: z.string().min(4).max(800),
  kind: z.enum(["image", "video"]).optional(),
  posterUrl: z.string().max(800).optional().nullable(),
});

export type ChallengeSpotlight = z.infer<typeof challengeSpotlightSchema> & {
  kind: "image" | "video";
};

export function isWebpUrl(url: string) {
  return /\.webp(\?|$)/i.test(url) || /image\/webp/i.test(url);
}

export function parseChallengeSpotlight(raw: unknown): ChallengeSpotlight | null {
  const parsed = challengeSpotlightSchema.safeParse(raw);
  if (!parsed.success) return null;
  const kind =
    parsed.data.kind ??
    (isProbablyVideo(parsed.data.url) ? "video" : "image");
  return {
    url: parsed.data.url,
    kind,
    posterUrl: parsed.data.posterUrl ?? null,
  };
}

/** Cover + candidats pour les cartes (spotlight d’abord). */
export function spotlightCoverCandidates(
  spotlight: ChallengeSpotlight | null,
  extras: string[] = [],
) {
  const fromSpot = spotlight
    ? [
        spotlight.kind === "video"
          ? (spotlight.posterUrl ?? spotlight.url)
          : spotlight.url,
      ].filter(Boolean)
    : [];
  return [...fromSpot, ...extras].filter(
    (url, index, all) => Boolean(url) && all.indexOf(url) === index,
  );
}
