import type { AppCurrency, FxRates } from "@/lib/money";
import { fromUsdCents, parseCurrency, shopFxRates, toUsdCents } from "@/lib/money";

export const SALE_FEE_USD_CENTS = 50;
export const SHIPPING_FEE_USD_CENTS = 50;
export const WITHDRAWAL_FEE_BPS = 500; // 5%
export const MIN_WITHDRAWAL_USD_CENTS = 100;

export function saleFeeCents(
  priceCents: number,
  currency?: string | null,
  fx?: FxRates,
) {
  const code = parseCurrency(currency);
  const rates = fx ?? shopFxRates();
  const cap = Math.max(0, priceCents);
  const fee = fromUsdCents(SALE_FEE_USD_CENTS, code, rates);
  return Math.min(cap, fee);
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
) {
  return Math.max(0, priceCents - saleFeeCents(priceCents, currency, fx));
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
