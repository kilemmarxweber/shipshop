import type { Prisma } from "@/generated/prisma/client";
import { amountUsdCents } from "@/lib/platform-fees";

const COMPLETED = ["DELIVERED", "PICKED_UP"] as const;

type Tx = Prisma.TransactionClient;

export function monthUtcRange(at = new Date()) {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
  return { start, end };
}

/** GMV mensuel boutique (USD) pour les paliers de commission. */
export async function shopMonthGmvUsdCents(tx: Tx, shopId: string, at = new Date()) {
  const { start, end } = monthUtcRange(at);
  const rows = await tx.order.findMany({
    where: {
      shopId,
      status: { in: [...COMPLETED] },
      createdAt: { gte: start, lt: end },
    },
    select: {
      productCents: true,
      product: { select: { currency: true } },
      shop: { select: { fxCdfPerUsd: true, fxKwPerUsd: true } },
    },
  });
  let usd = 0;
  for (const row of rows) {
    usd += amountUsdCents(row.productCents, row.product.currency, {
      cdfPerUsd: row.shop.fxCdfPerUsd,
      kwPerUsd: row.shop.fxKwPerUsd,
    });
  }
  return usd;
}
