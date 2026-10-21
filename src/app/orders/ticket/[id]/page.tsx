"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { qrImageUrl } from "@/lib/handover";
import { formatMoney } from "@/lib/utils";
import { usePageBack } from "@/components/back-nav-context";
import { PageLoader } from "@/components/page-loader";
import { ShopHoursNotice } from "@/components/shop-hours-notice";
import { useI18n } from "@/components/i18n-provider";
import type { ShopHoursFields } from "@/lib/shop-hours";

type Ticket = {
  id: string;
  code: string;
  qrPayload: string;
  completedAt: string | null;
  shop: { id: string; name: string; slug: string } & ShopHoursFields;
  orders: {
    id: string;
    status: string;
    productCents?: number;
    shippingCents?: number;
    saleFeeCents?: number;
    shippingFeeCents?: number;
    product: { title: string; images: string[]; priceCents: number };
    pickupReceipt: {
      scannedAt: string | null;
      redeemedAt: string | null;
      qrPayload?: string | null;
    } | null;
  }[];
};

export default function ShopTicketPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);

  usePageBack({ fallbackHref: "/profile" });

  useEffect(() => {
    fetchJson<{ handover?: Ticket; error?: string }>(`/api/handovers/${id}`)
      .then(({ res, data }) => {
        if (!res.ok) {
          setError(data?.error ?? "QR introuvable");
          return;
        }
        setTicket(data?.handover ?? null);
      })
      .catch(() => setError("QR introuvable"));
  }, [id]);

  if (!ticket && !error) return <PageLoader />;
  if (error || !ticket) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        {error}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-10 pt-2">
      <h1 className="font-heading text-lg font-bold">{t("buy.shopQr")}</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        @{ticket.shop.name} — {t("buy.qrUntilLast")}
      </p>
      <ShopHoursNotice hours={ticket.shop} className="mt-2" />
      <div className="mt-4 rounded-2xl border border-primary/30 bg-surface p-5 text-center">
        <div className="mb-3 flex items-center justify-center gap-2 text-primary">
          <QrCode className="size-4" />
          <span className="text-xs font-bold uppercase">{ticket.code}</span>
        </div>
        {ticket.completedAt ? (
          <p className="py-8 text-sm font-semibold text-trust">
            Boutique terminée — plus d’article à remettre ici
          </p>
        ) : null}
        <ul className="mt-4 space-y-3 text-left">
          {ticket.orders.map((item) => {
            const done =
              Boolean(item.pickupReceipt?.redeemedAt) ||
              ["DELIVERED", "PICKED_UP", "CANCELLED", "REFUNDED"].includes(
                item.status,
              );
            const scanned = Boolean(item.pickupReceipt?.scannedAt);
            const payload = item.pickupReceipt?.qrPayload ?? ticket.qrPayload;
            return (
              <li
                key={item.id}
                className="rounded-xl border border-border px-3 py-2"
              >
                <Link
                  href={`/orders/${item.id}`}
                  className="flex items-center gap-2"
                >
                  <div
                    className="size-10 shrink-0 rounded-lg bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${item.product.images[0] ?? ""})`,
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {item.product.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {done
                      ? "Payé"
                      : scanned
                        ? "À confirmer"
                        : "À remettre"}
                  </span>
                </Link>
                <p className="pb-2 pt-1 text-[10px] text-muted-foreground">
                  Vendeur{" "}
                  {formatMoney(
                    Math.max(
                      0,
                      (item.productCents ?? item.product.priceCents) -
                        (item.saleFeeCents ?? 0),
                    ),
                  )}{" "}
                  · ce produit seulement
                </p>
                {!done && !scanned && payload ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrImageUrl(payload, 180)}
                    alt={`QR ${item.product.title}`}
                    width={180}
                    height={180}
                    className="mx-auto rounded-xl bg-white p-2"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
