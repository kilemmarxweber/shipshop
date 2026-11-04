import { listLiveCatalogProducts } from "@/lib/growth/live-catalog";
import { prisma, withDbRetry } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** Catalogue produits du live — host et viewers. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const live = await withDbRetry(() =>
    prisma.creatorLive.findUnique({
      where: { id },
      select: { userId: true, status: true },
    }),
  );
  if (!live) {
    return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
  }
  if (live.status === "ENDED") {
    return NextResponse.json({ error: "Live terminé" }, { status: 400 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const category = new URL(req.url).searchParams.get("category")?.trim() ?? "";
  const data = await listLiveCatalogProducts(live.userId, { q, category });
  return NextResponse.json(data);
}
