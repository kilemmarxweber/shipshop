import { after } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { WalletNotifyInput } from "@/lib/messaging/notify";
import {
  parseCurrency,
  walletCents,
  walletCreditData,
  type AppCurrency,
} from "@/lib/money";

export const MOVEMENT_TTL_MS = 30 * 60 * 1000;
export const IDEMPOTENCY_RE = /^[A-Za-z0-9._:-]{8,128}$/;

type Tx = Prisma.TransactionClient;

export type AuditCtx = {
  actorUserId?: string | null;
  actorType: "USER" | "SYSTEM" | "OWNER";
  requestId?: string | null;
  ip?: string | null;
};

export function parseIdempotencyKey(raw: string | null | undefined) {
  const key = raw?.trim() ?? "";
  if (!IDEMPOTENCY_RE.test(key)) {
    throw new Error("Clé d’idempotence manquante ou invalide");
  }
  return key;
}

export function auditFromRequest(
  req: Request,
  actorUserId: string | null,
  actorType: AuditCtx["actorType"] = "USER",
): AuditCtx {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  return {
    actorUserId,
    actorType,
    requestId:
      req.headers.get("x-request-id")?.trim() ||
      req.headers.get("idempotency-key")?.trim() ||
      null,
    ip,
  };
}

export function idempotencyFrom(req: Request, bodyKey?: string | null) {
  return parseIdempotencyKey(
    req.headers.get("idempotency-key") || bodyKey || "",
  );
}

export async function lockWallet(tx: Tx, walletId: string) {
  await tx.$queryRaw`SELECT id FROM "wallet" WHERE id = ${walletId} FOR UPDATE`;
}

export async function lockMovement(tx: Tx, movementId: string) {
  await tx.$queryRaw`SELECT id FROM "money_movement" WHERE id = ${movementId} FOR UPDATE`;
}

export async function writeAudit(
  tx: Tx,
  input: AuditCtx & {
    movementId?: string | null;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    detail?: Prisma.InputJsonValue;
  },
) {
  await tx.paymentAudit.create({
    data: {
      movementId: input.movementId ?? undefined,
      actorUserId: input.actorUserId ?? undefined,
      actorType: input.actorType,
      action: input.action,
      requestId: input.requestId ?? undefined,
      ip: input.ip ?? undefined,
      fromStatus: input.fromStatus ?? undefined,
      toStatus: input.toStatus ?? undefined,
      detail: input.detail,
    },
  });
}

export async function enqueueWalletOutbox(
  tx: Tx,
  movementId: string,
  payload: WalletNotifyInput,
) {
  const selfOnly = !payload.beneficiaryUserId;
  const jobs = selfOnly
    ? (["WALLET_DEPOSIT"] as const)
    : (["WALLET_SENT", "WALLET_RECEIVED"] as const);
  for (const eventKey of jobs) {
    await tx.notifyOutbox.upsert({
      where: {
        movementId_eventKey: { movementId, eventKey },
      },
      create: {
        movementId,
        eventKey,
        payload: payload as unknown as Prisma.InputJsonValue,
        status: "PENDING",
      },
      update: {},
    });
  }
}

export function scheduleOutboxFlush() {
  const run = () =>
    flushNotifyOutbox().catch((err) =>
      console.error("[payments] outbox", err),
    );
  try {
    after(run);
  } catch {
    void run();
  }
}

export async function flushNotifyOutbox(limit = 25) {
  const { notifyWalletMovement } = await import("@/lib/messaging/notify");
  const rows = await prisma.notifyOutbox.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  for (const row of rows) {
    try {
      await notifyWalletMovement(row.payload as WalletNotifyInput);
      await prisma.notifyOutbox.update({
        where: { id: row.id },
        data: { status: "SENT", attempts: { increment: 1 }, lastError: null },
      });
    } catch (error) {
      const attempts = row.attempts + 1;
      await prisma.notifyOutbox.update({
        where: { id: row.id },
        data: {
          attempts,
          lastError: (error instanceof Error ? error.message : String(error)).slice(
            0,
            500,
          ),
          status: attempts >= 8 ? "DEAD" : "PENDING",
        },
      });
    }
  }
  return rows.length;
}

export async function expireStaleMovements(limit = 80) {
  const now = new Date();
  const stale = await prisma.moneyMovement.findMany({
    where: {
      status: "AWAITING_FUNDS",
      expiresAt: { lte: now },
    },
    select: { id: true },
    take: limit,
  });
  let expired = 0;
  for (const row of stale) {
    const did = await prisma.$transaction(async (tx) => {
      await lockMovement(tx, row.id);
      const current = await tx.moneyMovement.findUnique({
        where: { id: row.id },
      });
      if (!current || current.status !== "AWAITING_FUNDS") return false;
      await tx.moneyMovement.update({
        where: { id: row.id },
        data: { status: "EXPIRED" },
      });
      await tx.walletTransaction.updateMany({
        where: { movementId: row.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      await writeAudit(tx, {
        actorType: "SYSTEM",
        movementId: row.id,
        action: "EXPIRE",
        fromStatus: "AWAITING_FUNDS",
        toStatus: "EXPIRED",
      });
      return true;
    });
    if (did) expired += 1;
  }
  return expired;
}

export function publicMovement(row: {
  id: string;
  kind: string;
  status: string;
  amountCents: number;
  currency: string;
  provider: string;
  phone: string | null;
  providerReference: string | null;
  clientIdempotencyKey: string;
  expiresAt: Date | null;
  postedAt: Date | null;
  evidenceNote: string | null;
  createdAt: Date;
  payerUserId: string;
  beneficiaryUserId: string | null;
  metadata: unknown;
  transactions?: { id: string; type: string }[];
}) {
  const payerTxn = row.transactions?.find(
    (t) => t.type === "DEPOSIT" || t.type === "TRANSFER_OUT",
  );
  const meta =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};
  return {
    movementId: row.id,
    transactionId: payerTxn?.id ?? null,
    kind: row.kind,
    status: row.status,
    amountCents: row.amountCents,
    currency: row.currency,
    provider: row.provider,
    phone: row.phone,
    reference: row.providerReference,
    expiresAt: row.expiresAt,
    postedAt: row.postedAt,
    ussdHint: typeof meta.ussdHint === "string" ? meta.ussdHint : null,
    merchantMsisdn:
      typeof meta.merchantMsisdn === "string" ? meta.merchantMsisdn : null,
    alreadyApplied: row.status === "POSTED",
    beneficiaryUserId: row.beneficiaryUserId,
  };
}

export async function creditWalletLocked(
  tx: Tx,
  userId: string,
  currency: AppCurrency,
  amountCents: number,
) {
  const wallet = await tx.wallet.upsert({
    where: { userId },
    create: { userId, balanceCents: 0, currency: "USD" },
    update: {},
  });
  await lockWallet(tx, wallet.id);
  const locked = await tx.wallet.findUnique({ where: { id: wallet.id } });
  if (!locked) throw new Error("Portefeuille introuvable");
  const next = walletCents(locked, currency) + amountCents;
  await tx.wallet.update({
    where: { id: locked.id },
    data: walletCreditData(locked, currency, next, { setDisplay: true }),
  });
  return { wallet: locked, nextCents: next };
}

export async function debitWalletLocked(
  tx: Tx,
  userId: string,
  currency: AppCurrency,
  amountCents: number,
) {
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("Portefeuille introuvable");
  await lockWallet(tx, wallet.id);
  const locked = await tx.wallet.findUnique({ where: { id: wallet.id } });
  if (!locked) throw new Error("Portefeuille introuvable");
  const available = walletCents(locked, currency);
  if (available < amountCents) throw new Error("Solde insuffisant");
  const next = available - amountCents;
  await tx.wallet.update({
    where: { id: locked.id },
    data: walletCreditData(locked, currency, next, { setDisplay: true }),
  });
  return { wallet: locked, nextCents: next };
}

export function asCurrency(value: string) {
  return parseCurrency(value);
}
