import { NextResponse } from "next/server";
import { z } from "zod";
import { assertChipShopOwner, kycPublic } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/** Liste de tous les vendeurs (boutiques + KYC + stats). */
export async function GET() {
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
    const shops = await withDbRetry(() =>
      prisma.shop.findMany({
        where: { organizationId: org.id },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          description: true,
          logoUrl: true,
          createdAt: true,
          ownerUserId: true,
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              image: true,
              createdAt: true,
              sellerKyc: true,
              wallet: { select: { balanceCents: true } },
            },
          },
          _count: {
            select: {
              products: true,
              orders: true,
            },
          },
          products: {
            select: { status: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    );

    const vendors = shops.map((shop) => {
      const byStatus: Record<string, number> = {};
      for (const p of shop.products) {
        byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
      }
      const { products: _p, _count, owner, ...rest } = shop;
      return {
        ...rest,
        productsCount: _count.products,
        ordersCount: _count.orders,
        productsByStatus: byStatus,
        owner: owner
          ? {
              id: owner.id,
              name: owner.name,
              email: owner.email,
              phone: owner.phone,
              image: owner.image,
              createdAt: owner.createdAt,
              walletBalanceCents: owner.wallet?.balanceCents ?? 0,
              kyc: owner.sellerKyc ? kycPublic(owner.sellerKyc) : null,
            }
          : null,
      };
    });

    return NextResponse.json({ vendors });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur vendeurs admin";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const patchSchema = z.object({
  shopId: z.string().min(1),
  action: z.enum([
    "activate",
    "deactivate",
    "hide_products",
    "activate_products",
  ]),
});

/** Actions owner sur une boutique / ses produits. */
export async function PATCH(req: Request) {
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
    const body = patchSchema.parse(await req.json());
    const shop = await withDbRetry(() =>
      prisma.shop.findFirst({
        where: { id: body.shopId, organizationId: org.id },
      }),
    );
    if (!shop) {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    if (body.action === "activate") {
      await withDbRetry(() =>
        prisma.shop.update({
          where: { id: shop.id },
          data: { isActive: true },
        }),
      );
      return NextResponse.json({ ok: true, isActive: true });
    }

    if (body.action === "deactivate") {
      await withDbRetry(() =>
        prisma.$transaction(async (tx) => {
          await tx.shop.update({
            where: { id: shop.id },
            data: { isActive: false },
          });
          await tx.product.updateMany({
            where: { shopId: shop.id, status: "ACTIVE" },
            data: { status: "HIDDEN" },
          });
        }),
      );
      return NextResponse.json({ ok: true, isActive: false, productsHidden: true });
    }

    if (body.action === "hide_products") {
      const result = await withDbRetry(() =>
        prisma.product.updateMany({
          where: { shopId: shop.id, status: "ACTIVE" },
          data: { status: "HIDDEN" },
        }),
      );
      return NextResponse.json({ ok: true, updated: result.count });
    }

    if (body.action === "activate_products") {
      const result = await withDbRetry(() =>
        prisma.product.updateMany({
          where: { shopId: shop.id, status: "HIDDEN" },
          data: { status: "ACTIVE" },
        }),
      );
      return NextResponse.json({ ok: true, updated: result.count });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Action impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
