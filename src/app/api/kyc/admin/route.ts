import { NextResponse } from "next/server";
import { assertChipShopOwner, kycPublic } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json(
      { error: "Réservé à l'owner ou à un admin Chip Shop" },
      { status: 403 },
    );
  }

  const rows = await withDbRetry(() =>
    prisma.sellerKyc.findMany({
      where: { status: "PENDING" },
      orderBy: { submittedAt: "asc" },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true, phone: true },
        },
      },
    }),
  );

  return NextResponse.json({
    dossiers: rows.map((row) => ({
      ...kycPublic(row),
      user: row.user,
    })),
  });
}
