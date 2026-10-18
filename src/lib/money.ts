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
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
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
