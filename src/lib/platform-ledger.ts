import type { PlatformFeeKind, Prisma } from "@/generated/prisma/client";
import type { AppCurrency } from "@/lib/money";
import { parseCurrency, shopFxRates } from "@/lib/money";
import { amountUsdCents } from "@/lib/platform-fees";

type Tx = Prisma.TransactionClient;

export type PlatformFeeLedgerKind =
  | "SALE"
  | "SHIPPING"
  | "WITHDRAWAL"
  | "TICKET"
  | "DEPOSIT"
  | "TRANSFER_EXTERNAL"
  | "TRANSFER_INTERNAL";

function treasuryKey(currency: AppCurrency) {
  if (currency === "CDF") return "cdfCents" as const;
  if (currency === "KW") return "kwCents" as const;
  return "usdCents" as const;
}

export async function ensureTreasury(tx: Tx) {
  return tx.platformTreasury.upsert({
    where: { id: "chipshop" },
    create: { id: "chipshop" },
    update: {},
  });
}

export async function creditTreasury(
  tx: Tx,
  input: {
    /** Montant crédité en treasury (= net ShipShop). */
    amountCents: number;
    currency: string;
    kind: PlatformFeeLedgerKind;
    orderId?: string | null;
    withdrawalId?: string | null;
    shopId?: string | null;
    courierId?: string | null;
    ticketId?: string | null;
    actorUserId?: string | null;
    fx?: ReturnType<typeof shopFxRates>;
    grossFeeCents?: number;
    providerCostCents?: number;
    partnerShareCents?: number;
    feeBpsSnapshot?: number | null;
    providerBpsSnapshot?: number | null;
  },
) {
  const netAmountCents = Math.max(0, input.amountCents);
  if (
    netAmountCents <= 0 &&
    (input.grossFeeCents ?? 0) <= 0 &&
    (input.partnerShareCents ?? 0) <= 0 &&
    (input.providerCostCents ?? 0) <= 0
  ) {
    return null;
  }

  const currency = parseCurrency(input.currency);
  const fx = input.fx ?? shopFxRates();
  const grossFeeCents = Math.max(0, input.grossFeeCents ?? netAmountCents);
  const providerCostCents = Math.max(0, input.providerCostCents ?? 0);
  const partnerShareCents = Math.max(0, input.partnerShareCents ?? 0);
  const usd = amountUsdCents(netAmountCents, currency, fx);

  await ensureTreasury(tx);
  let row = null as Awaited<ReturnType<typeof tx.platformTreasury.update>> | null;
  if (netAmountCents > 0) {
    row = await tx.platformTreasury.update({
      where: { id: "chipshop" },
      data: { [treasuryKey(currency)]: { increment: netAmountCents } },
    });
  } else {
    row = await tx.platformTreasury.findUnique({ where: { id: "chipshop" } });
  }

  const fee = await tx.platformFee.create({
    data: {
      kind: input.kind as PlatformFeeKind,
      amountCents: netAmountCents,
      currency,
      amountUsdCents: usd,
      grossFeeCents,
      providerCostCents,
      netAmountCents,
      partnerShareCents,
      feeBpsSnapshot: input.feeBpsSnapshot ?? null,
      providerBpsSnapshot: input.providerBpsSnapshot ?? null,
      orderId: input.orderId ?? null,
      withdrawalId: input.withdrawalId ?? null,
      shopId: input.shopId ?? null,
      courierId: input.courierId ?? null,
      ticketId: input.ticketId ?? null,
    },
  });
  await tx.paymentAudit.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      actorType: "SYSTEM",
      action: `PLATFORM_FEE_${input.kind}`,
      detail: {
        feeId: fee.id,
        amountCents: netAmountCents,
        grossFeeCents,
        providerCostCents,
        partnerShareCents,
        currency,
        orderId: input.orderId ?? null,
        withdrawalId: input.withdrawalId ?? null,
        ticketId: input.ticketId ?? null,
        feeBpsSnapshot: input.feeBpsSnapshot ?? null,
        providerBpsSnapshot: input.providerBpsSnapshot ?? null,
      },
    },
  });
  return { fee, treasury: row };
}

export async function debitTreasury(
  tx: Tx,
  input: {
    amountCents: number;
    currency: string;
    actorUserId?: string | null;
    action?: string;
    detail?: Record<string, unknown>;
  },
) {
  if (input.amountCents <= 0) return null;
  const currency = parseCurrency(input.currency);
  await ensureTreasury(tx);
  const row = await tx.platformTreasury.update({
    where: { id: "chipshop" },
    data: { [treasuryKey(currency)]: { decrement: input.amountCents } },
  });
  await tx.paymentAudit.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      actorType: "SYSTEM",
      action: input.action ?? "TREASURY_DEBIT",
      detail: {
        amountCents: input.amountCents,
        currency,
        ...(input.detail ?? {}),
      },
    },
  });
  return row;
}

export async function reverseTicketFee(tx: Tx, ticketId: string) {
  const fee = await tx.platformFee.findUnique({
    where: { ticketId_kind: { ticketId, kind: "TICKET" } },
  });
  if (!fee || fee.reversedAt) return null;
  const currency = parseCurrency(fee.currency);
  await ensureTreasury(tx);
  if (fee.amountCents > 0) {
    await tx.platformTreasury.update({
      where: { id: "chipshop" },
      data: { [treasuryKey(currency)]: { decrement: fee.amountCents } },
    });
  }
  await tx.platformFee.update({
    where: { id: fee.id },
    data: { reversedAt: new Date() },
  });
  await tx.paymentAudit.create({
    data: {
      actorType: "SYSTEM",
      action: "PLATFORM_FEE_TICKET_REVERSE",
      detail: {
        feeId: fee.id,
        ticketId,
        amountCents: fee.amountCents,
        currency,
      },
    },
  });
  return fee;
}

export async function reverseSaleFee(tx: Tx, orderId: string) {
  const fee = await tx.platformFee.findUnique({
    where: { orderId_kind: { orderId, kind: "SALE" } },
  });
  if (!fee || fee.reversedAt) return null;
  const currency = parseCurrency(fee.currency);
  await ensureTreasury(tx);
  if (fee.amountCents > 0) {
    await tx.platformTreasury.update({
      where: { id: "chipshop" },
      data: { [treasuryKey(currency)]: { decrement: fee.amountCents } },
    });
  }
  await tx.platformFee.update({
    where: { id: fee.id },
    data: { reversedAt: new Date() },
  });
  await tx.paymentAudit.create({
    data: {
      actorType: "SYSTEM",
      action: "PLATFORM_FEE_SALE_REVERSE",
      detail: {
        feeId: fee.id,
        orderId,
        amountCents: fee.amountCents,
        currency,
      },
    },
  });
  return fee;
}
