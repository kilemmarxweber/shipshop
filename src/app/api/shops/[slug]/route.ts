import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/** Profil public boutique (par slug) + stats catégories. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const shop = await withDbRetry(() =>
      prisma.shop.findFirst({
        where: { slug, isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          logoUrl: true,
          lat: true,
          lng: true,
          createdAt: true,
          owner: {
            select: {
              id: true,
              name: true,
              phone: true,
              image: true,
            },
          },
          _count: {
            select: {
              products: { where: { status: "ACTIVE" } },
              followers: true,
            },
          },
          products: {
            where: { status: "ACTIVE" },
            select: { location: true, category: true },
            take: 80,
          },
        },
      }),
    );

    if (!shop) {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    const categoryCounts: Record<string, number> = {};
    const locations: string[] = [];
    for (const p of shop.products) {
      categoryCounts[p.category] = (categoryCounts[p.category] ?? 0) + 1;
      if (p.location?.trim()) locations.push(p.location.trim());
    }
    // Adresse indicative = localisation la plus fréquente des produits
    const locFreq = new Map<string, number>();
    for (const loc of locations) {
      locFreq.set(loc, (locFreq.get(loc) ?? 0) + 1);
    }
    let addressHint: string | null = null;
    let best = 0;
    for (const [loc, n] of locFreq) {
      if (n > best) {
        best = n;
        addressHint = loc;
      }
    }

    const { products: _p, _count, ...rest } = shop;
    const session = await getSession();
    const followedByMe = session
      ? Boolean(
          await withDbRetry(() =>
            prisma.shopFollow.findUnique({
              where: {
                userId_shopId: {
                  userId: session.user.id,
                  shopId: shop.id,
                },
              },
              select: { id: true },
            }),
          ),
        )
      : false;

    return NextResponse.json({
      shop: {
        ...rest,
        productsCount: _count.products,
        followersCount: _count.followers,
        followedByMe,
        categories: Object.entries(categoryCounts)
          .map(([id, count]) => ({ id, count }))
          .sort((a, b) => b.count - a.count),
        addressHint: addressHint ?? "Kinshasa, RDC",
        contactPhone: shop.owner?.phone ?? null,
        contactName: shop.owner?.name ?? null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur boutique";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
