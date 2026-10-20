"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Package } from "lucide-react";
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

type NoticeRow = {
  id: string;
  title?: string;
  body?: string;
  href?: string | null;
  orderId?: string;
  status?: string;
  product?: { title?: string; images?: string[] };
  shop?: { name?: string };
};

function fromNotices(notices: NoticeRow[]): PendingOrder[] {
  return notices.flatMap((notice) => {
    const id =
      notice.orderId ??
      (notice.href?.startsWith("/orders/")
        ? notice.href.slice("/orders/".length)
        : notice.id.startsWith("order-")
          ? notice.id.slice("order-".length)
          : "");
    if (!id) return [];
    const title =
      notice.product?.title ??
      notice.body?.split(" · ").slice(1).join(" · ") ??
      notice.title ??
      "Colis";
    return [
      {
        id,
        status: notice.status ?? "PAID",
        product: {
          title,
          images: notice.product?.images ?? [],
        },
        shop: { name: notice.shop?.name ?? notice.body?.split(" · ")[0] ?? "" },
      },
    ];
  });
}

function mergeOrders(primary: PendingOrder[], extra: PendingOrder[]) {
  const seen = new Set(primary.map((row) => row.id));
  const next = [...primary];
  for (const row of extra) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    next.push(row);
  }
  next.sort((a, b) =>
    a.status === "AWAITING_CONFIRM"
      ? -1
      : b.status === "AWAITING_CONFIRM"
        ? 1
        : 0,
  );
  return next.slice(0, 8);
}

export function PendingBuyerOrders() {
  const { data: session } = authClient.useSession();
  const { t } = useI18n();
  const [orders, setOrders] = useState<PendingOrder[]>([]);

  useEffect(() => {
    if (!session?.user?.id) {
      setOrders([]);
      return;
    }

    let cancelled = false;

    async function load() {
      const [{ res, data }, noticesRes] = await Promise.all([
        fetchJson<{ orders?: PendingOrder[] }>(
          "/api/orders?period=all&status=active",
        ),
        fetchJson<{ notices?: NoticeRow[] }>("/api/notices"),
      ]);
      if (cancelled) return;
      const fromOrders = (res.ok ? (data?.orders ?? []) : []).filter((row) =>
        VISIBLE.has(row.status),
      );
      const fromBell = fromNotices(noticesRes.data?.notices ?? []).filter(
        (row) => VISIBLE.has(row.status) || !row.status,
      );
      setOrders(mergeOrders(fromOrders, fromBell));
    }

    void load();
    const poll = window.setInterval(() => void load(), 8000);
    const onShow = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [session?.user?.id]);

  if (!session?.user?.id || orders.length === 0) return null;

  return (
    <div className="z-30 shrink-0 border-b border-amber-500/25 bg-amber-500/10 px-3 py-2">
      <p className="text-[10px] font-bold tracking-wide text-amber-300 uppercase">
        Tes colis
      </p>
      <ul className="mt-1.5 flex gap-2 overflow-x-auto pb-0.5">
        {orders.map((order) => (
          <li key={order.id} className="shrink-0">
            <Link
              href={`/orders/${order.id}`}
              className="flex w-40 items-center gap-2 rounded-xl border border-amber-500/30 bg-black/20 px-2 py-1.5"
            >
              {order.product.images[0] ? (
                <div
                  className="size-9 shrink-0 rounded-lg bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${order.product.images[0]})`,
                  }}
                />
              ) : (
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/20 text-amber-200">
                  <Package className="size-4" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold">
                  {order.product.title}
                </p>
                <p className="truncate text-[10px] text-amber-200">
                  {orderStatusLabel(t, order.status)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
