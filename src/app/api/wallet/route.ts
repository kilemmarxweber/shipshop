import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet, getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const wallet = await getOrCreateWallet(session.user.id);
  const [transactions, contacts, user] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.userMoneyContact.findMany({
      where: { userId: session.user.id },
      select: { provider: true, phone: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true },
    }),
  ]);

  return NextResponse.json({
    wallet,
    transactions,
    contacts,
    accountPhone: user?.phone ?? null,
  });
}
