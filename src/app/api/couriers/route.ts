import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { haversineKm } from "@/lib/shipping";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const nearLat = searchParams.get("lat");
  const nearLng = searchParams.get("lng");

  const couriers = await withDbRetry(() =>
    prisma.courier.findMany({
      include: { zone: { select: { commune: true, kind: true } } },
      orderBy: { name: "asc" },
    }),
  );

  if (nearLat && nearLng) {
    const lat = Number(nearLat);
    const lng = Number(nearLng);
    const ranked = couriers
      .map((c) => ({
        ...c,
        distanceKm: Math.round(haversineKm(lat, lng, c.lat, c.lng) * 10) / 10,
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
    return NextResponse.json({ couriers: ranked });
  }

  return NextResponse.json({ couriers });
}
