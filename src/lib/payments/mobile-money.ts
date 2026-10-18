import { prisma } from "@/lib/prisma";
import {
  parseCurrency,
  type AppCurrency,
  walletCents,
  walletCreditData,
} from "@/lib/money";
import {
  createCollectionSession,
  merchantMsisdn,
  type RailProvider,
} from "@/lib/payments/provider";

const DAILY_CAP_CENTS = 200_000; // 2 000 unités (ex. 2 000 $US)

export type DepositInput = {
  userId: string;
  amountCents: number;
  provider: RailProvider;
  phone: string;
  currency?: AppCurrency;
  beneficiaryUserId?: string | null;
};

type TxnMeta = {
  simulated?: boolean;
  ussdHint?: string;
  beneficiaryUserId?: string;
  payerUserId?: string;
  beneficiaryName?: string;
  collectionProvider?: string;
  merchantMsisdn?: string;
  clientReference?: string;
  idempotencyKey?: string;
  confirmedAt?: string;
};

function asMeta(value: unknown): TxnMeta {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as TxnMeta;
  }
  return {};
}

export async function initiateDeposit(input: DepositInput) {
  if (input.amountCents < 100) {
    throw new Error("Montant minimum: 1");
  }
  const currency = parseCurrency(input.currency);
  const payerPhone = input.phone.replace(/\s/g, "");
  if (!/^\+?\d{9,15}$/.test(payerPhone)) {
    throw new Error("Numéro Mobile Money invalide");
  }

  const beneficiaryId = input.beneficiaryUserId?.trim() || null;
  if (beneficiaryId && beneficiaryId === input.userId) {
    throw new Error("Choisissez un autre bénéficiaire, ou rechargez votre compte");
  }

  if (beneficiaryId) {
    const exists = await prisma.user.findUnique({
      where: { id: beneficiaryId },
      select: { id: true, name: true },
    });
    if (!exists) throw new Error("Bénéficiaire introuvable — il doit avoir un compte ShipShop");
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const usedToday = await prisma.walletTransaction.aggregate({
    where: {
      wallet: { userId: input.userId },
      type: { in: ["DEPOSIT", "TRANSFER_OUT"] },
      status: { in: ["PENDING", "SUCCESS"] },
      currency,
      createdAt: { gte: startOfDay },
    },
    _sum: { amountCents: true },
  });
  if ((usedToday._sum.amountCents ?? 0) + input.amountCents > DAILY_CAP_CENTS) {
    throw new Error("Plafond journalier de recharge atteint");
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId: input.userId },
  });
  if (!wallet) throw new Error("Portefeuille introuvable");

  const clientReference = `MM-${input.provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const amountMajor = (input.amountCents / 100).toFixed(0);
  const session = createCollectionSession({
    amount: amountMajor,
    currency,
    mobile: payerPhone,
    client_reference: clientReference,
    idempotency_key: clientReference,
    provider: input.provider,
  });

  const beneficiary = beneficiaryId
    ? await prisma.user.findUnique({
        where: { id: beneficiaryId },
        select: { name: true },
      })
    : null;

  const txn = await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: beneficiaryId ? "TRANSFER_OUT" : "DEPOSIT",
      amountCents: input.amountCents,
      currency,
      provider: input.provider,
      phone: payerPhone,
      reference: clientReference,
      status: "PENDING",
      metadata: {
        simulated: true,
        ussdHint: session.ussdHint,
        payerUserId: input.userId,
        beneficiaryUserId: beneficiaryId ?? undefined,
        beneficiaryName: beneficiary?.name,
        collectionProvider: input.provider,
        merchantMsisdn: merchantMsisdn(input.provider),
        clientReference,
        idempotencyKey: session.id,
      } satisfies TxnMeta,
    },
  });

  return {
    transactionId: txn.id,
    reference: clientReference,
    status: txn.status,
    ussdHint: session.ussdHint,
    merchantMsisdn: session.merchantMsisdn,
    type: txn.type,
  };
}

export async function confirmSimulatedDeposit(
  transactionId: string,
  payerUserId: string,
) {
  return prisma.$transaction(async (tx) => {
    const payerWallet = await tx.wallet.findUnique({
      where: { userId: payerUserId },
    });
    if (!payerWallet) throw new Error("Portefeuille introuvable");

    await tx.$queryRaw`
      SELECT id FROM "wallet_transaction" WHERE id = ${transactionId} FOR UPDATE
    `;

    const pending = await tx.walletTransaction.findFirst({
      where: {
        id: transactionId,
        walletId: payerWallet.id,
        type: { in: ["DEPOSIT", "TRANSFER_OUT"] },
      },
    });
    if (!pending) throw new Error("Transaction introuvable ou déjà traitée");
    if (pending.status === "SUCCESS") {
      const existingMeta = asMeta(pending.metadata);
      const existingCurrency = parseCurrency(pending.currency);
      const creditUserId = existingMeta.beneficiaryUserId ?? payerUserId;
      const credited = await tx.wallet.findUnique({
        where: { userId: creditUserId },
      });
      return {
        balanceCents: credited
          ? walletCents(credited, existingCurrency)
          : walletCents(payerWallet, existingCurrency),
        currency: existingCurrency,
        transaction: pending,
        beneficiaryUserId: existingMeta.beneficiaryUserId ?? null,
      };
    }
    if (pending.status !== "PENDING") {
      throw new Error("Transaction introuvable ou déjà traitée");
    }

    const meta = asMeta(pending.metadata);
    const currency = parseCurrency(pending.currency);
    const beneficiaryId = meta.beneficiaryUserId ?? null;

    const creditUserId = beneficiaryId ?? payerUserId;
    const creditWallet = await tx.wallet.upsert({
      where: { userId: creditUserId },
      create: { userId: creditUserId, balanceCents: 0, currency: "USD" },
      update: {},
    });

    const newBalance =
      walletCents(creditWallet, currency) + pending.amountCents;

    await tx.wallet.update({
      where: { id: creditWallet.id },
      data: walletCreditData(creditWallet, currency, newBalance, {
        setDisplay: true,
      }),
    });

    const confirmedMeta = {
      ...meta,
      confirmedAt: new Date().toISOString(),
      simulated: true,
    };

    const payerUpdated = await tx.walletTransaction.update({
      where: { id: pending.id },
      data: {
        status: "SUCCESS",
        balanceAfterCents: beneficiaryId
          ? walletCents(payerWallet, currency)
          : newBalance,
        metadata: confirmedMeta,
      },
    });

    if (beneficiaryId) {
      await tx.walletTransaction.create({
        data: {
          walletId: creditWallet.id,
          type: "TRANSFER_IN",
          amountCents: pending.amountCents,
          currency,
          provider: pending.provider,
          phone: pending.phone,
          reference: `${pending.reference}-IN`,
          status: "SUCCESS",
          balanceAfterCents: newBalance,
          metadata: {
            ...confirmedMeta,
            payerUserId,
            beneficiaryUserId: beneficiaryId,
          },
        },
      });
    }

    return {
      balanceCents: newBalance,
      currency,
      transaction: payerUpdated,
      beneficiaryUserId: beneficiaryId,
    };
  });
}
