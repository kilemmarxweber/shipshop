import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet } from "@/lib/session";
import {
  parseCurrency,
  type AppCurrency,
  walletCents,
} from "@/lib/money";
import {
  createCollectionSession,
  merchantMsisdn,
  type RailProvider,
} from "@/lib/payments/provider";
import {
  type AuditCtx,
  asCurrency,
  creditWalletLocked,
  debitWalletLocked,
  enqueueWalletOutbox,
  expireStaleMovements,
  lockMovement,
  MOVEMENT_TTL_MS,
  parseIdempotencyKey,
  publicMovement,
  scheduleOutboxFlush,
  writeAudit,
} from "@/lib/payments/ledger";

const DAILY_CAP_CENTS = 200_000;

export type DepositInput = {
  userId: string;
  amountCents: number;
  provider: RailProvider;
  phone: string;
  currency?: AppCurrency;
  beneficiaryUserId?: string | null;
  idempotencyKey: string;
  audit: AuditCtx;
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
  source?: string;
};

function asMeta(value: unknown): TxnMeta {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as TxnMeta;
  }
  return {};
}

async function assertDailyCap(
  userId: string,
  currency: AppCurrency,
  amountCents: number,
) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const usedToday = await prisma.walletTransaction.aggregate({
    where: {
      wallet: { userId },
      type: { in: ["DEPOSIT", "TRANSFER_OUT"] },
      status: { in: ["PENDING", "SUCCESS"] },
      currency,
      createdAt: { gte: startOfDay },
    },
    _sum: { amountCents: true },
  });
  if ((usedToday._sum.amountCents ?? 0) + amountCents > DAILY_CAP_CENTS) {
    throw new Error("Plafond journalier atteint");
  }
}

const movementInclude = {
  transactions: { select: { id: true, type: true } },
} as const;

async function loadMovement(id: string) {
  return prisma.moneyMovement.findUnique({
    where: { id },
    include: movementInclude,
  });
}

function postedResult(
  movement: NonNullable<Awaited<ReturnType<typeof loadMovement>>>,
  extra: {
    balanceCents: number;
    payerBalanceAfter: number;
    beneficiaryBalanceAfter: number;
    alreadyConfirmed: boolean;
    transaction?: { id: string };
  },
) {
  const pub = publicMovement(movement);
  return {
    ...pub,
    alreadyConfirmed: extra.alreadyConfirmed,
    alreadyApplied: extra.alreadyConfirmed || movement.status === "POSTED",
    balanceCents: extra.balanceCents,
    payerBalanceAfter: extra.payerBalanceAfter,
    beneficiaryBalanceAfter: extra.beneficiaryBalanceAfter,
    currency: asCurrency(movement.currency),
    transactionId: extra.transaction?.id ?? pub.transactionId,
    type: movement.kind === "DEPOSIT" ? "DEPOSIT" : "TRANSFER_OUT",
  };
}

export async function initiateDeposit(input: DepositInput) {
  await expireStaleMovements();
  const key = parseIdempotencyKey(input.idempotencyKey);
  if (input.amountCents < 100) throw new Error("Montant minimum: 1");
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
    if (!exists) {
      throw new Error("Bénéficiaire introuvable — il doit avoir un compte ShipShop");
    }
  }

  const existing = await prisma.moneyMovement.findUnique({
    where: { clientIdempotencyKey: key },
    include: movementInclude,
  });
  if (existing) {
    if (existing.payerUserId !== input.userId) {
      throw new Error("Clé d’idempotence déjà utilisée");
    }
    return {
      ...publicMovement(existing),
      replayed: true,
    };
  }

  await assertDailyCap(input.userId, currency, input.amountCents);

  const wallet = await getOrCreateWallet(input.userId);

  const clientReference = `MM-${input.provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const amountMajor = (input.amountCents / 100).toFixed(0);
  const session = createCollectionSession({
    amount: amountMajor,
    currency,
    mobile: payerPhone,
    client_reference: clientReference,
    idempotency_key: key,
    provider: input.provider,
  });

  const beneficiary = beneficiaryId
    ? await prisma.user.findUnique({
        where: { id: beneficiaryId },
        select: { name: true },
      })
    : null;

  const expiresAt = new Date(Date.now() + MOVEMENT_TTL_MS);
  const kind = beneficiaryId ? "P2P_MM" : "DEPOSIT";
  const meta: TxnMeta = {
    simulated: true,
    ussdHint: session.ussdHint,
    payerUserId: input.userId,
    beneficiaryUserId: beneficiaryId ?? undefined,
    beneficiaryName: beneficiary?.name,
    collectionProvider: input.provider,
    merchantMsisdn: merchantMsisdn(input.provider),
    clientReference,
    idempotencyKey: key,
  };

  try {
    const movement = await prisma.$transaction(async (tx) => {
      const created = await tx.moneyMovement.create({
        data: {
          kind,
          status: "AWAITING_FUNDS",
          payerUserId: input.userId,
          beneficiaryUserId: beneficiaryId,
          amountCents: input.amountCents,
          currency,
          provider: input.provider,
          phone: payerPhone,
          clientIdempotencyKey: key,
          providerReference: clientReference,
          expiresAt,
          metadata: meta,
        },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          movementId: created.id,
          type: beneficiaryId ? "TRANSFER_OUT" : "DEPOSIT",
          amountCents: input.amountCents,
          currency,
          provider: input.provider,
          phone: payerPhone,
          reference: clientReference,
          status: "PENDING",
          metadata: meta,
        },
      });
      await writeAudit(tx, {
        ...input.audit,
        movementId: created.id,
        action: "INITIATE",
        fromStatus: "CREATED",
        toStatus: "AWAITING_FUNDS",
        detail: { reference: clientReference },
      });
      return tx.moneyMovement.findUniqueOrThrow({
        where: { id: created.id },
        include: movementInclude,
      });
    });
    return { ...publicMovement(movement), replayed: false };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const again = await prisma.moneyMovement.findUnique({
        where: { clientIdempotencyKey: key },
        include: movementInclude,
      });
      if (again && again.payerUserId === input.userId) {
        return { ...publicMovement(again), replayed: true };
      }
    }
    throw error;
  }
}

export async function confirmSimulatedDeposit(
  transactionId: string,
  payerUserId: string,
  audit: AuditCtx,
  opts?: { evidenceNote?: string },
) {
  await expireStaleMovements();
  const pendingTxn = await prisma.walletTransaction.findFirst({
    where: {
      id: transactionId,
      type: { in: ["DEPOSIT", "TRANSFER_OUT"] },
    },
  });
  if (!pendingTxn) throw new Error("Transaction introuvable");

  const movement =
    (pendingTxn.movementId
      ? await prisma.moneyMovement.findUnique({
          where: { id: pendingTxn.movementId },
        })
      : null) ??
    (await prisma.moneyMovement.findFirst({
      where: { providerReference: pendingTxn.reference ?? undefined },
    }));
  if (!movement) {
    throw new Error("Mouvement introuvable — relancez le paiement");
  }
  if (movement.payerUserId !== payerUserId && audit.actorType !== "OWNER") {
    throw new Error("Transaction introuvable ou déjà traitée");
  }

  return postAwaitingMovement(movement.id, audit, opts);
}

export async function postAwaitingMovement(
  movementId: string,
  audit: AuditCtx,
  opts?: { evidenceNote?: string },
) {
  const result = await prisma.$transaction(async (tx) => {
    await lockMovement(tx, movementId);
    const movement = await tx.moneyMovement.findUnique({
      where: { id: movementId },
      include: movementInclude,
    });
    if (!movement) throw new Error("Mouvement introuvable");

    if (movement.status === "POSTED") {
      const creditUserId = movement.beneficiaryUserId ?? movement.payerUserId;
      const credited = await tx.wallet.findUnique({
        where: { userId: creditUserId },
      });
      const payerWallet = await tx.wallet.findUnique({
        where: { userId: movement.payerUserId },
      });
      const currency = asCurrency(movement.currency);
      return {
        alreadyConfirmed: true as const,
        movement,
        currency,
        balanceCents: credited ? walletCents(credited, currency) : 0,
        payerBalanceAfter: payerWallet
          ? walletCents(payerWallet, currency)
          : 0,
        beneficiaryBalanceAfter: credited
          ? walletCents(credited, currency)
          : 0,
        payerTxn: movement.transactions.find(
          (t) => t.type === "DEPOSIT" || t.type === "TRANSFER_OUT",
        ),
      };
    }

    if (movement.status === "EXPIRED") {
      throw new Error("Paiement expiré — relancez (nouvelle demande)");
    }
    if (movement.status !== "AWAITING_FUNDS") {
      throw new Error("Transaction introuvable ou déjà traitée");
    }
    if (movement.expiresAt && movement.expiresAt.getTime() <= Date.now()) {
      await tx.moneyMovement.update({
        where: { id: movement.id },
        data: { status: "EXPIRED" },
      });
      await tx.walletTransaction.updateMany({
        where: { movementId: movement.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      await writeAudit(tx, {
        actorType: "SYSTEM",
        movementId: movement.id,
        action: "EXPIRE",
        fromStatus: "AWAITING_FUNDS",
        toStatus: "EXPIRED",
      });
      throw new Error("Paiement expiré — relancez (nouvelle demande)");
    }

    const currency = asCurrency(movement.currency);
    const creditUserId = movement.beneficiaryUserId ?? movement.payerUserId;
    const payerWallet = await tx.wallet.findUnique({
      where: { userId: movement.payerUserId },
    });
    if (!payerWallet) throw new Error("Portefeuille introuvable");
    await tx.$queryRaw`SELECT id FROM "wallet" WHERE id = ${payerWallet.id} FOR UPDATE`;

    const credited = await creditWalletLocked(
      tx,
      creditUserId,
      currency,
      movement.amountCents,
    );

    const pending = await tx.walletTransaction.findFirst({
      where: {
        movementId: movement.id,
        type: { in: ["DEPOSIT", "TRANSFER_OUT"] },
      },
    });
    if (!pending) throw new Error("Transaction introuvable");

    const meta = {
      ...asMeta(pending.metadata),
      confirmedAt: new Date().toISOString(),
      simulated: true,
    };

    const payerUpdated = await tx.walletTransaction.update({
      where: { id: pending.id },
      data: {
        status: "SUCCESS",
        balanceAfterCents: movement.beneficiaryUserId
          ? walletCents(payerWallet, currency)
          : credited.nextCents,
        metadata: meta,
      },
    });

    if (movement.beneficiaryUserId) {
      await tx.walletTransaction.create({
        data: {
          walletId: credited.wallet.id,
          movementId: movement.id,
          type: "TRANSFER_IN",
          amountCents: movement.amountCents,
          currency,
          provider: pending.provider,
          phone: pending.phone,
          reference: `${pending.reference}-IN`,
          status: "SUCCESS",
          balanceAfterCents: credited.nextCents,
          metadata: {
            ...meta,
            payerUserId: movement.payerUserId,
            beneficiaryUserId: movement.beneficiaryUserId,
          },
        },
      });
    }

    const updated = await tx.moneyMovement.update({
      where: { id: movement.id },
      data: {
        status: "POSTED",
        postedAt: new Date(),
        evidenceNote: opts?.evidenceNote,
        metadata: { ...asMeta(movement.metadata), ...meta },
      },
      include: movementInclude,
    });

    const notifyPayload = {
      payerUserId: movement.payerUserId,
      beneficiaryUserId: movement.beneficiaryUserId,
      amountCents: movement.amountCents,
      currency,
      reference: movement.providerReference,
      payerBalanceAfter: movement.beneficiaryUserId
        ? walletCents(payerWallet, currency)
        : credited.nextCents,
      beneficiaryBalanceAfter: credited.nextCents,
      provider: movement.provider,
    };
    await enqueueWalletOutbox(tx, movement.id, notifyPayload);
    await writeAudit(tx, {
      ...audit,
      movementId: movement.id,
      action: "POST",
      fromStatus: "AWAITING_FUNDS",
      toStatus: "POSTED",
      detail: opts?.evidenceNote
        ? { evidenceNote: opts.evidenceNote }
        : undefined,
    });

    return {
      alreadyConfirmed: false as const,
      movement: updated,
      currency,
      balanceCents: credited.nextCents,
      payerBalanceAfter: notifyPayload.payerBalanceAfter,
      beneficiaryBalanceAfter: credited.nextCents,
      payerTxn: payerUpdated,
    };
  });

  if (!result.alreadyConfirmed) scheduleOutboxFlush();

  const fresh = await loadMovement(result.movement.id);
  return postedResult(fresh!, {
    alreadyConfirmed: result.alreadyConfirmed,
    balanceCents: result.balanceCents,
    payerBalanceAfter: result.payerBalanceAfter,
    beneficiaryBalanceAfter: result.beneficiaryBalanceAfter,
    transaction: result.payerTxn,
  });
}

export async function transferFromBalance(input: {
  payerUserId: string;
  beneficiaryUserId: string;
  amountCents: number;
  currency?: AppCurrency;
  idempotencyKey: string;
  audit: AuditCtx;
}) {
  await expireStaleMovements();
  const key = parseIdempotencyKey(input.idempotencyKey);
  if (input.amountCents < 100) throw new Error("Montant minimum: 1");
  const beneficiaryId = input.beneficiaryUserId.trim();
  if (!beneficiaryId || beneficiaryId === input.payerUserId) {
    throw new Error("Choisissez un autre bénéficiaire");
  }

  const existing = await prisma.moneyMovement.findUnique({
    where: { clientIdempotencyKey: key },
    include: movementInclude,
  });
  if (existing) {
    if (existing.payerUserId !== input.payerUserId) {
      throw new Error("Clé d’idempotence déjà utilisée");
    }
    const currency = asCurrency(existing.currency);
    const payerW = await prisma.wallet.findUnique({
      where: { userId: input.payerUserId },
    });
    const creditW = await prisma.wallet.findUnique({
      where: { userId: beneficiaryId },
    });
    return postedResult(existing, {
      alreadyConfirmed: existing.status === "POSTED",
      balanceCents: payerW ? walletCents(payerW, currency) : 0,
      payerBalanceAfter: payerW ? walletCents(payerW, currency) : 0,
      beneficiaryBalanceAfter: creditW ? walletCents(creditW, currency) : 0,
      transaction: existing.transactions.find((t) => t.type === "TRANSFER_OUT"),
    });
  }

  const currency = parseCurrency(input.currency);
  const beneficiary = await prisma.user.findUnique({
    where: { id: beneficiaryId },
    select: { id: true, name: true },
  });
  if (!beneficiary) {
    throw new Error("Bénéficiaire introuvable — il doit avoir un compte ShipShop");
  }

  await assertDailyCap(input.payerUserId, currency, input.amountCents);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payerWallet = await tx.wallet.findUnique({
        where: { userId: input.payerUserId },
      });
      if (!payerWallet) throw new Error("Portefeuille introuvable");
      const creditWallet = await tx.wallet.upsert({
        where: { userId: beneficiaryId },
        create: { userId: beneficiaryId, balanceCents: 0, currency: "USD" },
        update: {},
      });
      const lockOrder =
        payerWallet.id < creditWallet.id
          ? [payerWallet.id, creditWallet.id]
          : [creditWallet.id, payerWallet.id];
      for (const id of lockOrder) {
        await tx.$queryRaw`SELECT id FROM "wallet" WHERE id = ${id} FOR UPDATE`;
      }

      const payerDebit = await debitWalletLocked(
        tx,
        input.payerUserId,
        currency,
        input.amountCents,
      );
      const credit = await creditWalletLocked(
        tx,
        beneficiaryId,
        currency,
        input.amountCents,
      );

      const reference = `BAL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const meta = {
        source: "balance" as const,
        payerUserId: input.payerUserId,
        beneficiaryUserId: beneficiaryId,
        beneficiaryName: beneficiary.name,
        idempotencyKey: key,
      };

      const movement = await tx.moneyMovement.create({
        data: {
          kind: "P2P_BALANCE",
          status: "POSTED",
          payerUserId: input.payerUserId,
          beneficiaryUserId: beneficiaryId,
          amountCents: input.amountCents,
          currency,
          provider: "INTERNAL",
          clientIdempotencyKey: key,
          providerReference: reference,
          postedAt: new Date(),
          metadata: meta,
        },
      });

      const outTxn = await tx.walletTransaction.create({
        data: {
          walletId: payerDebit.wallet.id,
          movementId: movement.id,
          type: "TRANSFER_OUT",
          amountCents: input.amountCents,
          currency,
          provider: "INTERNAL",
          reference,
          status: "SUCCESS",
          balanceAfterCents: payerDebit.nextCents,
          metadata: meta,
        },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: credit.wallet.id,
          movementId: movement.id,
          type: "TRANSFER_IN",
          amountCents: input.amountCents,
          currency,
          provider: "INTERNAL",
          reference: `${reference}-IN`,
          status: "SUCCESS",
          balanceAfterCents: credit.nextCents,
          metadata: {
            ...meta,
            payerUserId: input.payerUserId,
          },
        },
      });

      await enqueueWalletOutbox(tx, movement.id, {
        payerUserId: input.payerUserId,
        beneficiaryUserId: beneficiaryId,
        amountCents: input.amountCents,
        currency,
        reference,
        payerBalanceAfter: payerDebit.nextCents,
        beneficiaryBalanceAfter: credit.nextCents,
        provider: "INTERNAL",
      });
      await writeAudit(tx, {
        ...input.audit,
        movementId: movement.id,
        action: "POST",
        fromStatus: "CREATED",
        toStatus: "POSTED",
      });

      return {
        movementId: movement.id,
        outTxn,
        payerAfter: payerDebit.nextCents,
        creditAfter: credit.nextCents,
        reference,
      };
    });

    scheduleOutboxFlush();
    const movement = await loadMovement(result.movementId);
    return postedResult(movement!, {
      alreadyConfirmed: false,
      balanceCents: result.payerAfter,
      payerBalanceAfter: result.payerAfter,
      beneficiaryBalanceAfter: result.creditAfter,
      transaction: result.outTxn,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const again = await prisma.moneyMovement.findUnique({
        where: { clientIdempotencyKey: key },
        include: movementInclude,
      });
      if (again && again.payerUserId === input.payerUserId) {
        const payerW = await prisma.wallet.findUnique({
          where: { userId: input.payerUserId },
        });
        const creditW = await prisma.wallet.findUnique({
          where: { userId: beneficiaryId },
        });
        const ccy = asCurrency(again.currency);
        return postedResult(again, {
          alreadyConfirmed: true,
          balanceCents: payerW ? walletCents(payerW, ccy) : 0,
          payerBalanceAfter: payerW ? walletCents(payerW, ccy) : 0,
          beneficiaryBalanceAfter: creditW ? walletCents(creditW, ccy) : 0,
          transaction: again.transactions.find((t) => t.type === "TRANSFER_OUT"),
        });
      }
    }
    throw error;
  }
}

export async function getMovementForUser(
  userId: string,
  query: { id?: string | null; idempotencyKey?: string | null },
) {
  await expireStaleMovements();
  const key = query.idempotencyKey?.trim();
  const row = query.id
    ? await prisma.moneyMovement.findUnique({
        where: { id: query.id },
        include: movementInclude,
      })
    : key
      ? await prisma.moneyMovement.findUnique({
          where: { clientIdempotencyKey: key },
          include: movementInclude,
        })
      : null;
  if (!row) return null;
  if (row.payerUserId !== userId && row.beneficiaryUserId !== userId) {
    return null;
  }
  const currency = asCurrency(row.currency);
  const payerW = await prisma.wallet.findUnique({
    where: { userId: row.payerUserId },
  });
  const creditId = row.beneficiaryUserId ?? row.payerUserId;
  const creditW = await prisma.wallet.findUnique({
    where: { userId: creditId },
  });
  return {
    ...publicMovement(row),
    balanceCents: payerW ? walletCents(payerW, currency) : 0,
    payerBalanceAfter: payerW ? walletCents(payerW, currency) : 0,
    beneficiaryBalanceAfter: creditW ? walletCents(creditW, currency) : 0,
    currency,
  };
}

export async function rejectOrExpireMovement(
  movementId: string,
  audit: AuditCtx,
  next: "EXPIRED" | "REJECTED",
) {
  await prisma.$transaction(async (tx) => {
    await lockMovement(tx, movementId);
    const row = await tx.moneyMovement.findUnique({ where: { id: movementId } });
    if (!row) throw new Error("Mouvement introuvable");
    if (row.status === "POSTED") {
      throw new Error("Déjà crédité — utiliser un reverse (P1)");
    }
    if (row.status === next) return;
    await tx.moneyMovement.update({
      where: { id: movementId },
      data: { status: next },
    });
    await tx.walletTransaction.updateMany({
      where: { movementId, status: "PENDING" },
      data: { status: next === "EXPIRED" ? "EXPIRED" : "FAILED" },
    });
    await writeAudit(tx, {
      ...audit,
      movementId,
      action: next,
      fromStatus: row.status,
      toStatus: next,
    });
  });
}
