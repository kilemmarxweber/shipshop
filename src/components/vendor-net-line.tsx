import { DEFAULT_FX, parseCurrency } from "@/lib/money";
import { saleFeeCents, vendorNetCents } from "@/lib/platform-fees";
import { formatMoney } from "@/lib/utils";

export function VendorNetLine({
  priceCents,
  currency,
  className,
}: {
  priceCents: number;
  currency?: string | null;
  className?: string;
}) {
  const code = parseCurrency(currency);
  const fee = saleFeeCents(priceCents, code, DEFAULT_FX);
  const net = vendorNetCents(priceCents, code, DEFAULT_FX);
  return (
    <p className={className ?? "text-[11px] leading-snug text-muted-foreground"}>
      Prix {formatMoney(priceCents, code)} · Vous encaissez{" "}
      <span className="font-semibold text-trust">{formatMoney(net, code)}</span>
      {" · "}
      ShipShop {formatMoney(fee, code)} (5 %)
    </p>
  );
}
