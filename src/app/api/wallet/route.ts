import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceApiSecurity } from "@/lib/security";
import { getOrCreateWallet, getSession } from "@/lib/session";
import { expireStaleMovements, flushNotifyOutbox } from "@/lib/payments/ledger";
import { getBucketCents } from "@/lib/wallet-buckets";
import { APP_CURRENCIES, parseCurrency } from "@/lib/money";
import {
  getPlatformFeeSettings,
  MIN_CASH_MOVE_CENTS,
  publicFeeSettings,
} from "@/lib/platform-fees";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const blocked = await enforceApiSecurity({
    request: req,
    bucket: "wallet",
    session,
    failClosed: true,
  });
  if (blocked) return blocked;

  await expireStaleMovements();
  void flushNotifyOutbox();

  const wallet = await getOrCreateWallet(session.user.id);
  const [transactions, withdrawals, contacts, user] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.withdrawal.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, phone: true },
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

  const pots = Object.fromEntries(
    APP_CURRENCIES.map((code) => [
      code,
      {
        BUYER: getBucketCents(wallet, "BUYER", code),
        VENDOR: getBucketCents(wallet, "VENDOR", code),
        COURIER: getBucketCents(wallet, "COURIER", code),
      },
    ]),
  );

  const feeSettings = await getPlatformFeeSettings();

  return NextResponse.json({
    wallet,
    pots,
    displayCurrency: parseCurrency(wallet.currency),
    transactions: transactions.map((row) => {
      if (row.type !== "WITHDRAWAL" || row.phone) return row;
      const meta =
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as { withdrawalId?: string })
          : null;
      const prefix = row.reference?.startsWith("WD-")
        ? row.reference.slice(3)
        : "";
      const match = withdrawals.find(
        (item) =>
          item.id === meta?.withdrawalId ||
          (prefix.length >= 8 && item.id.startsWith(prefix)),
      );
      return match?.phone ? { ...row, phone: match.phone } : row;
    }),
    contacts,
    accountPhone: user?.phone ?? null,
    /** No daily ceiling. Floor is 5.00 of the chosen currency, without FX. */
    dailyCaps: null,
    cashLimits: {
      minDepositCents: MIN_CASH_MOVE_CENTS,
      minWithdrawCents: MIN_CASH_MOVE_CENTS,
    },
    fees: publicFeeSettings(feeSettings),
  });
}
