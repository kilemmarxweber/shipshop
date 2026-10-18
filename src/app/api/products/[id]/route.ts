import { NextResponse } from "next/server";
import { z } from "zod";
import { assertChipShopOwner } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { APP_CURRENCIES } from "@/lib/money";

const updateSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  priceCents: z.number().int().min(100).optional(),
  currency: z.enum(APP_CURRENCIES).optional(),
  quantity: z.number().int().min(0).max(100_000).optional(),
  category: z.string().min(1).optional(),
  images: z.array(z.string().min(1)).max(12).optional(),
  colors: z.array(z.string().min(1).max(40)).max(12).optional(),
  sizes: z.array(z.string().min(1).max(20)).max(20).optional(),
  location: z.string().max(200).optional().nullable(),
  soundtrackId: z.string().min(1).optional().nullable(),
  soundtrackStartMs: z.number().int().min(0).max(600_000).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "SOLD", "HIDDEN"]).optional(),
});

async function assertCanEdit(userId: string, shopId: string) {
  const shop = await withDbRetry(() =>
    prisma.shop.findUnique({ where: { id: shopId } }),
  );
  if (!shop) return null;
  if (shop.ownerUserId === userId) return shop;
  const member = await withDbRetry(() =>
    prisma.member.findFirst({
      where: { organizationId: shop.organizationId, userId },
    }),
  );
  if (member) return shop;
  const { isOwner } = await assertChipShopOwner(userId);
  return isOwner ? shop : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();

    const product = await withDbRetry(() =>
      prisma.product.findUnique({
        where: { id },
        include: {
          _count: { select: { orders: true, comments: true } },
          soundtrack: {
            select: {
              id: true,
              title: true,
              audioUrl: true,
              durationMs: true,
            },
          },
        },
      }),
    );

    if (!product) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    const shop = await withDbRetry(() =>
      prisma.shop.findUnique({
        where: { id: product.shopId },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          organizationId: true,
          ownerUserId: true,
        },
      }),
    );

    if (!shop) {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    // Brouillons / archivés : réservés au vendeur
    if (product.status === "DRAFT" || product.status === "HIDDEN") {
      const canEdit = session
        ? await assertCanEdit(session.user.id, product.shopId)
        : null;
      if (!canEdit) {
        return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
      }
    }

    const likesCount = await withDbRetry(() =>
      prisma.productLike.count({ where: { productId: id } }),
    );
    const commentsCount = product._count.comments;
    let likedByMe = false;
    if (session) {
      const like = await withDbRetry(() =>
        prisma.productLike.findUnique({
          where: {
            userId_productId: { userId: session.user.id, productId: id },
          },
        }),
      );
      likedByMe = Boolean(like);
    }

    const { _count, ...rest } = product;
    return NextResponse.json({
      product: {
        ...rest,
        shop,
        likesCount,
        commentsCount,
        likedByMe,
        ordersCount: _count.orders,
        canDelete: _count.orders === 0,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur produit";
    console.error("[api/products/:id]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = updateSchema.parse(await req.json());
    const existing = await withDbRetry(() =>
      prisma.product.findUnique({ where: { id } }),
    );
    if (!existing) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    const shop = await assertCanEdit(session.user.id, existing.shopId);
    if (!shop) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    let status = body.status;
    // Ne pas forcer SOLD si le vendeur archive / met en brouillon explicitement
    if (
      body.quantity !== undefined &&
      body.status === undefined
    ) {
      const quantity = body.quantity;
      if (quantity <= 0 && existing.status === "ACTIVE") status = "SOLD";
      else if (existing.status === "SOLD" && quantity > 0) status = "ACTIVE";
    }

    const product = await withDbRetry(() =>
      prisma.product.update({
        where: { id },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined
            ? { description: body.description }
            : {}),
          ...(body.priceCents !== undefined
            ? { priceCents: body.priceCents }
            : {}),
          ...(body.currency !== undefined ? { currency: body.currency } : {}),
          ...(body.quantity !== undefined ? { quantity: body.quantity } : {}),
          ...(body.category !== undefined ? { category: body.category } : {}),
          ...(body.images !== undefined ? { images: body.images } : {}),
          ...(body.colors !== undefined ? { colors: body.colors } : {}),
          ...(body.sizes !== undefined ? { sizes: body.sizes } : {}),
          ...(body.location !== undefined ? { location: body.location } : {}),
          ...(body.soundtrackId !== undefined
            ? { soundtrackId: body.soundtrackId }
            : {}),
          ...(body.soundtrackStartMs !== undefined
            ? { soundtrackStartMs: body.soundtrackStartMs }
            : {}),
          ...(status !== undefined ? { status } : {}),
        },
        include: {
          shop: { select: { id: true, name: true, slug: true } },
          _count: { select: { orders: true } },
        },
      }),
    );

    const { _count, ...rest } = product;
    return NextResponse.json({
      product: {
        ...rest,
        ordersCount: _count.orders,
        canDelete: _count.orders === 0,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mise à jour impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Suppression définitive uniquement si aucune commande / paiement lié. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await withDbRetry(() =>
      prisma.product.findUnique({
        where: { id },
        include: { _count: { select: { orders: true } } },
      }),
    );
    if (!existing) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }
    const shop = await assertCanEdit(session.user.id, existing.shopId);
    if (!shop) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (existing._count.orders > 0) {
      return NextResponse.json(
        {
          error:
            "Impossible de supprimer : ce produit est lié à un paiement. Archivez-le à la place.",
          code: "HAS_ORDERS",
          ordersCount: existing._count.orders,
        },
        { status: 409 },
      );
    }

    await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        await tx.cartItem.deleteMany({ where: { productId: id } });
        await tx.productLike.deleteMany({ where: { productId: id } });
        await tx.conversation.updateMany({
          where: { productId: id },
          data: { productId: null },
        });
        await tx.product.delete({ where: { id } });
      }),
    );

    return NextResponse.json({ ok: true, deleted: id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Suppression impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
