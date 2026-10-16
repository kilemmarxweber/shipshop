import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { id } = await params;
  const product = await withDbRetry(() =>
    prisma.product.findUnique({
      where: { id },
      select: { id: true },
    }),
  );
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  await withDbRetry(() =>
    prisma.productShare.upsert({
      where: {
        userId_productId: { userId: session.user.id, productId: id },
      },
      create: { userId: session.user.id, productId: id },
      update: {},
    }),
  );

  return NextResponse.json({ ok: true });
}
