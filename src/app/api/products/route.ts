import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const createSchema = z.object({
  shopId: z.string().min(1),
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  priceCents: z.number().int().min(100),
  quantity: z.number().int().min(1).max(100_000).default(1),
  category: z.string().min(1),
  images: z.array(z.string().min(1)).max(12).default([]),
  colors: z.array(z.string().min(1).max(40)).max(12).default([]),
  sizes: z.array(z.string().min(1).max(20)).max(20).default([]),
  location: z.string().max(200).optional(),
  status: z.enum(["DRAFT", "ACTIVE"]).default("DRAFT"),
});

export async function GET(req: Request) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const q = searchParams.get("q");
    const shopId = searchParams.get("shopId");
    const mine = searchParams.get("mine") === "1";
    const status = searchParams.get("status");

    if (mine) {
      if (!session) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
      }
      // Rattache les shops legacy sans owner au vendeur connecté s'il est membre
      await withDbRetry(() =>
        prisma.shop.updateMany({
          where: {
            ownerUserId: null,
            organization: {
              members: { some: { userId: session.user.id } },
            },
          },
          data: { ownerUserId: session.user.id },
        }),
      );

      const products = await withDbRetry(() =>
        prisma.product.findMany({
          where: {
            shop: { ownerUserId: session.user.id },
            ...(status
              ? { status: status as "ACTIVE" | "DRAFT" | "SOLD" | "HIDDEN" }
              : {}),
          },
          include: {
            shop: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                ownerUserId: true,
              },
            },
            _count: { select: { likes: true, orders: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      );
      return NextResponse.json({
        products: products.map(({ _count, ...rest }) => ({
          ...rest,
          likesCount: _count.likes,
          ordersCount: _count.orders,
          canDelete: _count.orders === 0,
          likedByMe: false,
        })),
      });
    }

    const products = await withDbRetry(() =>
      prisma.product.findMany({
        where: {
          status: (status ?? "ACTIVE") as "ACTIVE" | "DRAFT" | "SOLD" | "HIDDEN",
          ...(category ? { category } : {}),
          ...(shopId ? { shopId } : {}),
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
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
              logoUrl: true,
            },
          },
          _count: { select: { likes: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
    );

    let likedIds = new Set<string>();
    if (session && products.length) {
      const likes = await withDbRetry(() =>
        prisma.productLike.findMany({
          where: {
            userId: session.user.id,
            productId: { in: products.map((p) => p.id) },
          },
          select: { productId: true },
        }),
      );
      likedIds = new Set(likes.map((l) => l.productId));
    }

    const mapped = products.map((p) => {
      const { _count, ...rest } = p;
      return {
        ...rest,
        likesCount: _count.likes,
        likedByMe: likedIds.has(p.id),
      };
    });

    return NextResponse.json({ products: mapped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur produits";
    console.error("[api/products]", message);
    return NextResponse.json({ error: message, products: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = createSchema.parse(await req.json());
    const shop = await prisma.shop.findUnique({ where: { id: body.shopId } });
    if (!shop) {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    const isOwner = shop.ownerUserId === session.user.id;
    const member = await prisma.member.findFirst({
      where: {
        organizationId: shop.organizationId,
        userId: session.user.id,
      },
    });
    if (!isOwner && !member) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const images = body.images
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 12);

    const product = await prisma.product.create({
      data: {
        shopId: body.shopId,
        title: body.title,
        description: body.description,
        priceCents: body.priceCents,
        quantity: body.quantity,
        category: body.category,
        images: images.length
          ? images
          : [
              `https://picsum.photos/seed/${encodeURIComponent(body.title)}/800/1000`,
            ],
        colors: body.colors,
        sizes: body.sizes,
        location: body.location ?? "Kinshasa",
        status: body.status,
      },
      include: { shop: true },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur produit";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
