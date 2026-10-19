import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const addSchema = z.object({
  productId: z.string().min(1),
  quantity: z.preprocess(
    (value) => (value === null || value === "" ? undefined : value),
    z.number().int().min(1).max(100_000).optional(),
  ),
});

function cartTotals(
  items: { quantity: number; product: { priceCents: number } }[],
) {
  const totalCents = items.reduce(
    (sum, item) => sum + item.product.priceCents * Math.max(1, item.quantity),
    0,
  );
  const count = items.reduce((sum, item) => sum + Math.max(1, item.quantity), 0);
  return { totalCents, count };
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
            currency: true,
            images: true,
            status: true,
            quantity: true,
            location: true,
            shop: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  );
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const items = await loadCart(session.user.id);
    return NextResponse.json({ items, ...cartTotals(items) });
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
    const { productId, quantity: nextQty } = addSchema.parse(await req.json());

    const product = await withDbRetry(() =>
      prisma.product.findUnique({ where: { id: productId } }),
    );
    if (!product || product.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Produit indisponible" },
        { status: 400 },
      );
    }
    const stock = Math.max(1, product.quantity);

    const existing = await withDbRetry(() =>
      prisma.cartItem.findUnique({
        where: {
          userId_productId: { userId: session.user.id, productId },
        },
      }),
    );

    const quantity =
      typeof nextQty === "number"
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

    const items = await loadCart(session.user.id);
    return NextResponse.json(
      { items, ...cartTotals(items) },
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

    const items = await loadCart(session.user.id);
    return NextResponse.json({ items, ...cartTotals(items) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Suppression impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
