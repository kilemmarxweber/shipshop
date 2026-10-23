import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { sendCreatorGift } from "@/lib/growth/gifts";
import { GIFT_CATALOG, type GiftKind } from "@/lib/growth/constants";
import { prisma, withDbRetry } from "@/lib/prisma";

const schema = z.object({
  toUserId: z.string().min(1),
  kind: z.enum(["SMALL", "MEDIUM", "PREMIUM"]),
  liveId: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const received = await withDbRetry(() =>
    prisma.creatorGift.findMany({
      where: { toUserId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        kind: true,
        amountCents: true,
        createdAt: true,
        from: { select: { name: true } },
      },
    }),
  );
  return NextResponse.json({ catalog: GIFT_CATALOG, received });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  try {
    const body = schema.parse(await req.json());
    const result = await sendCreatorGift({
      fromUserId: session.user.id,
      toUserId: body.toUserId,
      kind: body.kind as GiftKind,
      liveId: body.liveId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cadeau impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
