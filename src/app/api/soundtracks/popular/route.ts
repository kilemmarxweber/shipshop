import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";

/** Sons déjà publiés, classés par nombre de produits actifs. */
export async function GET() {
  const ranked = await withDbRetry(() =>
    prisma.product.groupBy({
      by: ["soundtrackId"],
      where: { status: "ACTIVE", soundtrackId: { not: null } },
      _count: { soundtrackId: true },
      orderBy: { _count: { soundtrackId: "desc" } },
      take: 12,
    }),
  );
  const ids = ranked
    .map((row) => row.soundtrackId)
    .filter((id): id is string => Boolean(id));
  if (!ids.length) return NextResponse.json({ tracks: [] });

  const found = await withDbRetry(() =>
    prisma.soundtrack.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        title: true,
        artist: true,
        durationMs: true,
        audioUrl: true,
      },
    }),
  );
  const byId = new Map(found.map((row) => [row.id, row]));
  const uses = new Map(
    ranked.map((row) => [row.soundtrackId, row._count.soundtrackId]),
  );
  const tracks = ids.flatMap((id) => {
    const track = byId.get(id);
    if (!track?.audioUrl) return [];
    return [{ ...track, uses: uses.get(id) ?? 0 }];
  });
  return NextResponse.json({ tracks });
}
