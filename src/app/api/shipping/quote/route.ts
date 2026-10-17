import { NextResponse } from "next/server";
import { z } from "zod";
import { findBestCourier } from "@/lib/courier-match";
import { prisma, withDbRetry } from "@/lib/prisma";
import { quoteShipping } from "@/lib/shipping";

const schema = z.object({
  shopId: z.string().min(1),
  city: z.string().min(1).optional().nullable(),
  commune: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  busStopName: z.string().max(120).optional().nullable(),
});

export async function GET() {
  const zones = await withDbRetry(() =>
    prisma.deliveryZone.findMany({
      where: { isActive: true },
      orderBy: [{ kind: "asc" }, { commune: "asc" }],
    }),
  );
  return NextResponse.json({ zones });
}

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const quote = await quoteShipping(body);

    let courier: {
      id: string;
      name: string;
      phone: string;
      address: string | null;
      lat: number;
      lng: number;
      distanceKm: number;
      etaMinutes: number;
      etaText: string;
    } | null = null;

    if (
      typeof quote.destLat === "number" &&
      typeof quote.destLng === "number" &&
      Number.isFinite(quote.destLat) &&
      Number.isFinite(quote.destLng)
    ) {
      const best = await findBestCourier({
        destLat: quote.destLat,
        destLng: quote.destLng,
        commune: quote.commune ?? body.commune,
        remoteZone: quote.kind === "REMOTE",
        shopId: body.shopId,
        zoneId: quote.zoneId,
      });
      if (best) {
        courier = {
          id: best.courier.id,
          name: best.courier.name,
          phone: best.courier.phone,
          address: best.courier.address,
          lat: best.courier.lat,
          lng: best.courier.lng,
          distanceKm: best.eta.distanceKm,
          etaMinutes: best.eta.etaMinutes,
          etaText: best.eta.etaText,
        };
      }
    }

    return NextResponse.json({ quote, courier });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Devis transport impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
