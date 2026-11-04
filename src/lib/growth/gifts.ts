import { hasActiveBadge } from "@/lib/growth/badges";
import {
    CREATOR_GIFT_SHARE_BPS,
    GIFT_CATALOG,
    type GiftKind,
} from "@/lib/growth/constants";
import { parseCurrency } from "@/lib/money";
import {
    beginIdempotentInTx,
    completeIdempotentInTx,
    findIdempotentOp,
    fingerprintPayload,
    isUniqueConflict,
} from "@/lib/payments/idempotent-op";
import { creditWalletLocked, debitWalletLocked } from "@/lib/payments/ledger";
import { prisma } from "@/lib/prisma";

export function giftByKind(kind: string) {
  return GIFT_CATALOG.find((g) => g.kind === kind) ?? null;
}

export async function sendCreatorGift(input: {
  fromUserId: string;
  toUserId: string;
  kind?: GiftKind | "CUSTOM";
  /** Montant libre (centimes) — prioritaire sur le catalogue. */
  amountCents?: number;
  liveId?: string | null;
  idempotencyKey: string;
}) {
  if (input.fromUserId === input.toUserId) {
    throw new Error("Impossible de s’offrir un cadeau");
  }
  const priorGift = await findIdempotentOp({
    userId: input.fromUserId,
    scope: "GIFT",
    key: input.idempotencyKey,
  });
  if (priorGift?.status === "COMPLETED" && priorGift.response) {
    return priorGift.response as {
      gift: { id: string; amountCents: number };
      chargedCents: number;
      creatorCents: number;
      replayed?: boolean;
    };
  }
  const influencer = await hasActiveBadge(input.toUserId, "INFLUENCER");
  const liveOpen = input.liveId
    ? await prisma.creatorLive.findFirst({
        where: {
          id: input.liveId,
          userId: input.toUserId,
          status: { in: ["LIVE", "PAUSED"] },
        },
        select: { id: true },
      })
    : null;
  if (!influencer && !liveOpen) {
    throw new Error("Ce compte n’est pas encore influenceur");
  }

  let kind: string;
  let amountCents: number;
  if (
    typeof input.amountCents === "number" &&
    Number.isFinite(input.amountCents)
  ) {
    amountCents = Math.round(input.amountCents);
    if (amountCents < 1) throw new Error("Indiquez un montant");
    const catalog = giftByKind(input.kind ?? "");
    kind =
      catalog && catalog.amountCents === amountCents ? catalog.kind : "CUSTOM";
  } else {
    const gift = giftByKind(input.kind ?? "");
    if (!gift) throw new Error("Cadeau inconnu");
    kind = gift.kind;
    amountCents = gift.amountCents;
  }

  const creatorShare = Math.round(
    (amountCents * CREATOR_GIFT_SHARE_BPS) / 10_000,
  );
  const currency = parseCurrency("USD");
  const requestHash = fingerprintPayload({
    toUserId: input.toUserId,
    kind,
    amountCents,
    liveId: input.liveId ?? null,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const began = await beginIdempotentInTx(tx, {
        userId: input.fromUserId,
        scope: "GIFT",
        key: input.idempotencyKey,
        requestHash,
      });
      if (began.replayed) return began.replay.response as never;

      const existing = await tx.creatorGift.findUnique({
        where: { clientIdempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        const payload = {
          gift: existing,
          chargedCents: existing.amountCents,
          creatorCents: Math.round(
            (existing.amountCents * CREATOR_GIFT_SHARE_BPS) / 10_000,
          ),
          replayed: true,
        };
        await completeIdempotentInTx(tx, {
          userId: input.fromUserId,
          scope: "GIFT",
          key: input.idempotencyKey,
          httpStatus: 200,
          response: payload,
        });
        return payload;
      }

      const debit = await debitWalletLocked(
        tx,
        input.fromUserId,
        currency,
        amountCents,
      );
      const credit = await creditWalletLocked(
        tx,
        input.toUserId,
        currency,
        creatorShare,
      );
      const row = await tx.creatorGift.create({
        data: {
          fromUserId: input.fromUserId,
          toUserId: input.toUserId,
          liveId: input.liveId ?? null,
          kind,
          amountCents,
          currency: "USD",
          clientIdempotencyKey: input.idempotencyKey,
        },
      });
      if (input.liveId) {
        await tx.creatorLive.update({
          where: { id: input.liveId },
          data: { giftCents: { increment: amountCents } },
        });
      }
      await tx.walletTransaction.create({
        data: {
          walletId: debit.wallet.id,
          type: "TRANSFER_OUT",
          amountCents,
          currency: "USD",
          provider: "INTERNAL",
          reference: `GIFT-${row.id}`,
          status: "SUCCESS",
          metadata: { kind, toUserId: input.toUserId },
        },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: credit.wallet.id,
          type: "TRANSFER_IN",
          amountCents: creatorShare,
          currency: "USD",
          provider: "INTERNAL",
          reference: `GIFT-IN-${row.id}`,
          status: "SUCCESS",
          metadata: { kind, fromUserId: input.fromUserId },
        },
      });
      const payload = {
        gift: row,
        chargedCents: amountCents,
        creatorCents: creatorShare,
        replayed: false,
      };
      await completeIdempotentInTx(tx, {
        userId: input.fromUserId,
        scope: "GIFT",
        key: input.idempotencyKey,
        httpStatus: 200,
        response: payload,
      });
      return payload;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      const again = await prisma.creatorGift.findUnique({
        where: { clientIdempotencyKey: input.idempotencyKey },
      });
      if (again && again.fromUserId === input.fromUserId) {
        return {
          gift: again,
          chargedCents: again.amountCents,
          creatorCents: Math.round(
            (again.amountCents * CREATOR_GIFT_SHARE_BPS) / 10_000,
          ),
          replayed: true,
        };
      }
    }
    throw error;
  }
}
