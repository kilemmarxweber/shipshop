import type { Prisma } from "@/generated/prisma/client";
import type { AppCurrency } from "@/lib/money";
import { parseCurrency, shopFxRates } from "@/lib/money";
import { amountUsdCents } from "@/lib/platform-fees";

type Tx = Prisma.TransactionClient;

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
    amountCents: number;
    currency: string;
    kind: "SALE" | "SHIPPING" | "WITHDRAWAL";
    orderId?: string | null;
    withdrawalId?: string | null;
    shopId?: string | null;
    courierId?: string | null;
    actorUserId?: string | null;
    fx?: ReturnType<typeof shopFxRates>;
  },
) {
  if (input.amountCents <= 0) return null;
  const currency = parseCurrency(input.currency);
  const fx = input.fx ?? shopFxRates();
  const usd = amountUsdCents(input.amountCents, currency, fx);
  await ensureTreasury(tx);
  const row = await tx.platformTreasury.update({
    where: { id: "chipshop" },
    data: { [treasuryKey(currency)]: { increment: input.amountCents } },
  });
  const fee = await tx.platformFee.create({
    data: {
      kind: input.kind,
      amountCents: input.amountCents,
      currency,
      amountUsdCents: usd,
      orderId: input.orderId ?? null,
      withdrawalId: input.withdrawalId ?? null,
      shopId: input.shopId ?? null,
      courierId: input.courierId ?? null,
    },
  });
  await tx.paymentAudit.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      actorType: "SYSTEM",
      action: `PLATFORM_FEE_${input.kind}`,
      detail: {
        feeId: fee.id,
        amountCents: input.amountCents,
        currency,
        orderId: input.orderId ?? null,
        withdrawalId: input.withdrawalId ?? null,
      },
    },
  });
  return { fee, treasury: row };
}

export async function reverseSaleFee(tx: Tx, orderId: string) {
  const fee = await tx.platformFee.findUnique({
    where: { orderId_kind: { orderId, kind: "SALE" } },
  });
  if (!fee || fee.reversedAt) return null;
  const currency = parseCurrency(fee.currency);
  await ensureTreasury(tx);
  await tx.platformTreasury.update({
    where: { id: "chipshop" },
    data: { [treasuryKey(currency)]: { decrement: fee.amountCents } },
  });
  await tx.platformFee.update({
    where: { id: fee.id },
    data: { reversedAt: new Date() },
  });
  await tx.paymentAudit.create({
    data: {
      actorType: "SYSTEM",
      action: "PLATFORM_FEE_SALE_REVERSE",
      detail: { feeId: fee.id, orderId, amountCents: fee.amountCents, currency },
    },
  });
  return fee;
}
