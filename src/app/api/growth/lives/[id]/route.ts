import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { prisma, withDbRetry } from "@/lib/prisma";
import { sendCreatorGift } from "@/lib/growth/gifts";
import type { GiftKind } from "@/lib/growth/constants";

const chatSchema = z.object({
  body: z.string().min(1).max(180),
});

const giftSchema = z.object({
  kind: z.enum(["SMALL", "MEDIUM", "PREMIUM"]),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const live = await withDbRetry(() =>
    prisma.creatorLive.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, image: true } },
        product: {
          select: {
            id: true,
            title: true,
            images: true,
            priceCents: true,
            currency: true,
            shop: { select: { id: true, name: true, slug: true } },
          },
        },
        chats: {
          orderBy: { createdAt: "desc" },
          take: 40,
          select: {
            id: true,
            body: true,
            createdAt: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    }),
  );
  if (!live) {
    return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
  }
  await withDbRetry(() =>
    prisma.creatorLive.update({
      where: { id },
      data: { viewerPeak: { increment: 1 } },
    }),
  );
  return NextResponse.json({
    live: {
      ...live,
      chats: [...live.chats].reverse(),
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { id } = await params;
  const live = await withDbRetry(() =>
    prisma.creatorLive.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    }),
  );
  if (!live) {
    return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
  }

  const json = (await req.json()) as { action?: string };
  if (json.action === "end") {
    if (live.userId !== session.user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    await withDbRetry(() =>
      prisma.creatorLive.update({
        where: { id },
        data: { status: "ENDED", endedAt: new Date() },
      }),
    );
    return NextResponse.json({ ok: true });
  }

  if (json.action === "chat") {
    const parsed = chatSchema.parse(json);
    const message = await withDbRetry(() =>
      prisma.liveChatMessage.create({
        data: {
          liveId: id,
          userId: session.user.id,
          body: parsed.body,
        },
        select: {
          id: true,
          body: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
      }),
    );
    return NextResponse.json({ message });
  }

  if (json.action === "gift") {
    const parsed = giftSchema.parse(json);
    try {
      const result = await sendCreatorGift({
        fromUserId: session.user.id,
        toUserId: live.userId,
        kind: parsed.kind as GiftKind,
        liveId: id,
      });
      return NextResponse.json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Cadeau impossible";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
