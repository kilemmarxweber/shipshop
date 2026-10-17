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

const createSchema = z.object({
  name: z.string().min(1).max(120),
  commune: z.string().min(1).max(120),
  kind: z.nativeEnum(ZoneKind),
  pricingMode: z.nativeEnum(DeliveryPricingMode).default("PER_KM"),
  baseCents: z.number().int().min(0),
  ratePerKmCents: z.number().int().min(0),
  flatCents: z.number().int().min(0).optional().nullable(),
  busStops: z.array(busStopSchema).optional().nullable(),
  centerLat: z.number(),
  centerLng: z.number(),
  quartiers: z.array(z.string()).optional(),
  avenues: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const access = await requirePlatformDeliveryAdmin(session.user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const zones = await withDbRetry(() =>
    prisma.deliveryZone.findMany({
      orderBy: [{ kind: "asc" }, { commune: "asc" }],
      include: { _count: { select: { couriers: true, orders: true } } },
    }),
  );
  return NextResponse.json({ zones });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const access = await requirePlatformDeliveryAdmin(session.user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = createSchema.parse(await req.json());
    const zone = await withDbRetry(() =>
      prisma.deliveryZone.create({
        data: {
          name: body.name,
          commune: body.commune.trim(),
          kind: body.kind,
          pricingMode: body.pricingMode,
          baseCents: body.baseCents,
          ratePerKmCents: body.ratePerKmCents,
          flatCents: body.flatCents ?? null,
          busStops: body.busStops ?? undefined,
          centerLat: body.centerLat,
          centerLng: body.centerLng,
          quartiers: body.quartiers ?? [],
          avenues: body.avenues ?? [],
          isActive: body.isActive ?? true,
        },
      }),
    );
    return NextResponse.json({ zone }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Création zone impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
