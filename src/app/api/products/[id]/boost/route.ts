import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCanManageShop } from "@/lib/shop-access";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { boostPack } from "@/lib/shop-boost";
import { lockWallet } from "@/lib/payments/ledger";
import { applyBucketDelta } from "@/lib/wallet-buckets";
import { parseCurrency, walletCents } from "@/lib/money";

const schema = z.object({ days: z.union([z.literal(1), z.literal(3), z.literal(7)]) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { id } = await params;
  const body = schema.parse(await req.json());
  const pack = boostPack(body.days);
  if (!pack) {
    return NextResponse.json({ error: "Pack invalide" }, { status: 400 });
  }

  const product = await withDbRetry(() =>
    prisma.product.findUnique({
      where: { id },
      select: { id: true, shopId: true, shop: { select: { ownerUserId: true, currency: true } } },
    }),
  );
  if (!product) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  const access = await assertCanManageShop(session.user.id, product.shopId);
  if (!access.ok) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const sellerId = product.shop.ownerUserId;
  if (!sellerId) {
    return NextResponse.json({ error: "Boutique sans vendeur" }, { status: 400 });
  }

  const currency = parseCurrency(product.shop.currency);
  const endsAt = new Date(Date.now() + pack.days * 86_400_000);

  const boost = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId: sellerId },
      create: { userId: sellerId, balanceCents: 0, currency: "USD" },
      update: {},
    });
    await lockWallet(tx, wallet.id);
    const locked = await tx.wallet.findUnique({ where: { id: wallet.id } });
    if (!locked) throw new Error("Portefeuille introuvable");
    if (walletCents(locked, currency) < pack.usdCents) {
      throw new Error("Solde vendeur insuffisant pour ShipBoost");
    }
    const next = walletCents(locked, currency) - pack.usdCents;
    await tx.wallet.update({
      where: { id: locked.id },
      data: applyBucketDelta(locked, currency, -pack.usdCents, "VENDOR"),
    });
    await tx.walletTransaction.create({
      data: {
        walletId: locked.id,
        type: "PLATFORM_FEE",
        amountCents: -pack.usdCents,
        currency,
        balanceAfterCents: next,
        provider: "INTERNAL",
        status: "SUCCESS",
        reference: `BOOST-${id.slice(0, 8)}`,
        metadata: { productId: id, days: pack.days },
      },
    });
    return tx.shopBoost.create({
      data: {
        shopId: product.shopId,
        productId: id,
        budgetCents: pack.usdCents,
        currency,
        days: pack.days,
        endsAt,
      },
    });
  });

  return NextResponse.json({ boost });
}
