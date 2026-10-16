"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Package,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney, cn } from "@/lib/utils";

type Period = "7d" | "30d" | "90d" | "all";

type Report = {
  role: "owner" | "vendor";
  period: Period;
  periodLabel: string;
  shops: { id: string; name: string; slug: string }[];
  selectedShopId: string | null;
  summary: {
    soldCents: number;
    vendorGainCents: number;
    platformFeeCents: number;
    shippingCents: number;
    refundedCents: number;
    cancelledCents: number;
    inProgressCents: number;
    soldCount: number;
    refundedCount: number;
    cancelledCount: number;
    inProgressCount: number;
    orderCount: number;
  };
  series: { date: string; label: string; revenueCents: number; orders: number }[];
  weekdayHeat: { day: string; revenueCents: number; orders: number }[];
  hourHeat: { hour: number; label: string; revenueCents: number; orders: number }[];
  insights: {
    peakWeekday: string | null;
    peakWeekdayCents: number;
    peakHour: string | null;
    peakHourCents: number;
    sellThrough: number;
    inventoryValueCents: number;
    soldInventoryCents: number;
  };
  products: {
    id: string;
    title: string;
    shopName: string;
    soldQty: number;
    stockQty: number;
    soldCents: number;
    unsoldCents: number;
    image: string | null;
  }[];
  vendors: {
    shopId: string;
    shopName: string;
    ownerName: string | null;
    soldCents: number;
    gainCents: number;
    profitCents: number;
    orders: number;
    balanceCents: number;
  }[];
  attention: {
    cancelled: AttentionOrder[];
    refunded: AttentionOrder[];
    failed: AttentionOrder[];
    openIssues: {
      id: string;
      orderId: string;
      type: string;
      status: string;
      description: string;
      conversationId: string | null;
      order: {
        totalCents: number;
        product: { title: string };
        shop: { name: string };
        buyer: { name: string };
      };
    }[];
  };
};

type AttentionOrder = {
  id: string;
  status: string;
  totalCents: number;
  productCents: number;
  product: { title: string; images: string[] };
  shop: { id: string; name: string };
  buyer: { name: string };
};

function LineChart({
  series,
}: {
  series: Report["series"];
}) {
  const w = 320;
  const h = 120;
  const pad = 8;
  const max = Math.max(1, ...series.map((s) => s.revenueCents));
  const points = series.map((s, i) => {
    const x =
      pad +
      (series.length <= 1
        ? w / 2
        : (i / (series.length - 1)) * (w - pad * 2));
    const y = h - pad - (s.revenueCents / max) * (h - pad * 2);
    return `${x},${y}`;
  });
  const area = `M ${pad},${h - pad} L ${points.join(" L ")} L ${w - pad},${h - pad} Z`;

  if (series.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
        Pas encore de ventes sur la période
      </p>
    );
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full" role="img">
      <defs>
        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff5722" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff5722" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#revFill)" />
      <polyline
        fill="none"
        stroke="#ff7a45"
        strokeWidth="2"
        points={points.join(" ")}
      />
    </svg>
  );
}

function BarRow({
  label,
  value,
  max,
  accent = "bg-primary",
}: {
  label: string;
  value: number;
  max: number;
  accent?: string;
}) {
  const pct = max <= 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground">{formatMoney(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className={cn("h-full rounded-full transition-all", accent)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { data: session } = authClient.useSession();
  const [period, setPeriod] = useState<Period>("30d");
  const [shopId, setShopId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "products" | "attention">(
    "overview",
  );

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = new URLSearchParams({ period });
    if (shopId) q.set("shopId", shopId);
    fetchJson<Report & { error?: string }>(`/api/reports?${q}`)
      .then(({ res, data }) => {
        if (!res.ok) {
          setReport(null);
          return;
        }
        setReport(data as Report);
      })
      .finally(() => setLoading(false));
  }, [session, period, shopId]);

  const weekdayMax = useMemo(
    () => Math.max(1, ...(report?.weekdayHeat.map((d) => d.revenueCents) ?? [1])),
    [report],
  );
  const hourBusy = useMemo(() => {
    const hours = report?.hourHeat ?? [];
    const max = Math.max(1, ...hours.map((h) => h.orders));
    return hours.filter((h) => h.orders > 0).slice(0, 24).map((h) => ({
      ...h,
      intensity: h.orders / max,
    }));
  }, [report]);

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <Link href="/auth/login" className="text-primary">
          Connexion
        </Link>
      </div>
    );
  }

  const isOwner = report?.role === "owner";

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/shops"
            className="mb-2 inline-flex items-center gap-1 text-xs text-primary"
          >
            <ArrowLeft className="size-3" /> Boutiques
          </Link>
          <h1 className="font-heading text-xl font-bold">
            {isOwner ? "Pilot plateforme" : "Mon rapport vendeur"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isOwner
              ? "Tous les vendeurs · CA, gains, soldes et dossiers à traiter"
              : "Vos boutiques · ventes, stock et pics d'achats"}
          </p>
        </div>
        <div className="h-scroll gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="h-9 shrink-0 rounded-lg border border-white/10 bg-[#1c1c26] px-2 text-xs"
          >
            <option value="7d">7 jours</option>
            <option value="30d">30 jours</option>
            <option value="90d">90 jours</option>
            <option value="all">Tout</option>
          </select>
          {(report?.shops.length ?? 0) > 1 && (
            <select
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              className="h-9 max-w-[160px] rounded-lg border border-white/10 bg-[#1c1c26] px-2 text-xs"
            >
              <option value="">
                {isOwner ? "Toutes boutiques" : "Toutes mes boutiques"}
              </option>
              {report?.shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading || !report ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {loading ? "Chargement du rapport…" : "Aucune donnée"}
        </p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi
              icon={<TrendingUp className="size-4 text-primary" />}
              label="CA remis"
              value={formatMoney(report.summary.soldCents)}
              hint={`${report.summary.soldCount} cmd`}
            />
            <Kpi
              icon={<BarChart3 className="size-4 text-trust" />}
              label={isOwner ? "Frais plateforme" : "Gain vendeur"}
              value={formatMoney(
                isOwner
                  ? report.summary.platformFeeCents
                  : report.summary.vendorGainCents,
              )}
              hint={isOwner ? "protection" : "produits remis"}
            />
            <Kpi
              icon={<Package className="size-4 text-amber-400" />}
              label="Stock non vendu"
              value={formatMoney(report.insights.inventoryValueCents)}
              hint={`${report.insights.sellThrough}% écoulé`}
            />
            <Kpi
              icon={<Wallet className="size-4 text-violet-400" />}
              label="En cours / annulations"
              value={formatMoney(
                report.summary.inProgressCents + report.summary.cancelledCents,
              )}
              hint={`${report.summary.cancelledCount} annul. · ${report.summary.refundedCount} remb.`}
            />
          </div>

          {(report.insights.peakWeekday || report.insights.peakHour) && (
            <div className="mb-4 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-xs">
              <p className="font-bold text-primary">Pics d&apos;achats en ligne</p>
              <p className="mt-1 text-muted-foreground">
                Meilleur jour :{" "}
                <span className="font-semibold text-white">
                  {report.insights.peakWeekday ?? "—"}
                </span>{" "}
                ({formatMoney(report.insights.peakWeekdayCents)}) · Heure
                forte :{" "}
                <span className="font-semibold text-white">
                  {report.insights.peakHour ?? "—"}
                </span>{" "}
                ({formatMoney(report.insights.peakHourCents)})
              </p>
            </div>
          )}

          <div className="mb-4 flex gap-1 rounded-xl border border-white/8 bg-[#13131a] p-1">
            {(
              [
                ["overview", "Vue"],
                ["products", "Produits"],
                ["attention", "À traiter"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "relative flex-1 rounded-lg py-2 text-xs font-semibold",
                  tab === key
                    ? "bg-white/10 text-white"
                    : "text-muted-foreground",
                )}
              >
                {label}
                {key === "attention" &&
                  report.attention.cancelled.length +
                    report.attention.refunded.length +
                    report.attention.openIssues.length >
                    0 && (
                    <span className="absolute top-1 right-2 size-1.5 rounded-full bg-amber-400" />
                  )}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="space-y-4">
              <section className="rounded-2xl border border-white/8 bg-[#13131a] p-4">
                <p className="mb-1 text-xs font-bold">Évolution du CA remis</p>
                <p className="mb-2 text-[10px] text-muted-foreground">
                  {report.periodLabel}
                </p>
                <LineChart series={report.series} />
              </section>

              <section className="rounded-2xl border border-white/8 bg-[#13131a] p-4">
                <p className="mb-3 text-xs font-bold">Par jour de la semaine</p>
                <div className="space-y-2.5">
                  {report.weekdayHeat.map((d) => (
                    <BarRow
                      key={d.day}
                      label={`${d.day} · ${d.orders} cmd`}
                      value={d.revenueCents}
                      max={weekdayMax}
                    />
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-white/8 bg-[#13131a] p-4">
                <p className="mb-3 text-xs font-bold">Heures d&apos;achat</p>
                <div className="grid grid-cols-8 gap-1 sm:grid-cols-12">
                  {hourBusy.map((h) => (
                    <div
                      key={h.hour}
                      title={`${h.label} · ${h.orders} cmd · ${formatMoney(h.revenueCents)}`}
                      className="flex flex-col items-center gap-1"
                    >
                      <div
                        className="w-full rounded-sm bg-primary"
                        style={{
                          height: 28,
                          opacity: 0.15 + h.intensity * 0.85,
                        }}
                      />
                      <span className="text-[8px] text-muted-foreground">
                        {h.hour}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {report.vendors.length > 0 && (
                <section className="rounded-2xl border border-white/8 bg-[#13131a] p-4">
                  <p className="mb-3 text-xs font-bold">
                    {isOwner
                      ? "Vendeurs — gain, bénéfice & solde"
                      : "Mes boutiques"}
                  </p>
                  <ul className="space-y-2">
                    {report.vendors.map((v) => (
                      <li
                        key={v.shopId}
                        className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#0a0a0f]/60 px-3 py-2.5"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 cursor-pointer text-left"
                          onClick={() => setShopId(v.shopId)}
                        >
                          <p className="truncate text-sm font-semibold">
                            {v.shopName}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {v.ownerName ? `${v.ownerName} · ` : ""}
                            {v.orders} ventes · Gain {formatMoney(v.gainCents)}
                          </p>
                        </button>
                        <div className="text-right">
                          <p className="text-xs font-bold text-trust">
                            {formatMoney(v.balanceCents)}
                          </p>
                          <p className="text-[9px] text-muted-foreground">
                            solde
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {tab === "products" && (
            <section className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Montant vendu (période) vs valeur stock restant (qté × prix)
              </p>
              {report.products.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Aucun produit
                </p>
              ) : (
                report.products.map((p) => {
                  const total = Math.max(1, p.soldCents + p.unsoldCents);
                  const soldPct = Math.round((p.soldCents / total) * 100);
                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-white/8 bg-[#13131a] p-3"
                    >
                      <div className="flex gap-3">
                        <div
                          className="size-11 shrink-0 rounded-xl bg-cover bg-center bg-white/5"
                          style={
                            p.image
                              ? { backgroundImage: `url(${p.image})` }
                              : undefined
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {p.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {p.shopName} · {p.soldQty} vendus · {p.stockQty} en
                            stock
                          </p>
                          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="bg-trust"
                              style={{ width: `${soldPct}%` }}
                            />
                            <div
                              className="bg-amber-500/70"
                              style={{ width: `${100 - soldPct}%` }}
                            />
                          </div>
                          <div className="mt-1 flex justify-between text-[10px]">
                            <span className="text-trust">
                              Vendu {formatMoney(p.soldCents)}
                            </span>
                            <span className="text-amber-400">
                              Non vendu {formatMoney(p.unsoldCents)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          )}

          {tab === "attention" && (
            <div className="space-y-4">
              <AttentionBlock
                title="Signalements urgents ouverts"
                empty="Aucun signalement ouvert"
                icon
                count={report.attention.openIssues.length}
              >
                {report.attention.openIssues.map((i) => (
                  <li
                    key={i.id}
                    className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5"
                  >
                    <p className="text-xs font-bold text-amber-400">
                      {i.type} · {i.order.shop.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {i.order.product.title} — {i.order.buyer.name}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        href={`/orders/${i.orderId}`}
                        className="text-[11px] font-semibold text-primary"
                      >
                        Commande →
                      </Link>
                      {i.conversationId && (
                        <Link
                          href={`/messages/${i.conversationId}`}
                          className="text-[11px] font-semibold text-amber-400"
                        >
                          Messages →
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </AttentionBlock>

              <AttentionBlock
                title="Annulations (toujours visibles)"
                empty="Aucune annulation sur la période"
                count={report.attention.cancelled.length}
              >
                {report.attention.cancelled.map((o) => (
                  <AttentionOrderRow key={o.id} order={o} />
                ))}
              </AttentionBlock>

              <AttentionBlock
                title="Remboursements"
                empty="Aucun remboursement sur la période"
                count={report.attention.refunded.length}
              >
                {report.attention.refunded.map((o) => (
                  <AttentionOrderRow key={o.id} order={o} />
                ))}
              </AttentionBlock>

              <AttentionBlock
                title="Livraisons échouées"
                empty="Aucun échec"
                count={report.attention.failed.length}
              >
                {report.attention.failed.map((o) => (
                  <AttentionOrderRow key={o.id} order={o} />
                ))}
              </AttentionBlock>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#13131a] p-3">
      {icon}
      <p className="mt-1 font-heading text-base font-extrabold leading-tight">
        {value}
      </p>
      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function AttentionBlock({
  title,
  empty,
  children,
  icon,
  count,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
  icon?: boolean;
  count: number;
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-[#13131a] p-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-bold">
        {icon && <AlertTriangle className="size-3.5 text-amber-400" />}
        {title}
        {count > 0 && (
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px]">
            {count}
          </span>
        )}
      </p>
      {count === 0 ? (
        <p className="text-[11px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </section>
  );
}

function AttentionOrderRow({ order }: { order: AttentionOrder }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-white/5 px-3 py-2">
      <div
        className="size-9 shrink-0 rounded-lg bg-cover bg-center bg-white/5"
        style={
          order.product.images[0]
            ? { backgroundImage: `url(${order.product.images[0]})` }
            : undefined
        }
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{order.product.title}</p>
        <p className="text-[10px] text-muted-foreground">
          {order.shop.name} · {order.buyer.name} · {order.status}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[11px] font-bold">
          {formatMoney(order.totalCents || order.productCents)}
        </p>
        <Link
          href={`/orders/${order.id}`}
          className="text-[10px] font-semibold text-primary"
        >
          Voir →
        </Link>
      </div>
    </li>
  );
}
