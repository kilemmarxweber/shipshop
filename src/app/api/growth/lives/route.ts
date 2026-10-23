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
      where: { status: { in: ["LIVE", "PAUSED"] } },
      orderBy: { startedAt: "desc" },
      take: 30,
      select: {
        id: true,
        title: true,
        status: true,
        startedAt: true,
        giftCents: true,
        viewerPeak: true,
        pauseReason: true,
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
  const { isPlatformOwner } = await assertChipShopOwner(session.user.id);
  if (!allowed && !isPlatformOwner) {
    return NextResponse.json(
      { error: "Live réservé aux comptes Influenceur (2 000 abonnés + KYC) ou owner" },
      { status: 403 },
    );
  }
  try {
    const raw = (await req.json().catch(() => ({}))) as {
      title?: string;
      productId?: string | null;
    };
    const title = (raw.title ?? "").trim() || "Live shopping";
    const body = schema.parse({
      title,
      productId: raw.productId ?? null,
    });
    await withDbRetry(() =>
      prisma.creatorLive.updateMany({
        where: { userId: session.user.id, status: { in: ["LIVE", "PAUSED"] } },
        data: {
          status: "ENDED",
          endedAt: new Date(),
          endReason: "host",
        },
      }),
    );
    const live = await withDbRetry(() =>
      prisma.creatorLive.create({
        data: {
          userId: session.user.id,
          title: body.title,
          productId: body.productId ?? null,
          status: "LIVE",
          lastHeartbeatAt: new Date(),
          plannedMinutes: 60,
          cameraOn: true,
        },
      }),
    );
    return NextResponse.json({ live });
  } catch (error) {
    console.error("[api/growth/lives] POST", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Titre invalide (2–80 caractères)" },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("column") ||
      message.includes("Unknown arg") ||
      message.includes("Unknown field")
    ) {
      return NextResponse.json(
        {
          error:
            "Schéma live pas à jour — redémarrez `pnpm dev` après la migration",
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Live impossible" }, { status: 400 });
  }
}
