import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet, getSession } from "@/lib/session";
import {
  MIN_WITHDRAWAL_USD_CENTS,
  amountUsdCents,
  withdrawalFeeCents,
} from "@/lib/platform-fees";
import { creditTreasury } from "@/lib/platform-ledger";
import { applyBucketDelta, getBucketCents } from "@/lib/wallet-buckets";
import { parseCurrency, shopFxRates, walletCents } from "@/lib/money";

const schema = z.object({
  bucket: z.enum(["BUYER", "VENDOR", "COURIER"]),
  amountCents: z.number().int().positive(),
  currency: z.enum(["USD", "CDF", "KW"]).optional(),
  provider: z.enum(["MPESA", "ORANGE", "AIRTEL"]),
  phone: z.string().min(8).max(40),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());
    const currency = parseCurrency(body.currency);
    const wallet = await getOrCreateWallet(session.user.id);
    const available = getBucketCents(wallet, body.bucket, currency);
    if (body.amountCents > available) {
      return NextResponse.json(
        { error: "Solde de ce pot insuffisant" },
        { status: 400 },
      );
    }
    const usd = amountUsdCents(body.amountCents, currency, shopFxRates());
    if (usd < MIN_WITHDRAWAL_USD_CENTS) {
      return NextResponse.json(
        { error: "Minimum 1 $US par retrait" },
        { status: 400 },
      );
    }

    const pending = await prisma.withdrawal.findFirst({
      where: {
        userId: session.user.id,
        bucket: body.bucket,
        status: "PENDING",
      },
    });
    if (pending) {
      return NextResponse.json(
        { error: "Un retrait est déjà en cours sur ce pot" },
        { status: 409 },
      );
    }

    const fee = withdrawalFeeCents(body.amountCents, body.bucket);
    const net = body.amountCents - fee;

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "wallet" WHERE id = ${wallet.id} FOR UPDATE`;
      const locked = await tx.wallet.findUnique({ where: { id: wallet.id } });
      if (!locked) throw new Error("Portefeuille introuvable");
      if (getBucketCents(locked, body.bucket, currency) < body.amountCents) {
        throw new Error("Solde de ce pot insuffisant");
      }
      await tx.wallet.update({
        where: { id: locked.id },
        data: applyBucketDelta(locked, currency, -body.amountCents, body.bucket),
      });
      const withdrawal = await tx.withdrawal.create({
        data: {
          userId: session.user.id,
          bucket: body.bucket,
          currency,
          grossCents: body.amountCents,
          feeCents: fee,
          netCents: net,
          status: "PAID",
          provider: body.provider,
          phone: body.phone.trim(),
          paidAt: new Date(),
        },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: locked.id,
          type: "WITHDRAWAL",
          amountCents: -body.amountCents,
          currency,
          balanceAfterCents: walletCents(locked, currency) - body.amountCents,
          provider: body.provider,
          status: "SUCCESS",
          reference: `WD-${withdrawal.id.slice(0, 8)}`,
          metadata: {
            bucket: body.bucket,
            fee,
            net,
            withdrawalId: withdrawal.id,
          },
        },
      });
      if (fee > 0) {
        await creditTreasury(tx, {
          amountCents: fee,
          currency,
          kind: "WITHDRAWAL",
          withdrawalId: withdrawal.id,
          actorUserId: session.user.id,
        });
      }
      return withdrawal;
    });

    return NextResponse.json({ withdrawal: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Retrait impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
