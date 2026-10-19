export const APP_CURRENCIES = ["CDF", "USD", "KW"] as const;
export type AppCurrency = (typeof APP_CURRENCIES)[number];

export function isAppCurrency(value: string | null | undefined): value is AppCurrency {
  return APP_CURRENCIES.includes((value ?? "") as AppCurrency);
}

export function parseCurrency(value: string | null | undefined): AppCurrency {
  return isAppCurrency(value) ? value : "USD";
}

export function formatMoney(cents: number, currency: string = "USD") {
  const code = parseCurrency(currency);
  const amount = Number.isFinite(cents) ? cents / 100 : 0;
  const formatted = new Intl.NumberFormat("fr-CD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  if (code === "USD") return `${formatted} $US`;
  if (code === "CDF") return `${formatted} CDF`;
  return `${formatted} KW`;
}

export function walletCentsKey(
  currency: AppCurrency,
): "cdfCents" | "usdCents" | "kwCents" {
  if (currency === "CDF") return "cdfCents";
  if (currency === "KW") return "kwCents";
  return "usdCents";
}

export type WalletBalances = {
  balanceCents?: number;
  currency?: string | null;
  usdCents?: number;
  cdfCents?: number;
  kwCents?: number;
};

export function walletCents(wallet: WalletBalances, currency?: string | null) {
  const code = parseCurrency(currency ?? wallet.currency);
  if (code === "CDF") return wallet.cdfCents ?? 0;
  if (code === "KW") return wallet.kwCents ?? 0;
  return wallet.usdCents ?? wallet.balanceCents ?? 0;
}

export function walletCreditData(
  wallet: WalletBalances,
  currency: AppCurrency,
  nextCents: number,
  opts?: { setDisplay?: boolean },
) {
  const key = walletCentsKey(currency);
  return {
    [key]: nextCents,
    ...(currency === "USD" ? { balanceCents: nextCents } : {}),
    ...(opts?.setDisplay !== false ? { currency } : {}),
  };
}

export type FxRates = {
  cdfPerUsd: number;
  kwPerUsd: number;
};

export const DEFAULT_FX: FxRates = {
  cdfPerUsd: Math.max(
    1,
    Number.parseInt(process.env.FX_CDF_PER_USD ?? "2400", 10) || 2400,
  ),
  kwPerUsd: Math.max(
    1,
    Number.parseInt(process.env.FX_KW_PER_USD ?? "1", 10) || 1,
  ),
};

export function parseFxRate(value: unknown, fallback: number) {
  const n =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(100_000, Math.round(n));
}

export function shopFxRates(shop?: {
  fxCdfPerUsd?: number | null;
  fxKwPerUsd?: number | null;
} | null): FxRates {
  return {
    cdfPerUsd: parseFxRate(shop?.fxCdfPerUsd, DEFAULT_FX.cdfPerUsd),
    kwPerUsd: parseFxRate(shop?.fxKwPerUsd, DEFAULT_FX.kwPerUsd),
  };
}

export function unitsPerUsd(
  currency: AppCurrency,
  fx: FxRates = DEFAULT_FX,
): number {
  if (currency === "CDF") return fx.cdfPerUsd;
  if (currency === "KW") return fx.kwPerUsd;
  return 1;
}

export function toUsdCents(
  amountCents: number,
  currency?: string | null,
  fx: FxRates = DEFAULT_FX,
) {
  const rate = unitsPerUsd(parseCurrency(currency), fx);
  if (rate === 1) return Math.max(0, amountCents);
  return Math.floor(Math.max(0, amountCents) / rate);
}

/** USD cents needed to cover `amountCents` in `currency` (arrondi supérieur). */
export function usdCentsNeeded(
  amountCents: number,
  currency?: string | null,
  fx: FxRates = DEFAULT_FX,
) {
  const rate = unitsPerUsd(parseCurrency(currency), fx);
  if (rate === 1) return Math.max(0, amountCents);
  return Math.ceil(Math.max(0, amountCents) / rate);
}

export function fromUsdCents(
  usdCents: number,
  currency?: string | null,
  fx: FxRates = DEFAULT_FX,
) {
  const rate = unitsPerUsd(parseCurrency(currency), fx);
  return Math.max(0, usdCents) * rate;
}

export function convertCents(
  amountCents: number,
  from: string | null | undefined,
  to: string | null | undefined,
  fx: FxRates = DEFAULT_FX,
) {
  const src = parseCurrency(from);
  const dest = parseCurrency(to);
  if (src === dest) return Math.max(0, amountCents);
  return fromUsdCents(toUsdCents(amountCents, src, fx), dest, fx);
}

export function walletUsdCents(
  wallet: WalletBalances,
  fx: FxRates = DEFAULT_FX,
) {
  return (
    toUsdCents(walletCents(wallet, "USD"), "USD", fx) +
    toUsdCents(walletCents(wallet, "CDF"), "CDF", fx) +
    toUsdCents(walletCents(wallet, "KW"), "KW", fx)
  );
}

/** Solde toutes poches, exprimé dans `currency`. */
export function walletEquivalentCents(
  wallet: WalletBalances,
  currency?: string | null,
  fx: FxRates = DEFAULT_FX,
) {
  return fromUsdCents(walletUsdCents(wallet, fx), parseCurrency(currency), fx);
}
