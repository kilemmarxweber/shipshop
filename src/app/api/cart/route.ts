import { prisma, withDbRetry } from "@/lib/prisma";
import { productStock } from "@/lib/product-stock";
import { getSession } from "@/lib/session";
import { soldOrdersCount } from "@/lib/sold-orders";
import { NextResponse } from "next/server";
import { z } from "zod";

const addSchema = z.object({
  productId: z.string().min(1),
  quantity: z.preprocess(
    (value) => (value === null || value === "" ? undefined : value),
    z.number().int().min(1).max(100_000).optional(),
  ),
  increment: z.boolean().optional(),
});

function publicCartItems(items: Awaited<ReturnType<typeof loadCart>>) {
  return items.map((item) => {
    const { _count, ...product } = item.product;
    return {
      ...item,
      product: {
        ...product,
        soldCount: _count.orders,
        quantity: product.quantity,
        stockRemaining: Math.max(0, product.quantity),
      },
    };
  });
}

function cartTotals(
  items: { quantity: number; product: { priceCents: number } }[],
) {
  const totalCents = items.reduce(
    (sum, item) => sum + item.product.priceCents * Math.max(1, item.quantity),
    0,
  );
  const pieces = items.reduce(
    (sum, item) => sum + Math.max(1, item.quantity),
    0,
  );
  return { totalCents, count: items.length, pieces };
}

async function loadCart(userId: string) {
  return withDbRetry(() =>
    prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            priceCents: true,
            compareAtCents: true,
            promoPercent: true,
            promoTier: true,
            currency: true,
            images: true,
            status: true,
            quantity: true,
            location: true,
            _count: { select: { orders: soldOrdersCount } },
            shop: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  );
}

async function syncCartToStock(userId: string) {
  const items = await loadCart(userId);
  const removeIds = items
    .filter((item) => productStock(item.product) <= 0)
    .map((item) => item.id);
  const clamps = items.filter((item) => {
    const stock = productStock(item.product);
    return stock > 0 && item.quantity > stock;
  });
  if (removeIds.length) {
    await withDbRetry(() =>
      prisma.cartItem.deleteMany({ where: { id: { in: removeIds } } }),
    );
  }
  for (const item of clamps) {
    const stock = productStock(item.product);
    await withDbRetry(() =>
      prisma.cartItem.update({
        where: { id: item.id },
        data: { quantity: stock },
      }),
    );
  }
  if (removeIds.length || clamps.length) return loadCart(userId);
  return items;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const items = await syncCartToStock(session.user.id);
    const visible = publicCartItems(items);
    return NextResponse.json({ items: visible, ...cartTotals(visible) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur panier";
    console.error("[api/cart GET]", message);
    return NextResponse.json(
      { error: message, items: [], totalCents: 0, count: 0 },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const {
      productId,
      quantity: nextQty,
      increment,
    } = addSchema.parse(await req.json());

    const product = await withDbRetry(() =>
      prisma.product.findUnique({ where: { id: productId } }),
    );
    if (!product || product.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Produit indisponible" },
        { status: 400 },
      );
    }
    const stock = productStock(product);
    if (stock <= 0) {
      return NextResponse.json(
        { error: "Produit en rupture de stock" },
        { status: 400 },
      );
    }

    const existing = await withDbRetry(() =>
      prisma.cartItem.findUnique({
        where: {
          userId_productId: { userId: session.user.id, productId },
        },
      }),
    );

    const addQty = typeof nextQty === "number" ? nextQty : 1;
    const quantity = increment
      ? (existing?.quantity ?? 0) + addQty
      : typeof nextQty === "number"
        ? nextQty
        : (existing?.quantity ?? 0) + 1;

    if (quantity > stock) {
      return NextResponse.json(
        { error: `Stock max : ${stock}` },
        { status: 400 },
      );
    }

    await withDbRetry(() =>
      prisma.cartItem.upsert({
        where: {
          userId_productId: {
            userId: session.user.id,
            productId,
          },
        },
        create: {
          userId: session.user.id,
          productId,
          quantity,
        },
        update: { quantity },
      }),
    );

    const items = await syncCartToStock(session.user.id);
    const visible = publicCartItems(items);
    return NextResponse.json(
      { items: visible, ...cartTotals(visible) },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible d'ajouter";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const clearAll = searchParams.get("all") === "1";

    if (clearAll) {
      await withDbRetry(() =>
        prisma.cartItem.deleteMany({ where: { userId: session.user.id } }),
      );
    } else if (productId) {
      await withDbRetry(() =>
        prisma.cartItem.deleteMany({
          where: { userId: session.user.id, productId },
        }),
      );
    } else {
      return NextResponse.json(
        { error: "productId ou all=1 requis" },
        { status: 400 },
      );
    }

    const items = await syncCartToStock(session.user.id);
    const visible = publicCartItems(items);
    return NextResponse.json({ items: visible, ...cartTotals(visible) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Suppression impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
