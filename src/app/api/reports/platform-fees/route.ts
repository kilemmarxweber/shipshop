import type { PlatformFeeKind, Prisma } from "@/generated/prisma/client";
import { assertChipShopOwner } from "@/lib/kyc";
import { getPlatformFeeSettings, publicFeeSettings } from "@/lib/platform-fees";
import { prisma, withDbRetry } from "@/lib/prisma";
import { parsePeriod, periodStart } from "@/lib/reports";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

type Bucket = "day" | "month" | "year";

function parseBucket(raw: string | null): Bucket {
  if (raw === "day" || raw === "month" || raw === "year") return raw;
  return "month";
}

function bucketStart(bucket: Bucket): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (bucket === "day") return d;
  if (bucket === "month") {
    d.setDate(1);
    return d;
  }
  d.setMonth(0, 1);
  return d;
}

function seriesKey(date: Date, bucket: Bucket) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (bucket === "day") return `${y}-${m}-${day}`;
  if (bucket === "month") return `${y}-${m}`;
  return String(y);
}

function seriesLabel(key: string, bucket: Bucket) {
  if (bucket === "year") return key;
  if (bucket === "month") {
    const [y, m] = key.split("-");
    const months = [
      "Jan",
      "Fév",
      "Mar",
      "Avr",
      "Mai",
      "Jun",
      "Jul",
      "Aoû",
      "Sep",
      "Oct",
      "Nov",
      "Déc",
    ];
    return `${months[Number(m) - 1] ?? m} ${y}`;
  }
  return key;
}

function sourceFromKind(kind: PlatformFeeKind) {
  if (kind === "DEPOSIT") return "deposit";
  if (kind === "WITHDRAWAL") return "withdrawal";
  if (kind === "TRANSFER_EXTERNAL") return "transferExternal";
  if (kind === "TRANSFER_INTERNAL") return "transferInternal";
  if (kind === "SALE") return "sale";
  if (kind === "SHIPPING") return "shipping";
  if (kind === "TICKET") return "ticket";
  return "other";
}

const SOURCE_ORDER = [
  "deposit",
  "withdrawal",
  "transferExternal",
  "transferInternal",
  "sale",
  "shipping",
  "ticket",
  "ads",
  "challenges",
  "other",
] as const;

type SourceKey = (typeof SOURCE_ORDER)[number];

function emptySource(source: SourceKey) {
  return {
    source,
    grossUsdCents: 0,
    providerCostUsdCents: 0,
    shipshopNetUsdCents: 0,
    partnerShareUsdCents: 0,
    count: 0,
  };
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Réservé au owner" }, { status: 403 });
  }

  const url = new URL(req.url);
  const period = parsePeriod(url.searchParams.get("period"));
  const bucket = parseBucket(url.searchParams.get("bucket"));
  const fromPeriod = periodStart(period);
  const fromBucket = bucketStart(bucket);
  const from =
    fromPeriod && fromBucket
      ? fromPeriod > fromBucket
        ? fromPeriod
        : fromBucket
      : (fromPeriod ?? fromBucket);
  const kind = url.searchParams.get("kind");
  const csv = url.searchParams.get("csv") === "1";

  const feeKind =
    kind === "SALE" ||
    kind === "SHIPPING" ||
    kind === "WITHDRAWAL" ||
    kind === "DEPOSIT" ||
    kind === "TRANSFER_EXTERNAL" ||
    kind === "TRANSFER_INTERNAL" ||
    kind === "TICKET"
      ? (kind as PlatformFeeKind)
      : undefined;
  const where: Prisma.PlatformFeeWhereInput = {
    reversedAt: null,
    ...(from ? { createdAt: { gte: from } } : {}),
    ...(feeKind ? { kind: feeKind } : {}),
  };

  const [fees, settings, campaigns, challenges] = await Promise.all([
    withDbRetry(() =>
      prisma.platformFee.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 2000,
        include: {
          order: {
            select: {
              id: true,
              shop: { select: { name: true } },
              courier: { select: { name: true } },
            },
          },
        },
      }),
    ),
    getPlatformFeeSettings(),
    withDbRetry(() =>
      prisma.brandCampaign.findMany({
        where: {
          budgetCents: { gt: 0 },
          ...(from ? { createdAt: { gte: from } } : {}),
        },
        select: { id: true, budgetCents: true, currency: true, title: true },
        take: 200,
      }),
    ).catch(() => []),
    withDbRetry(() =>
      prisma.dailyChallenge.findMany({
        where: {
          ...(from ? { createdAt: { gte: from } } : {}),
          sponsorCampaignId: { not: null },
        },
        select: {
          id: true,
          sponsorCampaignId: true,
        },
        take: 200,
      }),
    ).catch(() => []),
  ]);

  const bySource = Object.fromEntries(
    SOURCE_ORDER.map((s) => [s, emptySource(s)]),
  ) as Record<SourceKey, ReturnType<typeof emptySource>>;

  const seriesMap = new Map<
    string,
    {
      key: string;
      label: string;
      grossUsdCents: number;
      providerCostUsdCents: number;
      shipshopNetUsdCents: number;
      partnerShareUsdCents: number;
      count: number;
    }
  >();

  let grossUsd = 0;
  let providerUsd = 0;
  let netUsd = 0;
  let partnerUsd = 0;

  for (const f of fees) {
    const gross =
      f.grossFeeCents > 0
        ? f.amountUsdCents || f.grossFeeCents
        : f.amountUsdCents;
    // Prefer stored splits; fall back for legacy rows.
    const grossFeeUsd =
      f.grossFeeCents > 0
        ? Math.round(
            (f.amountUsdCents * f.grossFeeCents) /
              Math.max(1, f.netAmountCents || f.amountCents || 1),
          )
        : f.amountUsdCents;
    const providerFeeUsd =
      f.providerCostCents > 0
        ? Math.round(
            (f.amountUsdCents * f.providerCostCents) /
              Math.max(1, f.netAmountCents || f.amountCents || 1),
          )
        : 0;
    const netFeeUsd =
      f.netAmountCents > 0
        ? Math.round(
            (f.amountUsdCents * f.netAmountCents) /
              Math.max(1, f.netAmountCents || f.amountCents || 1),
          )
        : f.amountUsdCents;
    const partnerFeeUsd =
      f.partnerShareCents > 0
        ? Math.round(
            (f.amountUsdCents * f.partnerShareCents) /
              Math.max(1, f.netAmountCents || f.amountCents || 1),
          )
        : 0;

    // Simpler: treat amountUsdCents as net; scale other fields from cents ratios in same currency.
    const scale = f.amountCents > 0 ? f.amountUsdCents / f.amountCents : 1;
    const gUsd =
      f.grossFeeCents > 0
        ? Math.round(f.grossFeeCents * scale)
        : f.amountUsdCents;
    const pUsd = Math.round((f.providerCostCents || 0) * scale);
    const nUsd =
      f.netAmountCents > 0
        ? Math.round(f.netAmountCents * scale)
        : f.amountUsdCents;
    const partnerShareUsd = Math.round((f.partnerShareCents || 0) * scale);

    void gross;
    void grossFeeUsd;
    void providerFeeUsd;
    void netFeeUsd;
    void partnerFeeUsd;

    const source = sourceFromKind(f.kind) as SourceKey;
    const row = bySource[source] ?? bySource.other;
    row.grossUsdCents += gUsd;
    row.providerCostUsdCents += pUsd;
    row.shipshopNetUsdCents += nUsd;
    row.partnerShareUsdCents += partnerShareUsd;
    row.count += 1;

    grossUsd += gUsd;
    providerUsd += pUsd;
    netUsd += nUsd;
    partnerUsd += partnerShareUsd;

    const key = seriesKey(f.createdAt, bucket);
    const point = seriesMap.get(key) ?? {
      key,
      label: seriesLabel(key, bucket),
      grossUsdCents: 0,
      providerCostUsdCents: 0,
      shipshopNetUsdCents: 0,
      partnerShareUsdCents: 0,
      count: 0,
    };
    point.grossUsdCents += gUsd;
    point.providerCostUsdCents += pUsd;
    point.shipshopNetUsdCents += nUsd;
    point.partnerShareUsdCents += partnerShareUsd;
    point.count += 1;
    seriesMap.set(key, point);
  }

  const adsUsd = campaigns.reduce((a, c) => a + Math.max(0, c.budgetCents), 0);
  bySource.ads.grossUsdCents = adsUsd;
  bySource.ads.shipshopNetUsdCents = adsUsd;
  bySource.ads.count = campaigns.length;
  grossUsd += adsUsd;
  netUsd += adsUsd;

  bySource.challenges.count = challenges.length;

  if (csv) {
    const header =
      "date,kind,amountCents,grossFeeCents,providerCostCents,netAmountCents,partnerShareCents,currency,amountUsdCents,orderId,shop,courier\n";
    const rows = fees
      .map((f) =>
        [
          f.createdAt.toISOString(),
          f.kind,
          f.amountCents,
          f.grossFeeCents,
          f.providerCostCents,
          f.netAmountCents,
          f.partnerShareCents,
          f.currency,
          f.amountUsdCents,
          f.orderId ?? "",
          f.order?.shop.name ?? "",
          f.order?.courier?.name ?? "",
        ].join(","),
      )
      .join("\n");
    return new NextResponse(header + rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=platform-fees.csv",
      },
    });
  }

  const saleUsd = bySource.sale.shipshopNetUsdCents;
  const shipUsd = bySource.shipping.shipshopNetUsdCents;
  const wdUsd = bySource.withdrawal.shipshopNetUsdCents;

  return NextResponse.json({
    bucket,
    period,
    settings: publicFeeSettings(settings),
    totals: {
      grossFeeUsdCents: grossUsd,
      cinetPayCostUsdCents: providerUsd,
      partnerShareUsdCents: partnerUsd,
      netUsdCents: netUsd,
      inUsdCents: grossUsd,
      outUsdCents: providerUsd + partnerUsd,
    },
    summary: {
      saleUsdCents: saleUsd,
      shippingUsdCents: shipUsd,
      withdrawalUsdCents: wdUsd,
      depositUsdCents: bySource.deposit.shipshopNetUsdCents,
      transferExternalUsdCents: bySource.transferExternal.shipshopNetUsdCents,
      ticketUsdCents: bySource.ticket.shipshopNetUsdCents,
      adsUsdCents: bySource.ads.shipshopNetUsdCents,
      totalUsdCents: netUsd,
      saleCount: bySource.sale.count,
      shippingCount: bySource.shipping.count,
    },
    bySource: SOURCE_ORDER.map((s) => bySource[s]),
    series: [...seriesMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
    fees: fees.slice(0, 500).map((f) => ({
      id: f.id,
      kind: f.kind,
      amountCents: f.amountCents,
      grossFeeCents: f.grossFeeCents,
      providerCostCents: f.providerCostCents,
      netAmountCents: f.netAmountCents || f.amountCents,
      partnerShareCents: f.partnerShareCents,
      feeBpsSnapshot: f.feeBpsSnapshot,
      providerBpsSnapshot: f.providerBpsSnapshot,
      currency: f.currency,
      amountUsdCents: f.amountUsdCents,
      createdAt: f.createdAt,
      orderId: f.orderId,
      shopName: f.order?.shop.name ?? null,
      courierName: f.order?.courier?.name ?? null,
    })),
  });
}
