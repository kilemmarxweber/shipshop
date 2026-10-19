import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const schema = z.object({
  deltaMs: z.number().int().min(1_000).max(20_000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = schema.parse(await req.json());
    const product = await withDbRetry(() =>
      prisma.product.findUnique({
        where: { id },
        select: { id: true },
      }),
    );
    if (!product) {
      return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    }

    const existing = await withDbRetry(() =>
      prisma.productDwell.findUnique({
        where: {
          userId_productId: { userId: session.user.id, productId: id },
        },
        select: { lastSeenAt: true },
      }),
    );
    const newView =
      !existing || Date.now() - existing.lastSeenAt.getTime() > 30 * 60_000;

    await withDbRetry(() =>
      prisma.productDwell.upsert({
        where: {
          userId_productId: { userId: session.user.id, productId: id },
        },
        create: {
          userId: session.user.id,
          productId: id,
          dwellMs: body.deltaMs,
          viewCount: 1,
        },
        update: {
          dwellMs: { increment: body.deltaMs },
          lastSeenAt: new Date(),
          ...(newView ? { viewCount: { increment: 1 } } : {}),
        },
      }),
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
