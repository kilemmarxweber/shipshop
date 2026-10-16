import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

async function shopBySlug(slug: string) {
  return withDbRetry(() =>
    prisma.shop.findFirst({
      where: { slug, isActive: true },
      select: { id: true, ownerUserId: true },
    }),
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const shop = await shopBySlug(slug);
  if (!shop) {
    return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
  }

  const session = await getSession();
  const [count, follow] = await Promise.all([
    withDbRetry(() =>
      prisma.shopFollow.count({ where: { shopId: shop.id } }),
    ),
    session
      ? withDbRetry(() =>
          prisma.shopFollow.findUnique({
            where: {
              userId_shopId: { userId: session.user.id, shopId: shop.id },
            },
            select: { id: true },
          }),
        )
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    followersCount: count,
    followedByMe: Boolean(follow),
  });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { slug } = await params;
  const shop = await shopBySlug(slug);
  if (!shop) {
    return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
  }
  if (shop.ownerUserId === session.user.id) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas suivre votre boutique" },
      { status: 400 },
    );
  }

  await withDbRetry(() =>
    prisma.shopFollow.upsert({
      where: {
        userId_shopId: { userId: session.user.id, shopId: shop.id },
      },
      create: { userId: session.user.id, shopId: shop.id },
      update: {},
    }),
  );

  const followersCount = await withDbRetry(() =>
    prisma.shopFollow.count({ where: { shopId: shop.id } }),
  );

  return NextResponse.json({ followedByMe: true, followersCount });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { slug } = await params;
  const shop = await shopBySlug(slug);
  if (!shop) {
    return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
  }

  await withDbRetry(() =>
    prisma.shopFollow.deleteMany({
      where: { userId: session.user.id, shopId: shop.id },
    }),
  );

  const followersCount = await withDbRetry(() =>
    prisma.shopFollow.count({ where: { shopId: shop.id } }),
  );

  return NextResponse.json({ followedByMe: false, followersCount });
}
