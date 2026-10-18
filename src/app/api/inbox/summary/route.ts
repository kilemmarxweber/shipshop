import { NextResponse } from "next/server";
import { shopIdsForSellerInbox } from "@/lib/conversation-access";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const shopIds = await shopIdsForSellerInbox(session.user.id);
    const unreadWhere = {
      product: { shopId: { in: shopIds } },
      userId: { not: session.user.id },
      reads: { none: { userId: session.user.id } },
    };

    const [unreadComments, comments] = await Promise.all([
      shopIds.length
        ? withDbRetry(() => prisma.productComment.count({ where: unreadWhere }))
        : Promise.resolve(0),
      shopIds.length
        ? withDbRetry(() =>
            prisma.productComment.findMany({
              where: { product: { shopId: { in: shopIds } } },
              orderBy: { createdAt: "desc" },
              take: 20,
              select: {
                id: true,
                body: true,
                createdAt: true,
                user: { select: { id: true, name: true, image: true } },
                product: {
                  select: {
                    id: true,
                    title: true,
                    images: true,
                    shop: { select: { id: true, name: true, logoUrl: true } },
                  },
                },
                reads: {
                  where: { userId: session.user.id },
                  select: { id: true },
                },
              },
            }),
          )
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      unreadComments,
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        unread: c.user.id !== session.user.id && c.reads.length === 0,
        user: c.user,
        product: {
          id: c.product.id,
          title: c.product.title,
          images: c.product.images,
          shop: c.product.shop,
        },
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
