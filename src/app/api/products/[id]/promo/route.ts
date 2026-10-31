import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { assertCanManageShop } from "@/lib/shop-access";
import {
  activateProductPromo,
  endProductPromo,
} from "@/lib/shiprewards/grant";
import { clampPercent, promoTierForPercent } from "@/lib/shiprewards/tiers";

const createSchema = z.object({
  percent: z.number().int().min(1).max(90),
  mode: z.enum(["period", "permanent"]),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional().nullable(),
  clientIdempotencyKey: z.string().min(8).max(80).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const product = await withDbRetry(() =>
    prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        priceCents: true,
        compareAtCents: true,
        promoPercent: true,
        promoTier: true,
        activePromoId: true,
      },
    }),
  );
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }
  return NextResponse.json({
    promo: product.activePromoId
      ? {
          percent: product.promoPercent,
          tier: product.promoTier,
          compareAtCents: product.compareAtCents,
          priceCents: product.priceCents,
        }
      : null,
    previewTier: promoTierForPercent(product.promoPercent ?? 0),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = createSchema.parse(await req.json());
    const product = await withDbRetry(() =>
      prisma.product.findUnique({ where: { id } }),
    );
    if (!product) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }
    const access = await assertCanManageShop(session.user.id, product.shopId);
    if (!access.ok) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const startsAt = body.startsAt ? new Date(body.startsAt) : new Date();
    const endsAt =
      body.mode === "permanent"
        ? null
        : body.endsAt
          ? new Date(body.endsAt)
          : new Date(startsAt.getTime() + 24 * 3_600_000);
    const result = await withDbRetry(() =>
      prisma.$transaction((tx) =>
        activateProductPromo(tx, {
          shopId: product.shopId,
          productId: product.id,
          percent: clampPercent(body.percent),
          startsAt,
          endsAt,
          clientIdempotencyKey: body.clientIdempotencyKey,
          ownerUserId: access.shop.ownerUserId,
        }),
      ),
    );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Promo impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const product = await withDbRetry(() =>
      prisma.product.findUnique({ where: { id } }),
    );
    if (!product) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }
    const access = await assertCanManageShop(session.user.id, product.shopId);
    if (!access.ok) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    await withDbRetry(() =>
      prisma.$transaction((tx) => endProductPromo(tx, product.id, true)),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Arrêt impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
