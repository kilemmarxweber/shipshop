import type { AppCurrency, FxRates } from "@/lib/money";
import { fromUsdCents, parseCurrency, shopFxRates, toUsdCents } from "@/lib/money";

/** @deprecated Frais plat historique — la commission vente est un %. */
export const SALE_FEE_USD_CENTS = 50;
export const SHIPPING_FEE_USD_CENTS = 50;
export const WITHDRAWAL_FEE_BPS = 500; // 5%
export const MIN_WITHDRAWAL_USD_CENTS = 100;

/** Commission cible initiale (5 %). Hors paiement / livraison / taxes. */
export const SALE_FEE_BPS_DEFAULT = 500;

/** Paliers volume mensuel vendeur (GMV USD) — prêts, à A/B tester. */
export const SALE_FEE_VOLUME_TIERS: { maxGmvUsdCents: number; bps: number }[] = [
  { maxGmvUsdCents: 50_000, bps: 500 },
  { maxGmvUsdCents: 250_000, bps: 450 },
  { maxGmvUsdCents: 1_000_000, bps: 400 },
  { maxGmvUsdCents: Number.POSITIVE_INFINITY, bps: 350 },
];

export function saleFeeBpsForMonthlyGmvUsd(gmvUsdCents: number) {
  const gmv = Math.max(0, gmvUsdCents);
  for (const tier of SALE_FEE_VOLUME_TIERS) {
    if (gmv <= tier.maxGmvUsdCents) return tier.bps;
  }
  return SALE_FEE_BPS_DEFAULT;
}

export function saleFeeCents(
  priceCents: number,
  currency?: string | null,
  fx?: FxRates,
  monthlyGmvUsdCents = 0,
) {
  const cap = Math.max(0, priceCents);
  const bps = saleFeeBpsForMonthlyGmvUsd(monthlyGmvUsdCents);
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
) {
  if (shippingCents <= 0) return 0;
  const code = parseCurrency(currency);
  const rates = fx ?? shopFxRates();
  const cap = Math.max(0, shippingCents);
  const fee = fromUsdCents(SHIPPING_FEE_USD_CENTS, code, rates);
  return Math.min(cap, fee);
}

export function vendorNetCents(
  priceCents: number,
  currency?: string | null,
  fx?: FxRates,
  monthlyGmvUsdCents = 0,
  creatorBps = 0,
) {
  const sale = saleFeeCents(priceCents, currency, fx, monthlyGmvUsdCents);
  const creator = creatorFeeCents(priceCents, creatorBps);
  return Math.max(0, priceCents - sale - creator);
}

export function courierNetCents(
  shippingCents: number,
  currency?: string | null,
  fx?: FxRates,
) {
  if (shippingCents <= 0) return 0;
  return Math.max(0, shippingCents - shippingFeeCents(shippingCents, currency, fx));
}

export function withdrawalFeeCents(grossCents: number, bucket: "BUYER" | "VENDOR" | "COURIER") {
  if (bucket === "VENDOR") return 0;
  return Math.floor(Math.max(0, grossCents) * WITHDRAWAL_FEE_BPS / 10_000);
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
