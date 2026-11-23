import type { AppCurrency, FxRates } from "@/lib/money";
import { parseCurrency, shopFxRates, toUsdCents } from "@/lib/money";

/** @deprecated Frais plat historique — la commission vente est un %. */
export const SALE_FEE_USD_CENTS = 50;
/** @deprecated Remplacé par shippingFeeBps (défaut 10 %). */
export const SHIPPING_FEE_USD_CENTS = 50;
export const WITHDRAWAL_FEE_BPS = 500; // 5% défaut
export const CINETPAY_COST_BPS_DEFAULT = 300; // 3%
export const SHIPPING_FEE_BPS_DEFAULT = 1000; // 10%
/** 5.00 in the currency the user chose. Not converted between USD and local money. */
export const MIN_CASH_MOVE_CENTS = 500;
export const MIN_WITHDRAWAL_USD_CENTS = MIN_CASH_MOVE_CENTS;
export const FEE_BPS_MAX = 5000;

export function minCashMoveLabel(currency?: string | null) {
  if (currency === "CDF") return "Minimum 5 CDF";
  if (currency === "KW") return "Minimum 5 KW";
  return "Minimum 5 $US";
}

/** Commission cible initiale (5 %). Hors paiement / livraison / taxes. */
export const SALE_FEE_BPS_DEFAULT = 500;

export type PlatformFeeSettingsRow = {
  id: string;
  depositFeeBps: number;
  depositCinetPayBps: number;
  withdrawFeeBps: number;
  withdrawCinetPayBps: number;
  transferExternalFeeBps: number;
  transferExternalCinetPayBps: number;
  transferInternalFeeBps: number;
  saleFeeBpsDefault: number;
  shippingFeeBps: number;
  updatedAt: Date;
};

export const DEFAULT_FEE_SETTINGS: PlatformFeeSettingsRow = {
  id: "default",
  depositFeeBps: 500,
  depositCinetPayBps: 300,
  withdrawFeeBps: 500,
  withdrawCinetPayBps: 300,
  transferExternalFeeBps: 500,
  transferExternalCinetPayBps: 300,
  transferInternalFeeBps: 0,
  saleFeeBpsDefault: SALE_FEE_BPS_DEFAULT,
  shippingFeeBps: SHIPPING_FEE_BPS_DEFAULT,
  updatedAt: new Date(0),
};

export function clampFeeBps(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(FEE_BPS_MAX, Math.max(0, Math.round(n)));
}

export function bpsToPct(bps: number) {
  return Math.round(bps) / 100;
}

export function pctToBps(pct: number) {
  return Math.round(pct * 100);
}

export function feeCentsFromBps(grossCents: number, bps: number) {
  if (bps <= 0) return 0;
  return Math.floor(Math.max(0, grossCents) * bps / 10_000);
}

/** Split cash-move : frais user / coût CinetPay / net ShipShop. */
export function splitCashMoveFee(grossCents: number, feeBps: number, providerBps: number) {
  const gross = Math.max(0, grossCents);
  const grossFeeCents = feeCentsFromBps(gross, feeBps);
  const providerCostCents = feeCentsFromBps(gross, providerBps);
  const netAmountCents = Math.max(0, grossFeeCents - providerCostCents);
  const providerLossCents = Math.max(0, providerCostCents - grossFeeCents);
  return {
    grossFeeCents,
    providerCostCents,
    netAmountCents,
    providerLossCents,
    feeBps,
    providerBps,
  };
}

export type CashRail = "deposit" | "withdraw" | "transferExternal" | "transferInternal";

export function railFeeBps(settings: PlatformFeeSettingsRow, rail: CashRail) {
  if (rail === "deposit") return settings.depositFeeBps;
  if (rail === "withdraw") return settings.withdrawFeeBps;
  if (rail === "transferExternal") return settings.transferExternalFeeBps;
  return settings.transferInternalFeeBps;
}

export function railCinetPayBps(settings: PlatformFeeSettingsRow, rail: CashRail) {
  if (rail === "deposit") return settings.depositCinetPayBps;
  if (rail === "withdraw") return settings.withdrawCinetPayBps;
  if (rail === "transferExternal") return settings.transferExternalCinetPayBps;
  return 0;
}

export function publicFeeSettings(settings: PlatformFeeSettingsRow) {
  return {
    depositFeeBps: settings.depositFeeBps,
    depositCinetPayBps: settings.depositCinetPayBps,
    depositFeePct: bpsToPct(settings.depositFeeBps),
    depositCinetPayPct: bpsToPct(settings.depositCinetPayBps),
    withdrawFeeBps: settings.withdrawFeeBps,
    withdrawCinetPayBps: settings.withdrawCinetPayBps,
    withdrawFeePct: bpsToPct(settings.withdrawFeeBps),
    withdrawCinetPayPct: bpsToPct(settings.withdrawCinetPayBps),
    transferExternalFeeBps: settings.transferExternalFeeBps,
    transferExternalCinetPayBps: settings.transferExternalCinetPayBps,
    transferExternalFeePct: bpsToPct(settings.transferExternalFeeBps),
    transferExternalCinetPayPct: bpsToPct(settings.transferExternalCinetPayBps),
    transferInternalFeeBps: settings.transferInternalFeeBps,
    transferInternalFeePct: bpsToPct(settings.transferInternalFeeBps),
    saleFeeBpsDefault: settings.saleFeeBpsDefault,
    saleFeePctDefault: bpsToPct(settings.saleFeeBpsDefault),
    shippingFeeBps: settings.shippingFeeBps,
    shippingFeePct: bpsToPct(settings.shippingFeeBps),
  };
}

/** Paliers volume mensuel vendeur (GMV USD) — prêts, à A/B tester. */
export const SALE_FEE_VOLUME_TIERS: { maxGmvUsdCents: number; bps: number }[] = [
  { maxGmvUsdCents: 50_000, bps: 500 },
  { maxGmvUsdCents: 250_000, bps: 450 },
  { maxGmvUsdCents: 1_000_000, bps: 400 },
  { maxGmvUsdCents: Number.POSITIVE_INFINITY, bps: 350 },
];

export function saleFeeBpsForMonthlyGmvUsd(
  gmvUsdCents: number,
  defaultBps = SALE_FEE_BPS_DEFAULT,
) {
  const gmv = Math.max(0, gmvUsdCents);
  const base = Math.max(0, defaultBps);
  // Paliers relatifs au défaut owner (ex. 5 % → 4.5 / 4 / 3.5).
  const scale = base / SALE_FEE_BPS_DEFAULT;
  for (const tier of SALE_FEE_VOLUME_TIERS) {
    if (gmv <= tier.maxGmvUsdCents) {
      return Math.round(tier.bps * scale);
    }
  }
  return base;
}

export function saleFeeCents(
  priceCents: number,
  currency?: string | null,
  fx?: FxRates,
  monthlyGmvUsdCents = 0,
  feeBpsOverride?: number,
  defaultBps = SALE_FEE_BPS_DEFAULT,
) {
  void currency;
  void fx;
  const cap = Math.max(0, priceCents);
  const bps =
    feeBpsOverride ?? saleFeeBpsForMonthlyGmvUsd(monthlyGmvUsdCents, defaultBps);
  return Math.min(cap, Math.floor((cap * bps) / 10_000));
}

export function creatorFeeCents(priceCents: number, bps: number) {
  if (bps <= 0) return 0;
  const cap = Math.max(0, priceCents);
  return Math.min(cap, Math.floor((cap * bps) / 10_000));
}

export function shippingFeeCents(
  shippingCents: number,
  currency?: string | null,
  fx?: FxRates,
  shippingFeeBps = SHIPPING_FEE_BPS_DEFAULT,
) {
  void currency;
  void fx;
  if (shippingCents <= 0) return 0;
  const cap = Math.max(0, shippingCents);
  return Math.min(cap, feeCentsFromBps(cap, shippingFeeBps));
}

export function vendorNetCents(
  priceCents: number,
  currency?: string | null,
  fx?: FxRates,
  monthlyGmvUsdCents = 0,
  creatorBps = 0,
  feeBpsOverride?: number,
  defaultBps = SALE_FEE_BPS_DEFAULT,
) {
  const sale = saleFeeCents(
    priceCents,
    currency,
    fx,
    monthlyGmvUsdCents,
    feeBpsOverride,
    defaultBps,
  );
  const creator = creatorFeeCents(priceCents, creatorBps);
  return Math.max(0, priceCents - sale - creator);
}

export function courierNetCents(
  shippingCents: number,
  currency?: string | null,
  fx?: FxRates,
  shippingFeeBps = SHIPPING_FEE_BPS_DEFAULT,
) {
  if (shippingCents <= 0) return 0;
  return Math.max(
    0,
    shippingCents - shippingFeeCents(shippingCents, currency, fx, shippingFeeBps),
  );
}

export function withdrawalFeeCents(
  grossCents: number,
  bucket: "BUYER" | "VENDOR" | "COURIER",
  withdrawFeeBps = WITHDRAWAL_FEE_BPS,
) {
  if (bucket === "VENDOR") return 0;
  return feeCentsFromBps(grossCents, withdrawFeeBps);
}

export function amountUsdCents(
  amountCents: number,
  currency?: string | null,
  fx?: FxRates,
) {
  return toUsdCents(amountCents, currency as AppCurrency, fx ?? shopFxRates());
}

export function takeRateBps(gmvCents: number, feeCents: number) {
  if (gmvCents <= 0) return 0;
  return Math.round((feeCents * 10_000) / gmvCents);
}

const TRIP_DONE_STATUSES = new Set([
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "PICKED_UP",
  "AWAITING_CONFIRM",
]);

export function shouldRefundShipping(order: {
  shippingCents: number;
  status: string;
  shippingFeeCents?: number | null;
  shippingFeePending?: boolean | null;
}) {
  if (order.shippingCents <= 0) return false;
  if ((order.shippingFeeCents ?? 0) > 0) return false;
  if (order.shippingFeePending) return false;
  return !TRIP_DONE_STATUSES.has(order.status);
}

export function refundProductCents(order: { productCents: number }) {
  return Math.max(0, order.productCents);
}

export function parseCurrencyCode(currency?: string | null) {
  return parseCurrency(currency);
}
