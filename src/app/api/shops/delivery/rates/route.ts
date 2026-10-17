import { NextResponse } from "next/server";
import { z } from "zod";
import { DeliveryPricingMode } from "@/generated/prisma/client";
import {
  canManageShopDelivery,
  listManagedShops,
} from "@/lib/delivery-access";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const rateSchema = z.object({
  zoneId: z.string().nullable(),
  pricingMode: z.nativeEnum(DeliveryPricingMode),
  baseCents: z.number().int().min(0),
  ratePerKmCents: z.number().int().min(0),
  flatCents: z.number().int().min(0).optional().nullable(),
});

const putSchema = z.object({
  shopId: z.string().min(1),
  rates: z.array(rateSchema),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  let shopId = searchParams.get("shopId");
  const shops = await listManagedShops(session.user.id);
  if (shops.length === 0) {
    return NextResponse.json({ error: "Aucune boutique" }, { status: 403 });
  }
  if (!shopId) shopId = shops[0]!.id;

  const access = await canManageShopDelivery(session.user.id, shopId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const [rates, zones] = await Promise.all([
    withDbRetry(() =>
      prisma.shopDeliveryRate.findMany({
        where: { shopId },
        include: { zone: { select: { id: true, commune: true, name: true } } },
        orderBy: { updatedAt: "desc" },
      }),
    ),
    withDbRetry(() =>
      prisma.deliveryZone.findMany({
        where: { isActive: true },
        orderBy: [{ kind: "asc" }, { commune: "asc" }],
        select: {
          id: true,
          name: true,
          commune: true,
          kind: true,
          pricingMode: true,
          baseCents: true,
          ratePerKmCents: true,
          flatCents: true,
        },
      }),
    ),
  ]);

  return NextResponse.json({ rates, zones, shops, shopId });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = putSchema.parse(await req.json());
    const access = await canManageShopDelivery(session.user.id, body.shopId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    await withDbRetry(async () => {
      await prisma.shopDeliveryRate.deleteMany({
        where: { shopId: body.shopId },
      });
      if (body.rates.length > 0) {
        await prisma.shopDeliveryRate.createMany({
          data: body.rates.map((r) => ({
            shopId: body.shopId,
            zoneId: r.zoneId,
            pricingMode: r.pricingMode,
            baseCents: r.baseCents,
            ratePerKmCents: r.ratePerKmCents,
            flatCents: r.flatCents ?? null,
          })),
        });
      }
    });

    const rates = await withDbRetry(() =>
      prisma.shopDeliveryRate.findMany({
        where: { shopId: body.shopId },
        include: { zone: { select: { id: true, commune: true, name: true } } },
      }),
    );
    return NextResponse.json({ rates });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Enregistrement impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
