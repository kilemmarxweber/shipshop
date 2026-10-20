import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getOrCreateWallet, getSession } from "@/lib/session";
import { getBucketCents } from "@/lib/wallet-buckets";
import { parseCurrency } from "@/lib/money";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const courier = await withDbRetry(() =>
    prisma.courier.findUnique({
      where: { userId: session.user.id },
      include: { company: true },
    }),
  );
  if (!courier || courier.archivedAt) {
    return NextResponse.json({ error: "Compte livreur introuvable" }, { status: 404 });
  }

  const wallet = await getOrCreateWallet(session.user.id);
  const jobs = await withDbRetry(() =>
    prisma.order.findMany({
      where: {
        courierId: courier.id,
        status: { in: ["ASSIGNED", "FULFILLING", "OUT_FOR_DELIVERY", "AWAITING_CONFIRM"] },
      },
      include: {
        product: { select: { title: true, images: true, currency: true } },
        shop: { select: { name: true, slug: true } },
        buyer: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  );

  const payouts = await withDbRetry(() =>
    prisma.walletTransaction.findMany({
      where: { walletId: wallet.id, type: "COURIER_PAYOUT" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  );

  const currency = parseCurrency(wallet.currency);
  return NextResponse.json({
    courier,
    jobs,
    payouts,
    wallet: {
      currency,
      courierCents: getBucketCents(wallet, "COURIER", currency),
      buyerCents: getBucketCents(wallet, "BUYER", currency),
      vendorCents: getBucketCents(wallet, "VENDOR", currency),
    },
  });
}
