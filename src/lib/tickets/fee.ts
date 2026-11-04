import { parseCurrency, type AppCurrency } from "@/lib/money";

export type TicketFeeMode = "PERCENT" | "FLAT";

export function platformTicketCut(input: {
  priceCents: number;
  mode: TicketFeeMode | string;
  bps: number;
  flatCents: number;
}) {
  const price = Math.max(0, Math.floor(input.priceCents));
  if (price <= 0) return { platformFeeCents: 0, organizerCents: 0 };
  const platformFeeCents =
    input.mode === "FLAT"
      ? Math.min(price, Math.max(0, Math.floor(input.flatCents)))
      : Math.min(
          price,
          Math.floor((price * Math.max(0, Math.floor(input.bps))) / 10_000),
        );
  return {
    platformFeeCents,
    organizerCents: price - platformFeeCents,
  };
}

export function eventCurrency(value: string | null | undefined): AppCurrency {
  return parseCurrency(value);
}

export function isSalesWindowOpen(event: {
  status: string;
  salesStartsAt?: Date | null;
  salesEndsAt?: Date | null;
}) {
  if (event.status !== "ON_SALE") return false;
  const now = Date.now();
  if (event.salesStartsAt && event.salesStartsAt.getTime() > now) return false;
  if (event.salesEndsAt && event.salesEndsAt.getTime() < now) return false;
  return true;
}

export function isAccessWindowOpen(event: {
  status: string;
  accessStartsAt?: Date | null;
  accessEndsAt?: Date | null;
  startsAt: Date;
  endsAt: Date;
}) {
  if (event.status === "CANCELLED") return false;
  const now = Date.now();
  const start = event.accessStartsAt ?? event.startsAt;
  const end = event.accessEndsAt ?? event.endsAt;
  if (start.getTime() - 30 * 60 * 1000 > now) return false;
  if (end.getTime() + 2 * 60 * 60 * 1000 < now) return false;
  return true;
}
