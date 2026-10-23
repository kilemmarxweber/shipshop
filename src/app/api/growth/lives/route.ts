import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { prisma, withDbRetry } from "@/lib/prisma";
import { hasActiveBadge, refreshAccountBadges } from "@/lib/growth/badges";
import { assertChipShopOwner } from "@/lib/kyc";

const schema = z.object({
  title: z.string().min(2).max(80),
  productId: z.string().optional().nullable(),
});

export async function GET() {
  const lives = await withDbRetry(() =>
    prisma.creatorLive.findMany({
      where: { status: "LIVE" },
      orderBy: { startedAt: "desc" },
      take: 30,
      select: {
        id: true,
        title: true,
        startedAt: true,
        giftCents: true,
        viewerPeak: true,
        user: { select: { id: true, name: true, image: true } },
        product: {
          select: {
            id: true,
            title: true,
            images: true,
            priceCents: true,
            currency: true,
          },
        },
      },
    }),
  );
  return NextResponse.json({ lives });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  await refreshAccountBadges(session.user.id);
  const allowed = await hasActiveBadge(session.user.id, "INFLUENCER");
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!allowed && !isOwner) {
    return NextResponse.json(
      { error: "Live réservé aux comptes Influenceur (2 000 abonnés + KYC)" },
      { status: 403 },
    );
  }
  try {
    const body = schema.parse(await req.json());
    await withDbRetry(() =>
      prisma.creatorLive.updateMany({
        where: { userId: session.user.id, status: "LIVE" },
        data: { status: "ENDED", endedAt: new Date() },
      }),
    );
    const live = await withDbRetry(() =>
      prisma.creatorLive.create({
        data: {
          userId: session.user.id,
          title: body.title,
          productId: body.productId ?? null,
          status: "LIVE",
        },
      }),
    );
    return NextResponse.json({ live });
  } catch {
    return NextResponse.json({ error: "Live impossible" }, { status: 400 });
  }
}
