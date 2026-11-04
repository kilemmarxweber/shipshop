import { parseCurrency, shopFxRates, walletCents } from "@/lib/money";
import { isCinetPayConfigured } from "@/lib/payments/cinetpay";
import { sendCinetPayPayout } from "@/lib/payments/cinetpay-transfer";
import {
    beginIdempotentInTx,
    completeIdempotentInTx,
    findIdempotentOp,
    fingerprintPayload,
    isUniqueConflict,
    replayIfComplete,
} from "@/lib/payments/idempotent-op";
import { idempotencyFrom } from "@/lib/payments/ledger";
import {
    MIN_WITHDRAWAL_USD_CENTS,
    amountUsdCents,
    withdrawalFeeCents,
} from "@/lib/platform-fees";
import { creditTreasury } from "@/lib/platform-ledger";
import { revertUnsentWithdrawal } from "@/lib/payments/revert-withdrawal";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet, getSession } from "@/lib/session";
import { applyBucketDelta, getBucketCents } from "@/lib/wallet-buckets";
import { NextResponse, after } from "next/server";
import { z } from "zod";

const schema = z.object({
  bucket: z.enum(["BUYER", "VENDOR", "COURIER"]),
  amountCents: z.number().int().positive(),
  currency: z.enum(["USD", "CDF", "KW"]).optional(),
  provider: z.enum(["MPESA", "ORANGE", "AIRTEL"]),
  phone: z.string().min(8).max(40),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let key = "";
  try {
    const body = schema.parse(await req.json());
    key = idempotencyFrom(req, body.idempotencyKey);
    const currency = parseCurrency(body.currency);
    const requestHash = fingerprintPayload({
      bucket: body.bucket,
      amountCents: body.amountCents,
      currency,
      provider: body.provider,
      phone: body.phone.trim(),
    });

    const prior = replayIfComplete(
      await findIdempotentOp({
        userId: session.user.id,
        scope: "WITHDRAW",
        key,
      }),
      requestHash,
    );
    if (prior) {
      return NextResponse.json(prior.response, { status: prior.httpStatus });
    }

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

    const fee = withdrawalFeeCents(body.amountCents, body.bucket);
    const net = body.amountCents - fee;
    const livePayout = isCinetPayConfigured();

    const result = await prisma.$transaction(async (tx) => {
      const began = await beginIdempotentInTx(tx, {
        userId: session.user.id,
        scope: "WITHDRAW",
        key,
        requestHash,
      });
      if (began.replayed) return { replay: began.replay };

      const existingWd = await tx.withdrawal.findUnique({
        where: { clientIdempotencyKey: key },
      });
      if (existingWd) {
        if (existingWd.userId !== session.user.id) {
          throw new Error("Clé d’idempotence déjà utilisée");
        }
        const payload = { withdrawal: existingWd, replayed: true };
        await completeIdempotentInTx(tx, {
          userId: session.user.id,
          scope: "WITHDRAW",
          key,
          httpStatus: 200,
          response: payload,
        });
        return { payload };
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { updatedAt: new Date() },
        select: { id: true },
      });
      const locked = await tx.wallet.findUnique({ where: { id: wallet.id } });
      if (!locked) throw new Error("Portefeuille introuvable");
      if (getBucketCents(locked, body.bucket, currency) < body.amountCents) {
        throw new Error("Solde de ce pot insuffisant");
      }
      await tx.wallet.update({
        where: { id: locked.id },
        data: applyBucketDelta(
          locked,
          currency,
          -body.amountCents,
          body.bucket,
        ),
      });
      const withdrawal = await tx.withdrawal.create({
        data: {
          userId: session.user.id,
          bucket: body.bucket,
          currency,
          grossCents: body.amountCents,
          feeCents: fee,
          netCents: net,
          status: livePayout ? "PENDING" : "PAID",
          provider: body.provider,
          phone: body.phone.trim(),
          paidAt: livePayout ? null : new Date(),
          clientIdempotencyKey: key,
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
          phone: body.phone.trim(),
          status: "SUCCESS",
          reference: `WD-${withdrawal.id.slice(0, 8)}`,
          metadata: {
            bucket: body.bucket,
            fee,
            net,
            phone: body.phone.trim(),
            withdrawalId: withdrawal.id,
            idempotencyKey: key,
            rail: livePayout ? "CINETPAY" : "SIMULATED",
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
      const payload = { withdrawal, replayed: false };
      await completeIdempotentInTx(tx, {
        userId: session.user.id,
        scope: "WITHDRAW",
        key,
        httpStatus: 200,
        response: payload,
      });
      return { payload };
    });

    if ("replay" in result && result.replay) {
      return NextResponse.json(result.replay.response, {
        status: result.replay.httpStatus,
      });
    }
    const payload = result.payload;
    if (
      livePayout &&
      payload &&
      "withdrawal" in payload &&
      payload.withdrawal
    ) {
      const withdrawal = payload.withdrawal;
      after(() => {
        void (async () => {
          try {
            const user = await prisma.user.findUnique({
              where: { id: session.user.id },
              select: { name: true, email: true },
            });
            await sendCinetPayPayout({
              withdrawalId: withdrawal.id,
              amountCents: net,
              currency,
              phone: body.phone.trim(),
              provider: body.provider,
              customerName: user?.name ?? "Client",
            });
          } catch (error) {
            console.error("[cinetpay-payout]", withdrawal.id, error);
            try {
              await revertUnsentWithdrawal(withdrawal.id);
            } catch (revertError) {
              console.error("[cinetpay-payout-revert]", withdrawal.id, revertError);
            }
          }
        })();
      });
    }
    return NextResponse.json(payload);
  } catch (error) {
    if (isUniqueConflict(error) && key) {
      const row = await findIdempotentOp({
        userId: session.user.id,
        scope: "WITHDRAW",
        key,
      });
      if (row?.status === "COMPLETED" && row.response) {
        return NextResponse.json(row.response, {
          status: row.httpStatus || 200,
        });
      }
      return NextResponse.json(
        { error: "Un retrait est déjà en cours sur ce pot" },
        { status: 409 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Retrait impossible";
    const status = message.includes("déjà en cours") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
