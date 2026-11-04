import { Prisma } from "@/generated/prisma/client";
import { getAppName } from "@/lib/app-name";
import { parseCurrency, walletCents, type AppCurrency } from "@/lib/money";
import {
    assertCinetPayAmount,
    checkCinetPayPayment,
    cinetPayAccepted,
    CinetPayApiError,
    cinetPayPhone,
    cinetPayRefused,
    initiateCinetPayPayment,
    isCinetPayConfigured,
    newCinetPayTransactionId,
    verifyCinetPayNotifyToken,
} from "@/lib/payments/cinetpay";
import {
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
    type AuditCtx,
} from "@/lib/payments/ledger";
import {
    createCollectionSession,
    merchantMsisdn,
    type RailProvider,
} from "@/lib/payments/provider";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet } from "@/lib/session";

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
  paymentUrl?: string;
  paymentToken?: string;
  notifyToken?: string;
  cinetpayTransactionId?: string;
  cinetpayStatus?: string;
  paymentMethod?: string;
  operatorId?: string;
};

function asMeta(value: unknown): TxnMeta {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as TxnMeta;
  }
  return {};
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

/** Simulated deposits keep the previous 9–15 digit check. CinetPay has its own. */
function simulatedPayerPhone(raw: string) {
  const phone = raw.trim();
  if (!/^\+?\d{9,15}$/.test(phone)) {
    throw new Error("Numéro Mobile Money invalide");
  }
  return phone;
}

export async function initiateDeposit(input: DepositInput) {
  await expireStaleMovements();
  const key = parseIdempotencyKey(input.idempotencyKey);
  if (input.amountCents < 100) throw new Error("Montant minimum: 1");
  const currency = parseCurrency(input.currency);
  const live = isCinetPayConfigured();
  const amountMajor = live
    ? assertCinetPayAmount(input.amountCents, currency)
    : input.amountCents / 100;
  const payerPhone = live
    ? cinetPayPhone(input.phone)
    : simulatedPayerPhone(input.phone);

  const beneficiaryId = input.beneficiaryUserId?.trim() || null;
  if (beneficiaryId && beneficiaryId === input.userId) {
    throw new Error(
      "Choisissez un autre bénéficiaire, ou rechargez votre compte",
    );
  }
  if (beneficiaryId) {
    const exists = await prisma.user.findUnique({
      where: { id: beneficiaryId },
      select: { id: true, name: true },
    });
    if (!exists) {
      throw new Error(
        "Bénéficiaire introuvable — il doit avoir un compte ShipShop",
      );
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
    const existingMeta = asMeta(existing.metadata);
    if (existing.status === "AWAITING_FUNDS" && !existingMeta.paymentUrl) {
      if (live && existingMeta.simulated !== true) {
        return openCinetPay(existing.id, input, amountMajor, currency);
      }
      return { ...publicMovement(existing), replayed: true };
    }
    if (existing.status === "FAILED" || existing.status === "REJECTED") {
      throw new Error("Paiement refusé. Relancez une nouvelle demande.");
    }
    return {
      ...publicMovement(existing),
      replayed: true,
    };
  }

  const wallet = await getOrCreateWallet(input.userId);

  const clientReference = newCinetPayTransactionId();
  const session = live
    ? null
    : createCollectionSession({
        amount: String(amountMajor),
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
    simulated: !live,
    ussdHint: session?.ussdHint,
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
    if (live) {
      return openCinetPay(movement.id, input, amountMajor, currency);
    }
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

async function openCinetPay(
  movementId: string,
  input: DepositInput,
  amountMajor: number,
  currency: AppCurrency,
) {
  const movement = await prisma.moneyMovement.findUniqueOrThrow({
    where: { id: movementId },
  });
  const transactionId =
    movement.providerReference ?? newCinetPayTransactionId();
  const payer = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { name: true, email: true },
  });
  const parts = (payer?.name ?? getAppName())
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const given = parts[0] ?? "Client";
  const surname = parts.slice(1).join(" ") || given;
  if (currency !== "CDF" && currency !== "USD") {
    throw new Error("CinetPay accepte CDF et USD. Le KW reste dans ShipShop.");
  }
  try {
    const payment = await initiateCinetPayPayment({
      transactionId,
      amount: amountMajor,
      currency,
      phone: movement.phone ?? input.phone,
      provider: input.provider,
      customerName: given,
      customerSurname: surname,
      customerEmail: payer?.email ?? "",
      description: `Recharge ${getAppName()}`,
    });
    const meta: TxnMeta = {
      ...asMeta(movement.metadata),
      simulated: false,
      paymentUrl: payment.paymentUrl,
      paymentToken: payment.paymentToken,
      notifyToken: payment.notifyToken,
      cinetpayTransactionId: payment.transactionId,
      cinetpayStatus: payment.status,
      clientReference: transactionId,
    };
    const updated = await prisma.moneyMovement.update({
      where: { id: movement.id },
      data: {
        providerReference: transactionId,
        metadata: meta,
      },
      include: movementInclude,
    });
    await prisma.walletTransaction.updateMany({
      where: { movementId: movement.id },
      data: { metadata: meta, reference: transactionId },
    });
    return { ...publicMovement(updated), replayed: false };
  } catch (error) {
    if (error instanceof CinetPayApiError && error.code === "1200") {
      throw new Error("Paiement déjà ouvert. Vérifiez le statut.");
    }
    await prisma.moneyMovement.update({
      where: { id: movement.id },
      data: { status: "FAILED" },
    });
    await prisma.walletTransaction.updateMany({
      where: { movementId: movement.id, status: "PENDING" },
      data: { status: "FAILED" },
    });
    throw error;
  }
}

export async function settleCinetPayDeposit(input: {
  transactionId: string;
  payerUserId?: string;
  notifyToken?: string;
  audit: AuditCtx;
}) {
  await expireStaleMovements();
  let transactionId = input.transactionId;
  let movement = await prisma.moneyMovement.findFirst({
    where: { providerReference: transactionId },
    include: movementInclude,
  });
  if (!movement) {
    const txn = await prisma.walletTransaction.findUnique({
      where: { id: input.transactionId },
      select: { reference: true, movementId: true },
    });
    if (txn?.reference) transactionId = txn.reference;
    movement = txn?.movementId
      ? await prisma.moneyMovement.findUnique({
          where: { id: txn.movementId },
          include: movementInclude,
        })
      : txn?.reference
        ? await prisma.moneyMovement.findFirst({
            where: { providerReference: txn.reference },
            include: movementInclude,
          })
        : null;
  }
  if (!movement) {
    movement = await prisma.moneyMovement.findFirst({
      where: {
        metadata: {
          path: ["cinetpayTransactionId"],
          equals: input.transactionId,
        },
      },
      include: movementInclude,
    });
  }
  if (!movement) throw new Error("Transaction introuvable");
  if (input.notifyToken) {
    const stored = asMeta(movement.metadata).notifyToken;
    if (!verifyCinetPayNotifyToken(stored, input.notifyToken)) {
      throw new Error("Notification CinetPay refusée");
    }
  }
  if (
    input.payerUserId &&
    movement.payerUserId !== input.payerUserId &&
    input.audit.actorType !== "OWNER"
  ) {
    throw new Error("Transaction introuvable");
  }
  if (movement.status === "POSTED") {
    return {
      ...publicMovement(movement),
      alreadyConfirmed: true,
      alreadyApplied: true,
    };
  }
  if (movement.status !== "AWAITING_FUNDS") {
    return publicMovement(movement);
  }

  const check = await checkCinetPayPayment(
    movement.providerReference ?? transactionId,
  );
  const expectedMajor = movement.amountCents / 100;
  const amountMatches =
    (check.amount === "" || Number(check.amount) === expectedMajor) &&
    (check.currency === "" ||
      check.currency.toUpperCase() === movement.currency.toUpperCase());

  if (cinetPayAccepted(check)) {
    if (!amountMatches) {
      throw new Error("Montant CinetPay différent du mouvement");
    }
    const prevMeta = asMeta(movement.metadata);
    const meta: TxnMeta = {
      ...prevMeta,
      cinetpayStatus: check.status,
      paymentMethod: check.paymentMethod ?? undefined,
      operatorId: check.operatorId ?? undefined,
      simulated: false,
    };
    await prisma.moneyMovement.update({
      where: { id: movement.id },
      data: { metadata: meta },
    });
    return postAwaitingMovement(movement.id, input.audit, {
      simulated: false,
      evidenceNote: check.operatorId ?? check.paymentMethod ?? "cinetpay",
    });
  }

  if (cinetPayRefused(check)) {
    await prisma.$transaction(async (tx) => {
      await lockMovement(tx, movement.id);
      const current = await tx.moneyMovement.findUnique({
        where: { id: movement.id },
      });
      if (!current || current.status !== "AWAITING_FUNDS") return;
      await tx.moneyMovement.update({
        where: { id: movement.id },
        data: {
          status: "REJECTED",
          metadata: {
            ...asMeta(current.metadata),
            cinetpayStatus: check.status,
            paymentMethod: check.paymentMethod ?? undefined,
          },
        },
      });
      await tx.walletTransaction.updateMany({
        where: { movementId: movement.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
      await writeAudit(tx, {
        ...input.audit,
        movementId: movement.id,
        action: "REJECT",
        fromStatus: "AWAITING_FUNDS",
        toStatus: "REJECTED",
        detail: { code: check.code, message: check.message },
      });
    });
    const rejected = await loadMovement(movement.id);
    return publicMovement(rejected!);
  }

  return publicMovement(movement);
}

export async function confirmDeposit(
  transactionId: string,
  payerUserId: string,
  audit: AuditCtx,
) {
  const pendingTxn = await prisma.walletTransaction.findFirst({
    where: {
      id: transactionId,
      type: { in: ["DEPOSIT", "TRANSFER_OUT"] },
    },
  });
  const movement =
    (pendingTxn?.movementId
      ? await prisma.moneyMovement.findUnique({
          where: { id: pendingTxn.movementId },
        })
      : null) ??
    (await prisma.moneyMovement.findFirst({
      where: { providerReference: transactionId },
    }));
  if (asMeta(movement?.metadata).simulated === true) {
    return confirmSimulatedDeposit(transactionId, payerUserId, audit);
  }
  return settleCinetPayDeposit({
    transactionId,
    payerUserId,
    audit,
  });
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

  return postAwaitingMovement(movement.id, audit, { ...opts, simulated: true });
}

export async function postAwaitingMovement(
  movementId: string,
  audit: AuditCtx,
  opts?: { evidenceNote?: string; simulated?: boolean },
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
        payerBalanceAfter: payerWallet ? walletCents(payerWallet, currency) : 0,
        beneficiaryBalanceAfter: credited ? walletCents(credited, currency) : 0,
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
    await tx.wallet.update({
      where: { id: payerWallet.id },
      data: { updatedAt: new Date() },
      select: { id: true },
    });

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
      simulated: opts?.simulated === true,
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
    throw new Error(
      "Bénéficiaire introuvable — il doit avoir un compte ShipShop",
    );
  }

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
        await tx.wallet.update({
          where: { id },
          data: { updatedAt: new Date() },
          select: { id: true },
        });
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
          transaction: again.transactions.find(
            (t) => t.type === "TRANSFER_OUT",
          ),
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
    const row = await tx.moneyMovement.findUnique({
      where: { id: movementId },
    });
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
