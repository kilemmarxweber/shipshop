import type { AppCurrency, WalletBalances } from "@/lib/money";
import { parseCurrency, walletCents, walletCreditData } from "@/lib/money";

export type WalletBucketName = "BUYER" | "VENDOR" | "COURIER";

export type BucketWallet = {
  usdCents?: number | null;
  cdfCents?: number | null;
  kwCents?: number | null;
  balanceCents?: number | null;
  currency?: string | null;
  buyerUsdCents?: number | null;
  vendorUsdCents?: number | null;
  courierUsdCents?: number | null;
  buyerCdfCents?: number | null;
  vendorCdfCents?: number | null;
  courierCdfCents?: number | null;
  buyerKwCents?: number | null;
  vendorKwCents?: number | null;
  courierKwCents?: number | null;
};

function bucketField(bucket: WalletBucketName, currency: AppCurrency) {
  const cur = currency === "CDF" ? "Cdf" : currency === "KW" ? "Kw" : "Usd";
  const b =
    bucket === "BUYER" ? "buyer" : bucket === "VENDOR" ? "vendor" : "courier";
  return `${b}${cur}Cents` as const;
}

function asBalances(wallet: BucketWallet): WalletBalances {
  return {
    usdCents: wallet.usdCents ?? undefined,
    cdfCents: wallet.cdfCents ?? undefined,
    kwCents: wallet.kwCents ?? undefined,
    balanceCents: wallet.balanceCents ?? undefined,
    currency: wallet.currency,
  };
}

function numericPatch(
  patch: ReturnType<typeof walletCreditData>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === "number") out[key] = value;
  }
  return out;
}

function storedBucket(
  wallet: BucketWallet,
  bucket: WalletBucketName,
  currency: AppCurrency,
) {
  return Math.max(
    0,
    Number(wallet[bucketField(bucket, currency) as keyof BucketWallet] ?? 0),
  );
}

export function materializedBuckets(wallet: BucketWallet, currency?: string | null) {
  const code = parseCurrency(currency);
  const buyer = storedBucket(wallet, "BUYER", code);
  const vendor = storedBucket(wallet, "VENDOR", code);
  const courier = storedBucket(wallet, "COURIER", code);
  if (buyer + vendor + courier === 0) {
    return { BUYER: walletCents(asBalances(wallet), code), VENDOR: 0, COURIER: 0 };
  }
  return { BUYER: buyer, VENDOR: vendor, COURIER: courier };
}

export function getBucketCents(
  wallet: BucketWallet,
  bucket: WalletBucketName,
  currency?: string | null,
) {
  return materializedBuckets(wallet, currency)[bucket];
}

export function applyBucketDelta(
  wallet: BucketWallet,
  currency: AppCurrency,
  delta: number,
  bucket: WalletBucketName,
) {
  const nextTotal = walletCents(asBalances(wallet), currency) + delta;
  const buckets = materializedBuckets(wallet, currency);
  const nextBucket = buckets[bucket] + delta;
  if (nextTotal < 0 || nextBucket < 0) {
    throw new Error("Solde du pot insuffisant");
  }
  buckets[bucket] = nextBucket;
  return {
    ...numericPatch(
      walletCreditData(asBalances(wallet), currency, nextTotal, {
        setDisplay: false,
      }),
    ),
    [bucketField("BUYER", currency)]: buckets.BUYER,
    [bucketField("VENDOR", currency)]: buckets.VENDOR,
    [bucketField("COURIER", currency)]: buckets.COURIER,
  };
}

/** Débite un montant dans une devise en puisant BUYER → VENDOR → COURIER. */
export function drainBucketsData(
  wallet: BucketWallet,
  currency: AppCurrency,
  amountCents: number,
  order: WalletBucketName[] = ["BUYER", "VENDOR", "COURIER"],
) {
  let remaining = Math.max(0, amountCents);
  const data: Record<string, number> = {
    ...numericPatch(
      walletCreditData(
        asBalances(wallet),
        currency,
        walletCents(asBalances(wallet), currency) - remaining,
        { setDisplay: false },
      ),
    ),
  };
  const snapshot = materializedBuckets(wallet, currency);
  for (const bucket of order) {
    if (remaining <= 0) break;
    const take = Math.min(snapshot[bucket], remaining);
    snapshot[bucket] -= take;
    remaining -= take;
  }
  if (remaining > 0) {
    throw new Error("Solde insuffisant");
  }
  data[bucketField("BUYER", currency)] = snapshot.BUYER;
  data[bucketField("VENDOR", currency)] = snapshot.VENDOR;
  data[bucketField("COURIER", currency)] = snapshot.COURIER;
  return data;
}
