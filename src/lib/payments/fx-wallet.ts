import type { Prisma } from "@/generated/prisma/client";
import {
  APP_CURRENCIES,
  fromUsdCents,
  parseCurrency,
  shopFxRates,
  toUsdCents,
  usdCentsNeeded,
  walletCents,
  walletEquivalentCents,
  type AppCurrency,
  type FxRates,
} from "@/lib/money";
import {
  applyBucketDelta,
  drainBucketsData,
  type BucketWallet,
} from "@/lib/wallet-buckets";

type Tx = Prisma.TransactionClient;

export type FxConversion = {
  from: AppCurrency;
  fromCents: number;
  to: AppCurrency;
  toCents: number;
  usdCents: number;
};

/** Débite le portefeuille en multi-devises (comme le checkout boutique). */
export async function debitWalletWithFx(
  tx: Tx,
  userId: string,
  payCurrency: string,
  amountCents: number,
  fxInput: { fxCdfPerUsd?: number | null; fxKwPerUsd?: number | null } | null,
  reference: string,
) {
  const currency = parseCurrency(payCurrency);
  const fx: FxRates = shopFxRates(fxInput);
  const totalCents = Math.max(0, Math.floor(amountCents));
  if (totalCents <= 0) {
    throw new Error("Montant invalide");
  }

  const walletRow = await tx.wallet.findUnique({ where: { userId } });
  if (!walletRow) throw new Error("Portefeuille introuvable");
  await tx.wallet.update({
    where: { id: walletRow.id },
    data: { updatedAt: new Date() },
    select: { id: true },
  });
  const wallet = await tx.wallet.findUnique({ where: { id: walletRow.id } });
  if (!wallet) throw new Error("Portefeuille introuvable");

  const pockets: Record<AppCurrency, number> = {
    USD: walletCents(wallet, "USD"),
    CDF: walletCents(wallet, "CDF"),
    KW: walletCents(wallet, "KW"),
  };
  const conversions: FxConversion[] = [];

  let remaining = Math.max(0, totalCents - pockets[currency]);
  if (remaining > 0) {
    const sources = APP_CURRENCIES.filter((code) => code !== currency);
    for (const src of sources) {
      if (remaining <= 0) break;
      const have = pockets[src];
      if (have <= 0) continue;
      const needUsd = usdCentsNeeded(remaining, currency, fx);
      const haveUsd = toUsdCents(have, src, fx);
      const takeUsd = Math.min(needUsd, haveUsd);
      if (takeUsd <= 0) continue;
      const fromCents = fromUsdCents(takeUsd, src, fx);
      const toCents = fromUsdCents(takeUsd, currency, fx);
      if (fromCents <= 0 || toCents <= 0) continue;
      pockets[src] -= fromCents;
      pockets[currency] += toCents;
      remaining = Math.max(0, remaining - toCents);
      conversions.push({
        from: src,
        fromCents,
        to: currency,
        toCents,
        usdCents: takeUsd,
      });
    }
  }

  if (pockets[currency] < totalCents) {
    throw new Error("Solde insuffisant");
  }

  for (const row of conversions) {
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "ADJUSTMENT",
        amountCents: -row.fromCents,
        currency: row.from,
        balanceAfterCents: pockets[row.from],
        provider: "INTERNAL",
        status: "SUCCESS",
        reference,
        metadata: {
          fx: true,
          from: row.from,
          to: row.to,
          fromCents: row.fromCents,
          toCents: row.toCents,
          usdCents: row.usdCents,
          cdfPerUsd: fx.cdfPerUsd,
          kwPerUsd: fx.kwPerUsd,
        },
      },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "ADJUSTMENT",
        amountCents: row.toCents,
        currency: row.to,
        balanceAfterCents: pockets[row.to],
        provider: "INTERNAL",
        status: "SUCCESS",
        reference,
        metadata: {
          fx: true,
          from: row.from,
          to: row.to,
          fromCents: row.fromCents,
          toCents: row.toCents,
          usdCents: row.usdCents,
          cdfPerUsd: fx.cdfPerUsd,
          kwPerUsd: fx.kwPerUsd,
        },
      },
    });
  }

  pockets[currency] -= totalCents;
  const originalPockets: Record<AppCurrency, number> = {
    USD: walletCents(wallet, "USD"),
    CDF: walletCents(wallet, "CDF"),
    KW: walletCents(wallet, "KW"),
  };
  let bucketData: Record<string, number> = {};
  let working: BucketWallet = { ...wallet };
  for (const code of APP_CURRENCIES) {
    const delta = originalPockets[code] - pockets[code];
    if (delta > 0) {
      bucketData = {
        ...bucketData,
        ...drainBucketsData(working, code, delta),
      };
      working = { ...working, ...bucketData };
    } else if (delta < 0) {
      const credit = applyBucketDelta(working, code, -delta, "BUYER");
      bucketData = { ...bucketData, ...credit };
      working = { ...working, ...credit };
    }
  }

  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      ...bucketData,
      currency,
    },
  });

  return {
    wallet,
    nextCents: pockets[currency],
    currency,
    chargedCents: totalCents,
    conversions,
    fx,
    equivalentCents: walletEquivalentCents(wallet, currency, fx),
  };
}
