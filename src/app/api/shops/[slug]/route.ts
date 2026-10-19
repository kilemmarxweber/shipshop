import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isPublicUploadPath } from "@/lib/upload-url";
import { parseFxRate } from "@/lib/money";

const updateSchema = z.object({
  logoUrl: z.string().min(1).max(500).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  fxCdfPerUsd: z.number().int().min(1).max(100_000).optional(),
  fxKwPerUsd: z.number().int().min(1).max(100_000).optional(),
});

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { slug } = await params;
    const body = updateSchema.parse(await req.json());
    const shop = await withDbRetry(() =>
      prisma.shop.findFirst({ where: { slug } }),
    );
    if (!shop) {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    const isOwner = shop.ownerUserId === session.user.id;
    const member = await withDbRetry(() =>
      prisma.member.findFirst({
        where: { organizationId: shop.organizationId, userId: session.user.id },
      }),
    );
    if (!isOwner && !member) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (body.logoUrl && !isPublicUploadPath(body.logoUrl)) {
      return NextResponse.json({ error: "Logo invalide" }, { status: 400 });
    }

    const updated = await withDbRetry(() =>
      prisma.shop.update({
        where: { id: shop.id },
        data: {
          ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
          ...(body.description !== undefined
            ? { description: body.description }
            : {}),
          ...(body.fxCdfPerUsd !== undefined
            ? {
                fxCdfPerUsd: parseFxRate(body.fxCdfPerUsd, shop.fxCdfPerUsd),
                fxRateUpdatedAt: new Date(),
              }
            : {}),
          ...(body.fxKwPerUsd !== undefined
            ? {
                fxKwPerUsd: parseFxRate(body.fxKwPerUsd, shop.fxKwPerUsd),
                fxRateUpdatedAt: new Date(),
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          logoUrl: true,
          currency: true,
          fxCdfPerUsd: true,
          fxKwPerUsd: true,
          fxRateUpdatedAt: true,
        },
      }),
    );

    return NextResponse.json({ shop: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mise à jour impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
