import { NextResponse } from "next/server";
import { z } from "zod";
import { collectFollowingProductIds } from "@/lib/following-feed";
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
    const following = searchParams.get("following") === "1";
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

    let followingWhere: object | null = null;
    let recency = new Map<string, number>();
    let followedShopIds: string[] = [];
    if (following) {
      if (!session) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
      }
      const collected = await collectFollowingProductIds(session.user.id);
      recency = collected.recency;
      followedShopIds = collected.shopIds;
      if (collected.shopIds.length === 0 && collected.productIds.length === 0) {
        return NextResponse.json({ products: [] });
      }
      const or: object[] = [];
      if (collected.shopIds.length) {
        or.push({
          shopId: { in: collected.shopIds },
          status: "ACTIVE",
          wantedRequestId: null,
        });
      }
      if (collected.productIds.length) {
        or.push({
          id: { in: collected.productIds },
          status: { in: ["ACTIVE", "SOLD"] },
          wantedRequestId: null,
        });
      }
      followingWhere = { OR: or };
    }

    const and: Record<string, unknown>[] = [];
    if (followingWhere) {
      and.push(followingWhere as Record<string, unknown>);
    } else {
      and.push({
        status: (status ?? "ACTIVE") as
          | "ACTIVE"
          | "DRAFT"
          | "SOLD"
          | "HIDDEN",
        wantedRequestId: null,
      });
    }
    if (category) and.push({ category });
    if (shopId && !following) and.push({ shopId });
    if (q) {
      and.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    let products = await withDbRetry(() =>
      prisma.product.findMany({
        where: (and.length === 1 ? and[0] : { AND: and }) as never,
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
          _count: { select: { likes: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
    );

    if (following) {
      const followed = new Set(followedShopIds);
      products = [...products].sort((a, b) => {
        const aNew = followed.has(a.shopId) && a.status === "ACTIVE";
        const bNew = followed.has(b.shopId) && b.status === "ACTIVE";
        if (aNew !== bNew) return aNew ? -1 : 1;
        if (aNew && bNew) {
          return b.createdAt.getTime() - a.createdAt.getTime();
        }
        const ra = recency.get(a.id) ?? a.createdAt.getTime();
        const rb = recency.get(b.id) ?? b.createdAt.getTime();
        return rb - ra;
      });
    }

    let likedIds = new Set<string>();
    let followedIds = new Set<string>();
    if (session && products.length) {
      const shopIds = [...new Set(products.map((p) => p.shopId))];
      const [likes, follows] = await Promise.all([
        withDbRetry(() =>
          prisma.productLike.findMany({
            where: {
              userId: session.user.id,
              productId: { in: products.map((p) => p.id) },
            },
            select: { productId: true },
          }),
        ),
        withDbRetry(() =>
          prisma.shopFollow.findMany({
            where: {
              userId: session.user.id,
              shopId: { in: shopIds },
            },
            select: { shopId: true },
          }),
        ),
      ]);
      likedIds = new Set(likes.map((l) => l.productId));
      followedIds = new Set(follows.map((f) => f.shopId));
    }

    const mapped = products.map((p) => {
      const { _count, ...rest } = p;
      return {
        ...rest,
        likesCount: _count.likes,
        likedByMe: likedIds.has(p.id),
        shop: {
          ...p.shop,
          followedByMe: followedIds.has(p.shop.id),
        },
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

const bulkSchema = z.object({
  action: z.enum(["activate_products", "hide_products"]),
  productIds: z.array(z.string().min(1)).min(1).max(200),
});

/** Vendeur : republier / archiver 1..N de ses produits. */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = bulkSchema.parse(await req.json());
    const nextStatus =
      body.action === "hide_products" ? "HIDDEN" : "ACTIVE";

    const result = await withDbRetry(() =>
      prisma.product.updateMany({
        where: {
          id: { in: body.productIds },
          shop: { ownerUserId: session.user.id },
          ...(body.action === "hide_products"
            ? { status: "ACTIVE" as const }
            : {}),
        },
        data: { status: nextStatus },
      }),
    );

    return NextResponse.json({
      ok: true,
      updated: result.count,
      requested: body.productIds.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Action impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
