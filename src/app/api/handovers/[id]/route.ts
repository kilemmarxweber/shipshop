import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { id } = await params;
  const handover = await withDbRetry(() =>
    prisma.shopHandover.findUnique({
      where: { id },
      include: {
        shop: { select: { id: true, name: true, slug: true } },
        orders: {
          include: {
            product: { select: { title: true, images: true, priceCents: true } },
            pickupReceipt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  );
  if (!handover) {
    return NextResponse.json({ error: "QR introuvable" }, { status: 404 });
  }
  if (handover.buyerId !== session.user.id) {
    const member = await withDbRetry(() =>
      prisma.member.findFirst({
        where: {
          userId: session.user.id,
          organization: { shops: { some: { id: handover.shopId } } },
        },
      }),
    );
    if (!member) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }
  return NextResponse.json({ handover });
}
