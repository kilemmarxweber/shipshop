import { NextResponse } from "next/server";
import { z } from "zod";
import { DeliveryPricingMode, ZoneKind } from "@/generated/prisma/client";
import { requirePlatformDeliveryAdmin } from "@/lib/delivery-access";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const busStopSchema = z.object({
  name: z.string().min(1).max(120),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  cents: z.number().int().min(0),
});

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  commune: z.string().min(1).max(120).optional(),
  kind: z.nativeEnum(ZoneKind).optional(),
  pricingMode: z.nativeEnum(DeliveryPricingMode).optional(),
  baseCents: z.number().int().min(0).optional(),
  ratePerKmCents: z.number().int().min(0).optional(),
  flatCents: z.number().int().min(0).optional().nullable(),
  busStops: z.array(busStopSchema).optional().nullable(),
  centerLat: z.number().optional(),
  centerLng: z.number().optional(),
  quartiers: z.array(z.string()).optional(),
  avenues: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const access = await requirePlatformDeliveryAdmin(session.user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await ctx.params;
  try {
    const body = patchSchema.parse(await req.json());
    const zone = await withDbRetry(() =>
      prisma.deliveryZone.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.commune !== undefined
            ? { commune: body.commune.trim() }
            : {}),
          ...(body.kind !== undefined ? { kind: body.kind } : {}),
          ...(body.pricingMode !== undefined
            ? { pricingMode: body.pricingMode }
            : {}),
          ...(body.baseCents !== undefined ? { baseCents: body.baseCents } : {}),
          ...(body.ratePerKmCents !== undefined
            ? { ratePerKmCents: body.ratePerKmCents }
            : {}),
          ...(body.flatCents !== undefined ? { flatCents: body.flatCents } : {}),
          ...(body.busStops !== undefined
            ? { busStops: body.busStops ?? undefined }
            : {}),
          ...(body.centerLat !== undefined ? { centerLat: body.centerLat } : {}),
          ...(body.centerLng !== undefined ? { centerLng: body.centerLng } : {}),
          ...(body.quartiers !== undefined ? { quartiers: body.quartiers } : {}),
          ...(body.avenues !== undefined ? { avenues: body.avenues } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      }),
    );
    return NextResponse.json({ zone });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mise à jour impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const access = await requirePlatformDeliveryAdmin(session.user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await ctx.params;
  try {
    // Soft-delete : désactive plutôt que supprimer (commandes liées)
    const zone = await withDbRetry(() =>
      prisma.deliveryZone.update({
        where: { id },
        data: { isActive: false },
      }),
    );
    return NextResponse.json({ zone });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Suppression impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
