import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { reopenUnpaidWantedMatches } from "@/lib/wanted-timeout";
import { NextResponse } from "next/server";

function parseSince(raw: string | null) {
  if (!raw) return new Date(0);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const since = parseSince(new URL(req.url).searchParams.get("since"));
  if (!since) {
    return NextResponse.json({ error: "since invalide" }, { status: 400 });
  }

  try {
    await reopenUnpaidWantedMatches();
    const rows = await withDbRetry(() =>
      prisma.wantedOffer.groupBy({
        by: ["requestId"],
        where: {
          updatedAt: { gt: since },
          request: { buyerId: session.user.id },
        },
        _max: { updatedAt: true },
        _count: { id: true },
      }),
    );

    const now = new Date().toISOString();
    return NextResponse.json({
      now,
      changes: rows
        .map((row) => ({
          requestId: row.requestId,
          updatedAt: row._max.updatedAt?.toISOString() ?? now,
          changedOfferCount: row._count.id,
        }))
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
        .slice(0, 40),
    });
  } catch (error) {
    console.error("[wanted changes GET]", error);
    return NextResponse.json(
      { error: "Changements indisponibles" },
      { status: 500 },
    );
  }
}
