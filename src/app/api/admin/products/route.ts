import { NextResponse } from "next/server";
import { assertChipShopOwner } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/** Liste plateforme — tous les produits (owner / admin Chip Shop). */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { isOwner, org } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json(
      { error: "Réservé à l'owner ou à un admin Chip Shop" },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const q = searchParams.get("q")?.trim();
    const shopId = searchParams.get("shopId");

    const products = await withDbRetry(() =>
      prisma.product.findMany({
        where: {
          shop: { organizationId: org.id },
          ...(shopId ? { shopId } : {}),
          ...(status && status !== "all"
            ? { status: status as "DRAFT" | "ACTIVE" | "SOLD" | "HIDDEN" }
            : {}),
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
                  { shop: { name: { contains: q, mode: "insensitive" } } },
                ],
              }
            : {}),
        },
        include: {
          shop: {
            select: {
              id: true,
              name: true,
              slug: true,
              isActive: true,
              ownerUserId: true,
              owner: { select: { id: true, name: true, email: true } },
            },
          },
          _count: { select: { orders: true, likes: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
    );

    return NextResponse.json({
      products: products.map((p) => {
        const { _count, ...rest } = p;
        return {
          ...rest,
          ordersCount: _count.orders,
          likesCount: _count.likes,
          canDelete: _count.orders === 0,
        };
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur produits admin";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
