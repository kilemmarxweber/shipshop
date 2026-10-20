"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { useI18n } from "@/components/i18n-provider";
import { orderStatusLabel } from "@/lib/order-status-label";

type PendingOrder = {
  id: string;
  status: string;
  product: { title: string; images: string[] };
  shop: { name: string };
};

const VISIBLE = new Set([
  "PAID",
  "ASSIGNED",
  "FULFILLING",
  "OUT_FOR_DELIVERY",
  "READY_FOR_PICKUP",
  "AWAITING_CONFIRM",
]);

export function PendingBuyerOrders() {
  const { data: session } = authClient.useSession();
  const { t } = useI18n();
  const [orders, setOrders] = useState<PendingOrder[]>([]);

  useEffect(() => {
    if (!session?.user?.id) {
      setOrders([]);
      return;
    }
    void fetchJson<{ orders?: PendingOrder[] }>(
      "/api/orders?period=all&status=active",
    ).then(({ res, data }) => {
      if (!res.ok) return;
      const list = (data?.orders ?? []).filter((o) => VISIBLE.has(o.status));
      list.sort((a, b) =>
        a.status === "AWAITING_CONFIRM" ? -1 : b.status === "AWAITING_CONFIRM" ? 1 : 0,
      );
      setOrders(list.slice(0, 8));
    });
  }, [session?.user?.id]);

  if (!session?.user?.id || orders.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-amber-500/25 bg-amber-500/10 px-3 py-2">
      <p className="text-[10px] font-bold tracking-wide text-amber-300 uppercase">
        Tes colis
      </p>
      <ul className="mt-1.5 flex gap-2 overflow-x-auto pb-0.5">
        {orders.map((o) => (
          <li key={o.id} className="shrink-0">
            <Link
              href={`/orders/${o.id}`}
              className="flex w-40 items-center gap-2 rounded-xl border border-amber-500/30 bg-black/20 px-2 py-1.5"
            >
              <div
                className="size-9 shrink-0 rounded-lg bg-cover bg-center"
                style={{
                  backgroundImage: o.product.images[0]
                    ? `url(${o.product.images[0]})`
                    : undefined,
                }}
              />
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold">
                  {o.product.title}
                </p>
                <p className="truncate text-[10px] text-amber-200">
                  {orderStatusLabel(t, o.status)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
