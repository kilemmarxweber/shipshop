import { NextResponse } from "next/server";
import {
  buildHourHeat,
  buildSeries,
  buildWeekdayHeat,
  loadAttentionItems,
  loadOrdersForShops,
  loadProductStats,
  loadVendorBalances,
  parsePeriod,
  periodLabel,
  periodStart,
  resolveReportScope,
  summarizeOrders,
} from "@/lib/reports";
import { getSession } from "@/lib/session";

/**
 * Rapport analytics :
 * - owner Chip Shop → toutes les boutiques + soldes + alertes
 * - vendeur → ses boutiques (1..N) uniquement
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const period = parsePeriod(url.searchParams.get("period"));
    const shopIdParam = url.searchParams.get("shopId");
    const from = periodStart(period);

    const scope = await resolveReportScope(session.user.id);
    if (scope.shops.length === 0) {
      return NextResponse.json({
        role: scope.isOwner ? "owner" : "vendor",
        period,
        periodLabel: periodLabel(period),
        shops: [],
        summary: summarizeOrders([]),
        series: [],
        weekdayHeat: buildWeekdayHeat([]),
        hourHeat: buildHourHeat([]),
        products: [],
        vendors: [],
        attention: {
          cancelled: [],
          refunded: [],
          failed: [],
          openIssues: [],
        },
        selectedShopId: null,
      });
    }

    let shops = scope.shops;
    if (shopIdParam) {
      const allowed = shops.find((s) => s.id === shopIdParam);
      if (!allowed) {
        return NextResponse.json(
          { error: "Boutique hors de votre périmètre" },
          { status: 403 },
        );
      }
      shops = [allowed];
    }

    const shopIds = shops.map((s) => s.id);
    const [orders, products, attention, balances] = await Promise.all([
      loadOrdersForShops(shopIds, from),
      loadProductStats(shopIds, from),
      loadAttentionItems(shopIds, from),
      loadVendorBalances(scope.isOwner ? scope.shops : shops),
    ]);

    const summary = summarizeOrders(orders);
    const series = buildSeries(orders, from, period);
    const weekdayHeat = buildWeekdayHeat(orders);
    const hourHeat = buildHourHeat(orders);

    // Liste vendeurs : owner = toutes boutiques ; vendeur = siennes
    const vendorShops = scope.isOwner ? scope.shops : shops;
    const vendorOrders =
      scope.isOwner && shopIdParam
        ? await loadOrdersForShops(
            scope.shops.map((s) => s.id),
            from,
          )
        : orders;

    const byShop = new Map<
      string,
      {
        shopId: string;
        shopName: string;
        soldCents: number;
        feeCents: number;
        orders: number;
      }
    >();
    for (const s of vendorShops) {
      byShop.set(s.id, {
        shopId: s.id,
        shopName: s.name,
        soldCents: 0,
        feeCents: 0,
        orders: 0,
      });
    }
    for (const o of vendorOrders) {
      if (o.status !== "DELIVERED" && o.status !== "PICKED_UP") continue;
      const row = byShop.get(o.shopId);
      if (!row) continue;
      row.soldCents += o.productCents || o.amountCents || 0;
      row.feeCents += o.saleFeeCents || 0;
      row.orders += 1;
    }

    const balanceMap = new Map(balances.map((b) => [b.shopId, b]));
    const vendors = [...byShop.values()]
      .map((v) => {
        const bal = balanceMap.get(v.shopId);
        return {
          ...v,
          ownerName: bal?.ownerName ?? null,
          balanceCents: bal?.balanceCents ?? 0,
          gainCents: Math.max(0, v.soldCents - v.feeCents),
          profitCents: Math.max(0, v.soldCents - v.feeCents),
        };
      })
      .sort((a, b) => b.soldCents - a.soldCents);

    // Owner : top 12 plateforme. Vendeur : tous ses produits (budget qté × prix).
    const sortedProducts = [...products].sort(
      (a, b) => b.soldCents - a.soldCents,
    );
    const topProducts = scope.isOwner
      ? sortedProducts.slice(0, 12)
      : sortedProducts;

    const peakWeekday = [...weekdayHeat].sort(
      (a, b) => b.revenueCents - a.revenueCents,
    )[0];
    const peakHour = [...hourHeat].sort(
      (a, b) => b.revenueCents - a.revenueCents,
    )[0];

    return NextResponse.json({
      role: scope.isOwner ? "owner" : "vendor",
      period,
      periodLabel: periodLabel(period),
      from: from?.toISOString() ?? null,
      shops: scope.shops,
      selectedShopId: shopIdParam,
      summary: {
        ...summary,
        /** Owner : frais plateforme ; vendeur : CA. */
        highlightCents: scope.isOwner
          ? summary.platformFeeCents
          : summary.vendorGainCents,
      },
      series,
      weekdayHeat,
      hourHeat,
      insights: {
        peakWeekday: peakWeekday?.day ?? null,
        peakWeekdayCents: peakWeekday?.revenueCents ?? 0,
        peakHour: peakHour?.label ?? null,
        peakHourCents: peakHour?.revenueCents ?? 0,
        sellThrough:
          products.length === 0
            ? 0
            : Math.round(
                (products.reduce((a, p) => a + p.soldQty, 0) /
                  Math.max(
                    1,
                    products.reduce((a, p) => a + p.soldQty + p.stockQty, 0),
                  )) *
                  100,
              ),
        inventoryValueCents: products.reduce((a, p) => a + p.unsoldCents, 0),
        soldInventoryCents: products.reduce((a, p) => a + p.soldCents, 0),
      },
      products: topProducts,
      vendors,
      attention,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur rapport";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
