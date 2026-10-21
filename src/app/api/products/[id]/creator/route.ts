import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { id } = await params;
  const product = await withDbRetry(() =>
    prisma.product.findUnique({
      where: { id },
      select: { id: true, creatorCommissionBps: true },
    }),
  );
  if (!product) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  if (product.creatorCommissionBps <= 0) {
    return NextResponse.json(
      { error: "Produit non ouvert aux créateurs" },
      { status: 400 },
    );
  }
  await withDbRetry(() =>
    prisma.productCreatorShare.upsert({
      where: {
        productId_userId: { productId: id, userId: session.user.id },
      },
      create: { productId: id, userId: session.user.id },
      update: {},
    }),
  );
  return NextResponse.json({ ok: true, via: session.user.id });
}
