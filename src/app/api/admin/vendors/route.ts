import { NextResponse } from "next/server";
import { z } from "zod";
import { assertChipShopOwner, kycPublic } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * Liste plateforme :
 * - vendors = boutiques (+ proprio)
 * - clients = members sans aucune boutique (pas vendeurs)
 */
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
    const [shops, members] = await Promise.all([
      withDbRetry(() =>
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
              select: {
                id: true,
                title: true,
                description: true,
                status: true,
                priceCents: true,
                quantity: true,
                category: true,
                images: true,
                location: true,
                _count: { select: { orders: true } },
              },
              orderBy: { updatedAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
      ),
      withDbRetry(() =>
        prisma.member.findMany({
          where: { organizationId: org.id },
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
                createdAt: true,
                disabledAt: true,
                disabledReason: true,
                sellerKyc: true,
                wallet: { select: { balanceCents: true } },
                _count: { select: { orders: true } },
              },
            },
          },
        }),
      ),
    ]);

    const sellerUserIds = new Set(
      shops
        .map((s) => s.ownerUserId)
        .filter((id): id is string => Boolean(id)),
    );

    const vendors = shops.map((shop) => {
      const byStatus: Record<string, number> = {};
      for (const p of shop.products) {
        byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
      }
      const { products, _count, owner, ...rest } = shop;
      return {
        ...rest,
        productsCount: _count.products,
        ordersCount: _count.orders,
        productsByStatus: byStatus,
        products: products.map(({ _count: pc, ...p }) => ({
          ...p,
          ordersCount: pc.orders,
          canDelete: pc.orders === 0,
        })),
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

    const clients = members
      .filter((m) => !sellerUserIds.has(m.userId))
      .map((m) => ({
        id: m.user.id,
        memberId: m.id,
        role: m.role,
        name: m.user.name,
        email: m.user.email,
        phone: m.user.phone,
        image: m.user.image,
        createdAt: m.user.createdAt,
        disabledAt: m.user.disabledAt,
        disabledReason: m.user.disabledReason,
        ordersCount: m.user._count.orders,
        walletBalanceCents: m.user.wallet?.balanceCents ?? 0,
        canDelete: m.user._count.orders === 0,
        kyc: m.user.sellerKyc ? kycPublic(m.user.sellerKyc) : null,
      }));

    return NextResponse.json({
      vendors,
      clients,
      counts: {
        vendors: vendors.length,
        clients: clients.length,
      },
    });
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
  /** 1 à N produits ciblés (obligatoire pour hide/activate_products) */
  productIds: z.array(z.string().min(1)).min(1).max(200).optional(),
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
      return NextResponse.json({
        ok: true,
        isActive: false,
        productsHidden: true,
      });
    }

    if (body.action === "hide_products" || body.action === "activate_products") {
      const ids = body.productIds ?? [];
      if (ids.length === 0) {
        return NextResponse.json(
          { error: "Sélectionnez au moins un produit" },
          { status: 400 },
        );
      }

      // Archiver : ACTIVE → HIDDEN. Republier : les ids choisis → ACTIVE
      // (tous les produits de la boutique peuvent être sélectionnés).
      const result = await withDbRetry(() =>
        prisma.product.updateMany({
          where: {
            shopId: shop.id,
            id: { in: ids },
            ...(body.action === "hide_products"
              ? { status: "ACTIVE" as const }
              : {}),
          },
          data: {
            status:
              body.action === "hide_products" ? "HIDDEN" : "ACTIVE",
          },
        }),
      );
      return NextResponse.json({
        ok: true,
        updated: result.count,
        requested: ids.length,
      });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Action impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
