import { NextResponse } from "next/server";
import { z } from "zod";
import { assertChipShopOwner } from "@/lib/kyc";
import {
  getAppConfig,
  setContentSource,
  type ContentSource,
} from "@/lib/content-source";
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
    reviews,
  });
}

const patchSchema = z.object({
  source: z.enum(["system", "sanity"]),
  nsfwReview: z.boolean().optional(),
  reviewId: z.string().min(1).optional(),
  reviewStatus: z.enum(["done", "pending"]).optional(),
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
    } else {
      const source = body.source as ContentSource;
      await setContentSource({
        source,
        nsfwReview: body.nsfwReview ?? false,
      });
    }
    const cfg = await getAppConfig();
    return NextResponse.json({
      source: cfg.requestedSource,
      activeSource: cfg.source,
      nsfwReview: cfg.nsfwPolicy.humanReview,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mise à jour impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
