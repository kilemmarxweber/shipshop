import { NextResponse } from "next/server";
import { z } from "zod";
import { assertChipShopOwner } from "@/lib/kyc";
import {
  getAppConfig,
  setContentSource,
  setScrollAdCampaign,
  type ContentSource,
} from "@/lib/content-source";
import { parseScrollAdVideos } from "@/lib/scroll-ad";
import { catalogScanActive } from "@/lib/moderation.server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Réservé à l'owner" }, { status: 403 });
  }

  const cfg = await getAppConfig();
  const reviews = await withDbRetry(() =>
    prisma.mediaReview.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  );

  return NextResponse.json({
    source: cfg.requestedSource,
    activeSource: cfg.source,
    sanityConfigured: cfg.sanityConfigured,
    projectId: cfg.projectId || null,
    dataset: cfg.dataset,
    nsfwReview: cfg.nsfwPolicy.humanReview,
    nsfwForbidden: true,
    rekognitionActive: catalogScanActive(),
    clipSeconds: cfg.clipSeconds,
    maxImages: cfg.maxImages,
    catalogTrackCount: cfg.catalogTracks.length,
    scrollAdEnabled: cfg.scrollAd.enabled,
    scrollAdDelaySeconds: cfg.scrollAd.delaySeconds,
    scrollAdStartsAt: cfg.scrollAd.startsAt,
    scrollAdEndsAt: cfg.scrollAd.endsAt,
    scrollAdVideos: cfg.scrollAd.videos,
    reviews,
  });
}

const isoOrEmpty = z
  .union([z.string().min(1), z.null()])
  .optional();

const patchSchema = z.object({
  source: z.enum(["system", "sanity"]).optional(),
  nsfwReview: z.boolean().optional(),
  reviewId: z.string().min(1).optional(),
  reviewStatus: z.enum(["done", "pending"]).optional(),
  scrollAdEnabled: z.boolean().optional(),
  scrollAdDelaySeconds: z.number().int().min(0).max(3600).optional(),
  scrollAdStartsAt: isoOrEmpty,
  scrollAdEndsAt: isoOrEmpty,
  scrollAdVideos: z
    .array(
      z.union([
        z.string().max(500),
        z.object({
          url: z.string().max(500),
          enabled: z.boolean().optional(),
          priority: z.number().int().min(1).max(99).optional(),
        }),
      ]),
    )
    .max(8)
    .optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Réservé à l'owner" }, { status: 403 });
  }

  try {
    const body = patchSchema.parse(await req.json());
    if (body.reviewId && body.reviewStatus) {
      await withDbRetry(() =>
        prisma.mediaReview.update({
          where: { id: body.reviewId },
          data: { status: body.reviewStatus },
        }),
      );
    }
    if (body.source) {
      await setContentSource({
        source: body.source as ContentSource,
        nsfwReview: body.nsfwReview ?? false,
      });
    }
    const hasScrollAd =
      body.scrollAdEnabled !== undefined ||
      body.scrollAdDelaySeconds !== undefined ||
      body.scrollAdStartsAt !== undefined ||
      body.scrollAdEndsAt !== undefined ||
      body.scrollAdVideos !== undefined;
    if (hasScrollAd) {
      await setScrollAdCampaign({
        enabled: body.scrollAdEnabled,
        delaySeconds: body.scrollAdDelaySeconds,
        startsAt:
          body.scrollAdStartsAt === undefined
            ? undefined
            : body.scrollAdStartsAt,
        endsAt:
          body.scrollAdEndsAt === undefined ? undefined : body.scrollAdEndsAt,
        videos:
          body.scrollAdVideos === undefined
            ? undefined
            : parseScrollAdVideos(body.scrollAdVideos, false),
      });
    }
    const cfg = await getAppConfig();
    return NextResponse.json({
      source: cfg.requestedSource,
      activeSource: cfg.source,
      nsfwReview: cfg.nsfwPolicy.humanReview,
      scrollAdEnabled: cfg.scrollAd.enabled,
      scrollAdDelaySeconds: cfg.scrollAd.delaySeconds,
      scrollAdStartsAt: cfg.scrollAd.startsAt,
      scrollAdEndsAt: cfg.scrollAd.endsAt,
      scrollAdVideos: cfg.scrollAd.videos,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mise à jour impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
