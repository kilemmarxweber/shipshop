import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { assertCanManageShop } from "@/lib/shop-access";
import { lockWallet } from "@/lib/payments/ledger";
import { applyBucketDelta } from "@/lib/wallet-buckets";
import { parseCurrency, walletCents } from "@/lib/money";

const PRO_USD_CENTS = 1000;
const PRO_DAYS = 30;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { slug } = await params;
  const shop = await withDbRetry(() =>
    prisma.shop.findFirst({ where: { slug } }),
  );
  if (!shop) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  const access = await assertCanManageShop(session.user.id, shop.id);
  if (!access.ok) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const sellerId = shop.ownerUserId;
  if (!sellerId) {
    return NextResponse.json({ error: "Boutique sans vendeur" }, { status: 400 });
  }
  const currency = parseCurrency(shop.currency);
  const base = shop.proUntil && shop.proUntil > new Date() ? shop.proUntil : new Date();
  const proUntil = new Date(base.getTime() + PRO_DAYS * 86_400_000);

  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId: sellerId },
      create: { userId: sellerId, balanceCents: 0, currency: "USD" },
      update: {},
    });
    await lockWallet(tx, wallet.id);
    const locked = await tx.wallet.findUnique({ where: { id: wallet.id } });
    if (!locked) throw new Error("Portefeuille introuvable");
    if (walletCents(locked, currency) < PRO_USD_CENTS) {
      throw new Error("Solde insuffisant pour ShipPro");
    }
    const next = walletCents(locked, currency) - PRO_USD_CENTS;
    await tx.wallet.update({
      where: { id: locked.id },
      data: applyBucketDelta(locked, currency, -PRO_USD_CENTS, "VENDOR"),
    });
    await tx.walletTransaction.create({
      data: {
        walletId: locked.id,
        type: "PLATFORM_FEE",
        amountCents: -PRO_USD_CENTS,
        currency,
        balanceAfterCents: next,
        provider: "INTERNAL",
        status: "SUCCESS",
        reference: `PRO-${shop.id.slice(0, 8)}`,
        metadata: { shopId: shop.id, days: PRO_DAYS },
      },
    });
    await tx.shop.update({ where: { id: shop.id }, data: { proUntil } });
  });

  return NextResponse.json({ proUntil });
}
