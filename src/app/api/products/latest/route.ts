import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";

/** Dernières annonces actives — flash nouveautés (léger). */
export async function GET() {
  try {
    const products = await withDbRetry(() =>
      prisma.product.findMany({
        where: { status: "ACTIVE", wantedRequestId: null },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          priceCents: true,
          currency: true,
          createdAt: true,
          images: true,
          shop: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              ownerUserId: true,
            },
          },
        },
      }),
    );

    return NextResponse.json({
      products: products.map((p) => ({
        id: p.id,
        title: p.title,
        priceCents: p.priceCents,
        currency: p.currency,
        createdAt: p.createdAt,
        cover: p.images[0] ?? null,
        shop: p.shop,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur nouveautés";
    return NextResponse.json({ error: message, products: [] }, { status: 500 });
  }
}
