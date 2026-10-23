import { prisma } from "@/lib/prisma";
import {
  creditWalletLocked,
  debitWalletLocked,
} from "@/lib/payments/ledger";
import { parseCurrency } from "@/lib/money";
import {
  CREATOR_GIFT_SHARE_BPS,
  GIFT_CATALOG,
  GIFT_DAILY_CAP_CENTS,
  type GiftKind,
  utcDay,
} from "@/lib/growth/constants";
import { hasActiveBadge } from "@/lib/growth/badges";

export function giftByKind(kind: string) {
  return GIFT_CATALOG.find((g) => g.kind === kind) ?? null;
}

export async function sendCreatorGift(input: {
  fromUserId: string;
  toUserId: string;
  kind: GiftKind;
  liveId?: string | null;
}) {
  if (input.fromUserId === input.toUserId) {
    throw new Error("Impossible de s’offrir un cadeau");
  }
  const influencer = await hasActiveBadge(input.toUserId, "INFLUENCER");
  const liveOpen = input.liveId
    ? await prisma.creatorLive.findFirst({
        where: { id: input.liveId, userId: input.toUserId, status: "LIVE" },
        select: { id: true },
      })
    : null;
  if (!influencer && !liveOpen) {
    throw new Error("Ce compte n’est pas encore influenceur");
  }
  const gift = giftByKind(input.kind);
  if (!gift) throw new Error("Cadeau inconnu");

  const today = utcDay();
  const spent = await prisma.creatorGift.aggregate({
    where: {
      fromUserId: input.fromUserId,
      createdAt: { gte: today },
    },
    _sum: { amountCents: true },
  });
  if ((spent._sum.amountCents ?? 0) + gift.amountCents > GIFT_DAILY_CAP_CENTS) {
    throw new Error("Limite quotidienne de cadeaux atteinte");
  }

  const creatorShare = Math.round(
    (gift.amountCents * CREATOR_GIFT_SHARE_BPS) / 10_000,
  );
  const currency = parseCurrency("USD");

  return prisma.$transaction(async (tx) => {
    const debit = await debitWalletLocked(
      tx,
      input.fromUserId,
      currency,
      gift.amountCents,
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
        kind: gift.kind,
        amountCents: gift.amountCents,
        currency: "USD",
      },
    });
    if (input.liveId) {
      await tx.creatorLive.update({
        where: { id: input.liveId },
        data: { giftCents: { increment: gift.amountCents } },
      });
    }
    await tx.walletTransaction.create({
      data: {
        walletId: debit.wallet.id,
        type: "TRANSFER_OUT",
        amountCents: gift.amountCents,
        currency: "USD",
        provider: "INTERNAL",
        reference: `GIFT-${row.id}`,
        status: "SUCCESS",
        metadata: { kind: gift.kind, toUserId: input.toUserId },
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
        metadata: { kind: gift.kind, fromUserId: input.fromUserId },
      },
    });
    return {
      gift: row,
      chargedCents: gift.amountCents,
      creatorCents: creatorShare,
    };
  });
}
