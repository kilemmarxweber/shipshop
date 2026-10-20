import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canManageShopDelivery,
  listManagedShops,
  requirePlatformDeliveryAdmin,
} from "@/lib/delivery-access";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(6).max(40),
  address: z.string().min(3).max(240),
  lat: z.number(),
  lng: z.number(),
  zoneId: z.string().optional().nullable(),
  shopId: z.string().optional().nullable(),
  isAvailable: z.boolean().optional(),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  postnom: z.string().max(80).optional(),
  email: z.string().email().optional().nullable(),
  companyId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  passportPhotoUrl: z.string().max(500).optional().nullable(),
  idFrontUrl: z.string().max(500).optional().nullable(),
  idBackUrl: z.string().max(500).optional().nullable(),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const shopId = searchParams.get("shopId");
  const platform = await requirePlatformDeliveryAdmin(session.user.id);

  if (platform.ok && !shopId) {
    const couriers = await withDbRetry(() =>
      prisma.courier.findMany({
        include: {
          zone: { select: { id: true, commune: true, kind: true } },
          shop: { select: { id: true, name: true, slug: true } },
          company: { select: { id: true, legalName: true } },
        },
        orderBy: { name: "asc" },
      }),
    );
    return NextResponse.json({ couriers, scope: "platform" });
  }

  const shops = await listManagedShops(session.user.id);
  if (shops.length === 0) {
    return NextResponse.json({ error: "Aucune boutique" }, { status: 403 });
  }

  const shopIds = shopId
    ? shops.some((s) => s.id === shopId)
      ? [shopId]
      : []
    : shops.map((s) => s.id);

  if (shopId && shopIds.length === 0) {
    return NextResponse.json({ error: "Boutique non autorisée" }, { status: 403 });
  }

  const couriers = await withDbRetry(() =>
    prisma.courier.findMany({
      where: shopId
        ? { shopId }
        : platform.ok
          ? {}
          : { shopId: { in: shopIds } },
      include: {
        zone: { select: { id: true, commune: true, kind: true } },
        shop: { select: { id: true, name: true, slug: true } },
        company: { select: { id: true, legalName: true } },
      },
      orderBy: { name: "asc" },
    }),
  );

  return NextResponse.json({
    couriers,
    shops,
    scope: platform.ok ? "platform" : "shop",
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = createSchema.parse(await req.json());
    const platform = await requirePlatformDeliveryAdmin(session.user.id);
    if (!platform.ok) {
      return NextResponse.json(
        { error: "Seul le owner ChipShop enregistre un livreur" },
        { status: 403 },
      );
    }

    let shopId = body.shopId ?? null;
    if (shopId) {
      const access = await canManageShopDelivery(session.user.id, shopId);
      if (!access.ok) {
        return NextResponse.json(
          { error: access.error },
          { status: access.status },
        );
      }
    } else if (!platform.ok) {
      const shops = await listManagedShops(session.user.id);
      if (shops.length === 0) {
        return NextResponse.json({ error: "Boutique requise" }, { status: 400 });
      }
      shopId = shops[0]!.id;
    }

    const courier = await withDbRetry(() =>
      prisma.courier.create({
        data: {
          name: body.name.trim(),
          firstName: body.firstName?.trim() || null,
          lastName: body.lastName?.trim() || null,
          postnom: body.postnom?.trim() || null,
          phone: body.phone.trim(),
          email: body.email?.trim() || null,
          address: body.address.trim(),
          lat: body.lat,
          lng: body.lng,
          zoneId: body.zoneId ?? null,
          shopId,
          companyId: body.companyId ?? null,
          userId: body.userId ?? null,
          passportPhotoUrl: body.passportPhotoUrl ?? null,
          idFrontUrl: body.idFrontUrl ?? null,
          idBackUrl: body.idBackUrl ?? null,
          isAvailable: body.isAvailable ?? true,
        },
        include: {
          zone: { select: { id: true, commune: true, kind: true } },
          shop: { select: { id: true, name: true, slug: true } },
          company: { select: { id: true, legalName: true } },
        },
      }),
    );
    return NextResponse.json({ courier }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Création livreur impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
