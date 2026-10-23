import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma, withDbRetry } from "@/lib/prisma";

/** Catalogue produits du host (boutiques) pour glisser sur le live. */
export async function GET(
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
      select: { userId: true, status: true },
    }),
  );
  if (!live) {
    return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
  }
  if (live.userId !== session.user.id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const category = new URL(req.url).searchParams.get("category")?.trim() ?? "";

  const products = await withDbRetry(() =>
    prisma.product.findMany({
      where: {
        status: "ACTIVE",
        shop: { ownerUserId: live.userId },
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(category ? { category } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        id: true,
        title: true,
        description: true,
        images: true,
        priceCents: true,
        currency: true,
        category: true,
        shop: { select: { name: true } },
      },
    }),
  );

  const categories = await withDbRetry(() =>
    prisma.product.findMany({
      where: {
        status: "ACTIVE",
        shop: { ownerUserId: live.userId },
      },
      distinct: ["category"],
      select: { category: true },
      take: 40,
    }),
  );

  return NextResponse.json({
    products,
    categories: categories.map((c) => c.category).filter(Boolean),
  });
}
